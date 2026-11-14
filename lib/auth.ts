import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Passphrase gate for the dashboard.
 *
 * The passphrase lives only in the server env var DASHBOARD_PASSPHRASE. After a correct entry the browser
 * gets an httpOnly cookie holding an HMAC derived from the passphrase. Not the passphrase itself, and
 * not readable by page scripts. Changing the passphrase changes the HMAC, which signs out every device.
 */

export const SESSION_COOKIE = 'dash_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

function passphrase() {
  const p = process.env.DASHBOARD_PASSPHRASE;
  if (!p) throw new Error('DASHBOARD_PASSPHRASE is not set on the server.');
  return p;
}

export function sessionToken() {
  return createHmac('sha256', passphrase()).update('health-dashboard-session-v1').digest('hex');
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPassphrase(attempt: string) {
  return safeEqual(attempt, passphrase());
}

/** True if the request carries a valid session cookie. */
export function isAuthed(req: Request) {
  const cookie = req.headers.get('cookie') ?? '';
  const value = cookie
    .split(';')
    .map((c) => c.trim().split('='))
    .find(([k]) => k === SESSION_COOKIE)?.[1];
  return !!value && safeEqual(decodeURIComponent(value), sessionToken());
}
