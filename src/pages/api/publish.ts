export const prerender = false;
import type { APIRoute } from 'astro';

export const POST: APIRoute = async () => {
  const buildHook = process.env.CF_PAGES_BUILD_HOOK;

  if (!buildHook) {
    return new Response(
      JSON.stringify({
        success: true,
        mock: true,
        message: 'Build hook not configured — mock publish',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const res = await fetch(buildHook, { method: 'POST' });
    if (!res.ok) throw new Error(`Build hook returned ${res.status}`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to trigger build' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
