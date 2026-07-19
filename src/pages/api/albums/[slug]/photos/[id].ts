export const prerender = false;
import type { APIRoute } from 'astro';
import { getAlbumBySlug } from '../../../../../lib/albums';
import { putAlbum, deletePhoto } from '../../../../../lib/r2';

export const DELETE: APIRoute = async ({ params }) => {
  const { slug, id } = params;
  if (!slug || !id)
    return new Response('Not found', { status: 404 });

  try {
    const album = await getAlbumBySlug(slug);
    if (!album)
      return new Response(JSON.stringify({ error: 'Album not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });

    await deletePhoto(slug, id);
    album.photos = album.photos.filter((p) => p.id !== id);
    album.photos.forEach((p, i) => { p.order = i; });
    await putAlbum(album);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to delete photo' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
