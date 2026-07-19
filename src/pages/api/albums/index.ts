export const prerender = false;
import type { APIRoute } from 'astro';
import { getAllAlbums, createAlbum, slugify } from '../../../lib/albums';
import { reorderAlbums } from '../../../lib/r2';

export const GET: APIRoute = async () => {
  try {
    const albums = await getAllAlbums();
    return new Response(JSON.stringify(albums), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch albums' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  try {
    const { slugs } = await request.json();
    if (!Array.isArray(slugs)) {
      return new Response(JSON.stringify({ error: 'slugs must be an array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    await reorderAlbums(slugs);
    return new Response(null, { status: 204 });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to reorder albums' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { title, description } = body;
    if (!title) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const slug = body.slug || slugify(title);
    const album = await createAlbum({ title, slug, description });
    return new Response(JSON.stringify(album), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to create album' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
