export const prerender = false;
import type { APIRoute } from 'astro';
import { generatePresignedUrl } from '../../lib/r2';

export const GET: APIRoute = async ({ url }) => {
  const album = url.searchParams.get('album');
  const filename = url.searchParams.get('filename');
  const contentType = url.searchParams.get('contentType') ?? undefined;

  if (!album || !filename) {
    return new Response(JSON.stringify({ error: 'Missing album or filename' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Presigned PUT URL for the original file
    const presignedUrl = await generatePresignedUrl(album, filename, contentType);

    // Public CDN URL where the original will be accessible after upload.
    // Cloudflare Image Resizing will serve resized variants on demand via /cdn-cgi/image/…
    const publicUrl = process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL}/photos/${album}/${filename}`
      : null;

    return new Response(
      JSON.stringify({ url: presignedUrl, publicUrl }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[presign] Failed to generate presigned URL:', err);
    return new Response(JSON.stringify({ error: 'Failed to generate presigned URL' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
