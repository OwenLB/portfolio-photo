export const prerender = false;

import type { APIRoute } from 'astro';

async function getExpectedToken(password: string): Promise<string> {
  const data = new TextEncoder().encode('admin_session:' + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const password = formData.get('password') as string;
  const adminPassword = import.meta.env.ADMIN_PASSWORD;

  if (!adminPassword || !password || password !== adminPassword) {
    return redirect('/admin/login?error=1');
  }

  const token = await getExpectedToken(adminPassword);

  cookies.set('admin_session', token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return redirect('/admin');
};
