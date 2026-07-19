export const prerender = false;
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const siteId = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_ACCESS_TOKEN;

  if (!siteId || !token) {
    return json({ configured: false });
  }

  const since = url.searchParams.get('since');

  try {
    const res = await fetch(
      `https://api.netlify.com/api/v1/sites/${siteId}/deploys?per_page=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return json({ configured: true, state: 'unknown' });

    const [deploy] = await res.json();
    if (!deploy) return json({ configured: true, state: 'enqueued' });

    // Si le deploy existait avant qu'on ait cliqué "Publier", c'est l'ancien
    if (since && new Date(deploy.created_at) < new Date(since)) {
      return json({ configured: true, state: 'enqueued' });
    }

    return json({
      configured: true,
      state: deploy.state as string,
      errorMessage: deploy.error_message as string | null,
    });
  } catch {
    return json({ configured: true, state: 'unknown' });
  }
};

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
