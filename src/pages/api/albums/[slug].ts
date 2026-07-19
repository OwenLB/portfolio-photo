export const prerender = false;
import type { APIRoute } from 'astro';
import { getAlbumBySlug, updateAlbum, deleteAlbum } from '../../../lib/albums';
import { getAlbum, putAlbum } from '../../../lib/r2';

export const GET: APIRoute = async ({ params }) => {
  const { slug } = params;
  if (!slug) return new Response('Not found', { status: 404 });

  try {
    const album = await getAlbumBySlug(slug);
    if (!album) return new Response(JSON.stringify({ error: 'Album not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify(album), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch album' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  const { slug } = params;
  if (!slug) return new Response('Not found', { status: 404 });

  try {
    const body = await request.json();
    const updated = await updateAlbum(slug, body);
    if (!updated) return new Response(JSON.stringify({ error: 'Album not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to update album' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const { slug } = params;
  if (!slug) return new Response('Not found', { status: 404 });

  try {
    const album = await getAlbumBySlug(slug);
    if (!album) return new Response(JSON.stringify({ error: 'Album not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    await deleteAlbum(slug);
    return new Response(null, { status: 204 });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to delete album' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
