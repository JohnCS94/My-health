import { NextResponse } from 'next/server';

import { isAuthed } from '@/lib/auth';
import { fetchRaw } from '@/lib/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    if (!isAuthed(req)) return NextResponse.json({ error: 'locked' }, { status: 401 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  const days = Math.min(400, Math.max(7, Number(new URL(req.url).searchParams.get('days')) || 30));
  try {
    return NextResponse.json(await fetchRaw(days), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
