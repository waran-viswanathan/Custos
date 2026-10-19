import { NextResponse } from 'next/server';
import { requestLoginChallenge } from '@/lib/api';

export async function GET() {
  try {
    const { nonce } = await requestLoginChallenge();
    const res = NextResponse.json({ nonce }, { headers: { 'Cache-Control': 'no-store' } });
    res.cookies.set('custos_nonce', nonce, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 300, path: '/' });
    return res;
  } catch {
    return NextResponse.json({ error: 'sign-in temporarily unavailable' }, { status: 503 });
  }
}
