import type { Album, AlbumSummary } from './types';
import { listAlbums, getAlbum, putAlbum, deleteAlbum as deleteAlbumFromR2 } from './r2';

export async function getAllAlbums(): Promise<AlbumSummary[]> {
  return listAlbums();
}

export async function getVisibleAlbums(): Promise<AlbumSummary[]> {
  const all = await listAlbums();
  return all.filter(a => a.visible);
}

export async function getAlbumBySlug(slug: string): Promise<Album | null> {
  return getAlbum(slug);
}

export async function createAlbum(data: {
  title: string;
  slug: string;
  description?: string;
}): Promise<Album> {
  const album: Album = {
    slug: data.slug,
    title: data.title,
    description: data.description,
    visible: false,
    cover: '',
    photos: [],
    createdAt: new Date().toISOString(),
  };
  await putAlbum(album);
  return album;
}

export async function updateAlbum(slug: string, updates: Partial<Album>): Promise<Album | null> {
  const album = await getAlbum(slug);
  if (!album) return null;
  const updated = { ...album, ...updates };
  await putAlbum(updated);
  return updated;
}

export async function deleteAlbum(slug: string): Promise<void> {
  await deleteAlbumFromR2(slug);
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
