import { NextResponse } from 'next/server';

import { fetchRaw } from '@/lib/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const days = Math.min(400, Math.max(7, Number(new URL(req.url).searchParams.get('days')) || 30));
  try {
    return NextResponse.json(await fetchRaw(days), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
