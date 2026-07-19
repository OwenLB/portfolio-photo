#!/usr/bin/env npx tsx
/**
 * Import batch — original file → R2 (Cloudflare Image Resizing handles variants)
 *
 * Usage:
 *   npx tsx scripts/import.ts --album tokyo-2025 ~/Photos/Tokyo/export/*.jpg
 *   npx tsx scripts/import.ts --album alpes-2024 --visible ~/Photos/Alpes/*.jpg
 *
 * Flux :
 *   1. Lit les EXIF du fichier original (appareil, GPS, date, etc.)
 *   2. Extrait les dimensions depuis l'en-tête du fichier (JPEG/PNG, sans Sharp)
 *   3. Upload le fichier original sur R2 (photos/{slug}/{id}{ext})
 *   4. Met à jour albums/<slug>.json + albums/index.json sur R2
 *
 * Cloudflare Image Resizing génère thumb (1200px) et full (3000px) à la demande
 * via /cdn-cgi/image/… — gratuit jusqu'à 5 000 transformations uniques/mois.
 *
 * Prérequis :
 *   Variables d'env R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, R2_PUBLIC_URL dans .env ou l'environnement.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Album, AlbumSummary, Photo } from '../src/lib/types.ts';

// ── Paramètres ───────────────────────────────────────────────────────────────

const UPLOAD_CONCURRENCY = 3; // photos en parallèle

// ── Parsing des arguments ────────────────────────────────────────────────────

interface Args { album: string; files: string[]; visible: boolean }

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const flagIdx = (f: string) => argv.indexOf(f);
  const flag = (f: string) => { const i = flagIdx(f); return i !== -1 ? argv[i + 1] : undefined; };

  const album = flag('--album');
  if (!album) {
    console.error('Usage: npx tsx scripts/import.ts --album <slug> [--visible] photo1.jpg photo2.jpg …');
    process.exit(1);
  }

  const files = argv.filter(a => !a.startsWith('--') && a !== album);
  if (files.length === 0) {
    console.error('Aucun fichier spécifié.');
    process.exit(1);
  }

  // Vérifier que tous les fichiers existent
  for (const f of files) {
    if (!fs.existsSync(f)) { console.error(`Fichier introuvable: ${f}`); process.exit(1); }
  }

  return { album, files, visible: argv.includes('--visible') };
}

// ── Client R2 ────────────────────────────────────────────────────────────────

function makeR2Client(): S3Client {
  const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']
    .filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`Variables manquantes: ${missing.join(', ')}`);
    console.error('Crée un .env ou exporte les variables avant de lancer le script.');
    process.exit(1);
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

const BUCKET = () => process.env.R2_BUCKET_NAME!;

async function r2Get(client: S3Client, key: string): Promise<string | null> {
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET(), Key: key }));
    return res.Body!.transformToString();
  } catch { return null; }
}

async function r2Put(client: S3Client, key: string, body: Buffer, contentType: string): Promise<void> {
  await client.send(new PutObjectCommand({
    Bucket: BUCKET(),
    Key: key,
    Body: body,
    ContentType: contentType,
    // Fichiers immuables : 1 an de cache — l'ID change si le fichier change
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

// ── Dimensions image (sans dépendance native) ─────────────────────────────────

/**
 * Extrait les dimensions d'un JPEG ou PNG directement depuis les octets d'en-tête.
 * Pas besoin de Sharp ni d'autre bibliothèque native.
 */
function getImageSize(buf: Buffer): { w: number; h: number } | null {
  // JPEG — cherche les marqueurs SOF0 / SOF1 / SOF2
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let i = 2;
    while (i + 3 < buf.length) {
      if (buf[i] !== 0xFF) break;
      const marker = buf[i + 1];
      if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
        // Octet 3-4 : longueur du segment ; 5-6 : hauteur ; 7-8 : largeur
        const h = buf.readUInt16BE(i + 5);
        const w = buf.readUInt16BE(i + 7);
        return { w, h };
      }
      const len = buf.readUInt16BE(i + 2);
      i += 2 + len;
    }
  }
  // PNG — signature 8 octets, puis IHDR avec w/h à l'offset 16/20
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buf.length >= 24 && buf.subarray(0, 8).equals(PNG_SIG)) {
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    return { w, h };
  }
  return null;
}

// ── Lecture EXIF ─────────────────────────────────────────────────────────────

async function readExif(filePath: string): Promise<Partial<Photo>> {
  const exifr = await import('exifr');
  const exif = await exifr.default.parse(filePath, {
    tiff: true, exif: true, gps: true,
    pick: [
      'Make', 'Model', 'LensModel',
      'FNumber', 'ExposureTime', 'ISO', 'FocalLength',
      'DateTimeOriginal',
    ],
  }).catch(() => null);

  if (!exif) return {};

  // GPS : exifr calcule latitude/longitude directement
  const gps = await exifr.default.gps(filePath).catch(() => null);

  const make  = exif.Make  ? String(exif.Make).trim()  : '';
  const model = exif.Model ? String(exif.Model).trim() : '';
  const camera = (model.toLowerCase().startsWith(make.toLowerCase()) ? model : [make, model].filter(Boolean).join(' ')) || undefined;

  let shutterSpeed: string | undefined;
  if (exif.ExposureTime) {
    const t = Number(exif.ExposureTime);
    shutterSpeed = t >= 0.5 ? `${t}s` : `1/${Math.round(1 / t)}s`;
  }

  let capturedAt: string | undefined;
  if (exif.DateTimeOriginal instanceof Date) capturedAt = exif.DateTimeOriginal.toISOString();

  return {
    camera,
    lens:         exif.LensModel  || undefined,
    aperture:     exif.FNumber    ? `f/${exif.FNumber}` : undefined,
    shutterSpeed,
    iso:          exif.ISO        ? Number(exif.ISO)    : undefined,
    focalLength:  exif.FocalLength ? `${Math.round(Number(exif.FocalLength))}mm` : undefined,
    capturedAt,
    geoLat:       gps?.latitude   ? Math.round(gps.latitude  * 10000) / 10000 : undefined,
    geoLng:       gps?.longitude  ? Math.round(gps.longitude * 10000) / 10000 : undefined,
  };
}

// ── Gestion album R2 ─────────────────────────────────────────────────────────

async function getAlbum(client: S3Client, slug: string): Promise<Album | null> {
  const text = await r2Get(client, `albums/${slug}.json`);
  return text ? JSON.parse(text) : null;
}

async function saveAlbum(client: S3Client, album: Album): Promise<void> {
  // 1. Sauvegarder l'album complet
  await r2Put(client, `albums/${album.slug}.json`, Buffer.from(JSON.stringify(album, null, 2)), 'application/json');

  // 2. Mettre à jour l'index global
  const indexText = await r2Get(client, 'albums/index.json');
  const index: { albums: AlbumSummary[] } = indexText ? JSON.parse(indexText) : { albums: [] };

  const summary: AlbumSummary = {
    slug: album.slug, title: album.title, visible: album.visible,
    cover: album.cover, photoCount: album.photos.length, createdAt: album.createdAt,
  };
  const i = index.albums.findIndex(a => a.slug === album.slug);
  if (i >= 0) index.albums[i] = summary; else index.albums.push(summary);

  await r2Put(client, 'albums/index.json', Buffer.from(JSON.stringify(index, null, 2)), 'application/json');
}

// ── Traitement d'une photo ────────────────────────────────────────────────────

// Mime types courants pour les extensions photo
const EXT_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic', '.heif': 'image/heif',
};

async function processOne(
  client: S3Client,
  slug: string,
  filePath: string,
  order: number,
): Promise<Photo> {
  const origName = path.basename(filePath);
  const ext      = path.extname(filePath).toLowerCase();
  const id       = crypto.randomBytes(6).toString('hex'); // ex: a3f9c2
  const filename = `${id}${ext}`;

  process.stdout.write(`  ${origName} → ${filename}  `);

  const srcBuf = fs.readFileSync(filePath);

  // Dimensions extraites depuis l'en-tête du fichier — pas besoin de Sharp
  const size = getImageSize(srcBuf);
  if (!size) {
    throw new Error(`Impossible de lire les dimensions de ${origName}. Format non supporté ?`);
  }
  const { w, h } = size;

  process.stdout.write(`${w}×${h}  `);

  // Lecture EXIF en parallèle de l'upload
  const [, exif] = await Promise.all([
    r2Put(client, `photos/${slug}/${filename}`, srcBuf, EXT_MIME[ext] ?? 'application/octet-stream'),
    readExif(filePath),
  ]);

  const sizeKo = (srcBuf.length / 1024).toFixed(0);
  process.stdout.write(`[${sizeKo} Ko]\n`);

  if (exif.camera) {
    const meta = [exif.camera, exif.aperture, exif.shutterSpeed, exif.iso ? `ISO ${exif.iso}` : '']
      .filter(Boolean).join(' · ');
    console.log(`         EXIF: ${meta}`);
  }

  return {
    id,
    filename,
    w, h,
    order,
    visible: true,
    ...exif,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Charger .env si présent
  try {
    const { config } = await import('dotenv');
    config();
  } catch {}

  const { album: slug, files, visible } = parseArgs();
  const client = makeR2Client();

  console.log(`\n📦 Import vers "${slug}" (Cloudflare Image Resizing)`);
  console.log(`   ${files.length} fichier(s) — upload original, pas de conversion locale\n`);

  // Charger ou initialiser l'album
  let album: Album = await getAlbum(client, slug) ?? {
    slug,
    title: slug,
    description: undefined,
    visible: false,
    cover: '',
    photos: [],
    createdAt: new Date().toISOString(),
  };

  const startOrder = album.photos.length;
  const newPhotos: Photo[] = [];
  const errors: string[] = [];

  // Traitement par batches
  for (let i = 0; i < files.length; i += UPLOAD_CONCURRENCY) {
    const batch = files.slice(i, i + UPLOAD_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((f, bi) => processOne(client, slug, f, startOrder + i + bi))
    );
    for (const r of results) {
      if (r.status === 'fulfilled') newPhotos.push(r.value);
      else { console.error(`  ✗ ${r.reason}`); errors.push(String(r.reason)); }
    }
  }

  if (newPhotos.length === 0) {
    console.error('\n❌ Aucune photo importée.');
    process.exit(1);
  }

  // Mettre à jour l'album
  album.photos.push(...newPhotos);
  if (!album.cover) album.cover = newPhotos[0].id;
  if (visible) album.visible = true;

  await saveAlbum(client, album);

  console.log(`\n✅ ${newPhotos.length} photo(s) ajoutée(s) à "${slug}"`);
  if (errors.length > 0) console.warn(`   ⚠️  ${errors.length} erreur(s)`);
  if (!album.visible) console.log('   Album masqué — active-le dans l\'admin ou relance avec --visible');
  console.log('\n💡 Thumbnail : /cdn-cgi/image/width=1200,quality=78,format=webp/photos/<slug>/<filename>');
  console.log('   Full      : /cdn-cgi/image/width=3000,quality=88,format=webp/photos/<slug>/<filename>');
}

main().catch(err => { console.error('\n❌', err.message); process.exit(1); });
