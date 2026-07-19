/**
 * R2 client — Cloudflare R2 via AWS S3-compatible API.
 *
 * En dev (R2_ACCESS_KEY_ID absent) : données mockées + URLs Unsplash.
 * En prod : S3Client pointé sur R2, Cloudflare Image Resizing pour les URLs.
 *
 * Variables d'env requises en prod :
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, R2_PUBLIC_URL
 */

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Album, AlbumSummary } from './types';

const IS_MOCK = !process.env.R2_ACCESS_KEY_ID;

// ─── S3 client factory ────────────────────────────────────────────────────────

function getClient(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

const BUCKET = () => process.env.R2_BUCKET_NAME!;

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_PUBLIC_URL = 'https://images.unsplash.com';

const mockAlbums: Record<string, Album> = {
  'tokyo-2025': {
    slug: 'tokyo-2025',
    title: 'Tokyo 2025',
    description: 'Voyage au Japon, mars 2025. Shinjuku, Shibuya, Asakusa.',
    visible: true,
    cover: 'img001',
    createdAt: '2025-03-15T00:00:00Z',
    photos: [
      { id: 'img001', filename: 'img001.jpg', w: 4032, h: 3024, order: 0, visible: true, capturedAt: '2025-03-15T09:00:00Z', camera: 'Sony A7 IV', lens: 'FE 24-70mm f/2.8 GM', aperture: 'f/2.8', shutterSpeed: '1/80s', iso: 1600, focalLength: '35mm', description: 'Shinjuku sous la pluie — reflets de néons sur le bitume.', location: 'Shinjuku, Tokyo', geoLat: 35.6938, geoLng: 139.7036 },
      { id: 'img002', filename: 'img002.jpg', w: 3024, h: 4032, order: 1, visible: true, capturedAt: '2025-03-15T10:30:00Z', camera: 'Sony A7 IV', lens: 'FE 24-70mm f/2.8 GM', aperture: 'f/4.0', shutterSpeed: '1/250s', iso: 400, focalLength: '24mm', location: 'Asakusa, Tokyo', geoLat: 35.7148, geoLng: 139.7967 },
      { id: 'img003', filename: 'img003.jpg', w: 5472, h: 3648, order: 2, visible: true, capturedAt: '2025-03-15T14:00:00Z', camera: 'Sony A7 IV', lens: 'FE 16-35mm f/2.8 GM', aperture: 'f/5.6', shutterSpeed: '1/500s', iso: 200, focalLength: '16mm', description: 'Golden hour depuis le Tokyo Skytree.', location: 'Tokyo Skytree, Sumida', geoLat: 35.7101, geoLng: 139.8107 },
      { id: 'img004', filename: 'img004.jpg', w: 3648, h: 5472, order: 3, visible: true, capturedAt: '2025-03-16T08:00:00Z', camera: 'Sony A7 IV', lens: 'FE 85mm f/1.4 GM', aperture: 'f/1.4', shutterSpeed: '1/1000s', iso: 100, focalLength: '85mm', location: 'Yanaka, Tokyo', geoLat: 35.7275, geoLng: 139.7700 },
      { id: 'img005', filename: 'img005.jpg', w: 4032, h: 3024, order: 4, visible: true, capturedAt: '2025-03-16T11:00:00Z', camera: 'Sony A7 IV', lens: 'FE 24-70mm f/2.8 GM', aperture: 'f/8.0', shutterSpeed: '1/320s', iso: 200, focalLength: '50mm', location: 'Odaiba, Tokyo', geoLat: 35.6267, geoLng: 139.7753 },
      { id: 'img006', filename: 'img006.jpg', w: 1920, h: 1280, order: 5, visible: true, capturedAt: '2025-03-16T15:00:00Z', camera: 'Sony A7 IV', lens: 'FE 16-35mm f/2.8 GM', aperture: 'f/2.8', shutterSpeed: '1/30s', iso: 3200, focalLength: '16mm', description: 'Shibuya crossing — 3200 ISO pour figer le chaos.', location: 'Shibuya, Tokyo', geoLat: 35.6595, geoLng: 139.7004 },
      { id: 'img007', filename: 'img007.jpg', w: 4032, h: 3024, order: 6, visible: true, capturedAt: '2025-03-17T09:00:00Z', camera: 'Sony A7 IV', lens: 'FE 24-70mm f/2.8 GM', aperture: 'f/3.5', shutterSpeed: '1/200s', iso: 800, focalLength: '70mm', location: 'Meiji Jingu, Tokyo', geoLat: 35.6762, geoLng: 139.6993 },
      { id: 'img008', filename: 'img008.jpg', w: 3024, h: 4032, order: 7, visible: true, capturedAt: '2025-03-17T12:00:00Z', camera: 'Sony A7 IV', lens: 'FE 85mm f/1.4 GM', aperture: 'f/2.0', shutterSpeed: '1/640s', iso: 200, focalLength: '85mm', location: 'Harajuku, Tokyo', geoLat: 35.6702, geoLng: 139.7026 },
    ],
  },
  'alpes-2024': {
    slug: 'alpes-2024',
    title: 'Alpes 2024',
    description: 'Randonnées dans les Alpes françaises, été 2024.',
    visible: true,
    cover: 'img001',
    createdAt: '2024-07-20T00:00:00Z',
    photos: [
      { id: 'img001', filename: 'img001.jpg', w: 5472, h: 3648, order: 0, visible: true, capturedAt: '2024-07-20T07:00:00Z', camera: 'Fujifilm X-T5', lens: 'XF 16-80mm f/4', aperture: 'f/8.0', shutterSpeed: '1/250s', iso: 200, focalLength: '16mm', description: 'Aiguille du Midi, 3842m — lumière rasante du matin.' },
      { id: 'img002', filename: 'img002.jpg', w: 3648, h: 5472, order: 1, visible: true, capturedAt: '2024-07-20T10:00:00Z', camera: 'Fujifilm X-T5', lens: 'XF 16-80mm f/4', aperture: 'f/5.6', shutterSpeed: '1/500s', iso: 160, focalLength: '35mm' },
      { id: 'img003', filename: 'img003.jpg', w: 4032, h: 3024, order: 2, visible: true, capturedAt: '2024-07-20T12:00:00Z', camera: 'Fujifilm X-T5', lens: 'XF 10-24mm f/4', aperture: 'f/11', shutterSpeed: '1/125s', iso: 160, focalLength: '10mm' },
      { id: 'img004', filename: 'img004.jpg', w: 4032, h: 3024, order: 3, visible: true, capturedAt: '2024-07-21T08:00:00Z', camera: 'Fujifilm X-T5', lens: 'XF 16-80mm f/4', aperture: 'f/4.0', shutterSpeed: '1/1000s', iso: 320, focalLength: '80mm', description: "Lac de Tseuzier — eau turquoise à 1780m d'altitude." },
      { id: 'img005', filename: 'img005.jpg', w: 3024, h: 4032, order: 4, visible: false, capturedAt: '2024-07-21T11:00:00Z', camera: 'Fujifilm X-T5', lens: 'XF 16-80mm f/4', aperture: 'f/6.4', shutterSpeed: '1/800s', iso: 160, focalLength: '24mm' },
    ],
  },
  'bretagne-2024': {
    slug: 'bretagne-2024',
    title: 'Bretagne 2024',
    description: 'Côte sauvage bretonne, automne 2024.',
    visible: false,
    cover: 'img001',
    createdAt: '2024-10-05T00:00:00Z',
    photos: [
      { id: 'img001', filename: 'img001.jpg', w: 5472, h: 3648, order: 0, visible: true, capturedAt: '2024-10-05T09:00:00Z' },
      { id: 'img002', filename: 'img002.jpg', w: 4032, h: 3024, order: 1, visible: true, capturedAt: '2024-10-05T11:00:00Z' },
      { id: 'img003', filename: 'img003.jpg', w: 3024, h: 4032, order: 2, visible: true, capturedAt: '2024-10-06T08:00:00Z' },
    ],
  },
};

const UNSPLASH_IDS: Record<string, Record<string, string>> = {
  'tokyo-2025': {
    'img001': 'photo-1540959733332-eab4deabeeaf',
    'img002': 'photo-1513407030348-c983a97b98d8',
    'img003': 'photo-1528360983277-13d401cdc186',
    'img004': 'photo-1536098561742-ca998e48cbcc',
    'img005': 'photo-1542051841857-5f90071e7989',
    'img006': 'photo-1478436127897-769e1b3f0f36',
    'img007': 'photo-1490806843957-31f4c9a91c65',
    'img008': 'photo-1503899036084-c55cdd92da26',
  },
  'alpes-2024': {
    'img001': 'photo-1464822759023-fed622ff2c3b',
    'img002': 'photo-1506905925346-21bda4d32df4',
    'img003': 'photo-1483728642387-6c3bdd6c93e5',
    'img004': 'photo-1516410529446-2c777cb7366d',
    'img005': 'photo-1470770841072-f978cf4d019e',
  },
  'bretagne-2024': {
    'img001': 'photo-1570366583862-f91883984fde',
    'img002': 'photo-1499678329028-101435549a4e',
    'img003': 'photo-1504893524553-b855bce32c67',
  },
};

function getMockThumbUrl(slug: string, filename: string): string {
  const photoId = filename.replace(/\.[^.]+$/, '');
  const unsplashId = UNSPLASH_IDS[slug]?.[photoId];
  return unsplashId
    ? `https://images.unsplash.com/${unsplashId}?w=800&q=80&auto=format&fit=crop`
    : `https://picsum.photos/seed/${slug}-${photoId}/800/600`;
}

function getMockFullUrl(slug: string, filename: string): string {
  const photoId = filename.replace(/\.[^.]+$/, '');
  const unsplashId = UNSPLASH_IDS[slug]?.[photoId];
  return unsplashId
    ? `https://images.unsplash.com/${unsplashId}?w=2400&q=90&auto=format&fit=crop`
    : `https://picsum.photos/seed/${slug}-${photoId}/2400/1600`;
}

// ─── Public URL helpers ───────────────────────────────────────────────────────

export function getPublicUrl(): string {
  return process.env.R2_PUBLIC_URL || MOCK_PUBLIC_URL;
}

export function getThumbUrl(slug: string, filename: string): string {
  if (IS_MOCK) return getMockThumbUrl(slug, filename);
  return `${getPublicUrl()}/cdn-cgi/image/width=1200,quality=78,format=webp/photos/${slug}/${filename}`;
}

export function getFullUrl(slug: string, filename: string): string {
  if (IS_MOCK) return getMockFullUrl(slug, filename);
  // 4000 px: sharp at 5× zoom on retina. Cloudflare never upscales.
  return `${getPublicUrl()}/cdn-cgi/image/width=4000,quality=90,format=webp/photos/${slug}/${filename}`;
}

// ─── Albums CRUD ──────────────────────────────────────────────────────────────

export async function listAlbums(): Promise<AlbumSummary[]> {
  if (IS_MOCK) {
    return Object.values(mockAlbums).map(a => {
      const coverPhoto = a.photos.find(p => p.id === a.cover);
      return {
        slug: a.slug,
        title: a.title,
        visible: a.visible,
        cover: a.cover,
        coverUrl: coverPhoto ? getThumbUrl(a.slug, coverPhoto.filename) : undefined,
        coverFullUrl: coverPhoto ? getFullUrl(a.slug, coverPhoto.filename) : undefined,
        photoCount: a.photos.length,
        createdAt: a.createdAt,
      };
    });
  }
  const client = getClient();
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET(), Key: 'albums/index.json' }));
    const text = await res.Body!.transformToString();
    return (JSON.parse(text).albums ?? []) as AlbumSummary[];
  } catch {
    return [];
  }
}

export async function getAlbum(slug: string): Promise<Album | null> {
  if (IS_MOCK) return mockAlbums[slug] ?? null;
  try {
    const client = getClient();
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET(), Key: `albums/${slug}.json` }));
    const text = await res.Body!.transformToString();
    return JSON.parse(text) as Album;
  } catch {
    return null;
  }
}

export async function putAlbum(album: Album): Promise<void> {
  if (IS_MOCK) { mockAlbums[album.slug] = album; return; }

  const client = getClient();
  const bucket = BUCKET();

  // Save album JSON
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: `albums/${album.slug}.json`,
    Body: JSON.stringify(album),
    ContentType: 'application/json',
  }));

  // Update the index — pre-compute cover URLs so the homepage never needs
  // to fetch individual album JSONs just to display the cover image.
  const all = await listAlbums();
  const coverPhoto = album.photos.find(p => p.id === album.cover);
  const summary: AlbumSummary = {
    slug: album.slug,
    title: album.title,
    visible: album.visible,
    cover: album.cover,
    coverUrl: coverPhoto ? getThumbUrl(album.slug, coverPhoto.filename) : undefined,
    coverFullUrl: coverPhoto ? getFullUrl(album.slug, coverPhoto.filename) : undefined,
    photoCount: album.photos.length,
    createdAt: album.createdAt,
  };
  const idx = all.findIndex(a => a.slug === album.slug);
  if (idx >= 0) all[idx] = summary; else all.push(summary);

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: 'albums/index.json',
    Body: JSON.stringify({ albums: all }),
    ContentType: 'application/json',
  }));
}

export async function deletePhoto(slug: string, photoId: string): Promise<void> {
  if (IS_MOCK) {
    const album = mockAlbums[slug];
    if (album) album.photos = album.photos.filter(p => p.id !== photoId);
    return;
  }
  const album = await getAlbum(slug);
  if (!album) return;
  const photo = album.photos.find(p => p.id === photoId);
  if (!photo) return;
  await getClient().send(new DeleteObjectsCommand({
    Bucket: BUCKET(),
    Delete: { Objects: [{ Key: `photos/${slug}/${photo.filename}` }] },
  }));
}

export async function deleteAlbum(slug: string): Promise<void> {
  if (IS_MOCK) { delete mockAlbums[slug]; return; }

  const client = getClient();
  const bucket = BUCKET();

  // 1. Delete all photo files (paginate for > 1000 objects)
  let continuationToken: string | undefined;
  do {
    const listRes = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: `photos/${slug}/`,
      ContinuationToken: continuationToken,
    }));
    const objects = listRes.Contents ?? [];
    if (objects.length > 0) {
      await client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: objects.map(o => ({ Key: o.Key! })) },
      }));
    }
    continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined;
  } while (continuationToken);

  // 2. Delete album JSON
  await client.send(new DeleteObjectsCommand({
    Bucket: bucket,
    Delete: { Objects: [{ Key: `albums/${slug}.json` }] },
  }));

  // 3. Remove from index
  const all = await listAlbums();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: 'albums/index.json',
    Body: JSON.stringify({ albums: all.filter(a => a.slug !== slug) }),
    ContentType: 'application/json',
  }));
}

export async function reorderAlbums(slugs: string[]): Promise<void> {
  if (IS_MOCK) return;
  const client = getClient();
  const all = await listAlbums();
  const map = new Map(all.map(a => [a.slug, a]));
  const reordered = slugs.map(s => map.get(s)).filter(Boolean) as AlbumSummary[];
  const slugSet = new Set(slugs);
  for (const a of all) { if (!slugSet.has(a.slug)) reordered.push(a); }
  await client.send(new PutObjectCommand({
    Bucket: BUCKET(),
    Key: 'albums/index.json',
    Body: JSON.stringify({ albums: reordered }),
    ContentType: 'application/json',
  }));
}

export async function generatePresignedUrl(slug: string, filename: string, contentType?: string): Promise<string> {
  if (IS_MOCK) {
    return `https://mock-presign.example.com/photos/${slug}/${filename}?mock=1`;
  }
  const cmd = new PutObjectCommand({
    Bucket: BUCKET(),
    Key: `photos/${slug}/${filename}`,
    ContentType: contentType ?? 'application/octet-stream',
  });
  return getSignedUrl(getClient(), cmd, { expiresIn: 3600 });
}
