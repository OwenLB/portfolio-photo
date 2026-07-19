import { defineMiddleware } from 'astro:middleware';

const COOKIE_NAME = 'admin_session';
const PUBLIC_PATHS = ['/admin/login', '/api/admin-login'];

async function getExpectedToken(password: string): Promise<string> {
  const data = new TextEncoder().encode('admin_session:' + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (!pathname.startsWith('/admin') || PUBLIC_PATHS.includes(pathname)) {
    return next();
  }

  const password = import.meta.env.ADMIN_PASSWORD;

  // Pas de mot de passe configuré → accès libre (dev local)
  if (!password) return next();

  const cookie = context.cookies.get(COOKIE_NAME);
  if (!cookie) return context.redirect('/admin/login');

  const expected = await getExpectedToken(password);
  if (!timingSafeEqual(cookie.value, expected)) {
    return context.redirect('/admin/login');
  }

  return next();
});
