import { NextResponse } from 'next/server';

import { SESSION_COOKIE, SESSION_MAX_AGE, checkPassphrase, sessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let attempt = '';
  try {
    attempt = String(((await req.json()) as { passphrase?: unknown }).passphrase ?? '');
  } catch {
    // fall through with empty attempt
  }

  try {
    if (!checkPassphrase(attempt)) {
      // Slow down guessing.
      await new Promise((r) => setTimeout(r, 1000));
      return NextResponse.json({ error: 'Incorrect passphrase' }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, sessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
