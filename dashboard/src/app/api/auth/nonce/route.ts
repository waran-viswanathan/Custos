import { NextResponse } from 'next/server';

export async function GET() {
  const nonce = crypto.randomUUID();
  const res = NextResponse.json({ nonce });
  res.cookies.set('custos_nonce', nonce, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 300, path: '/' });
  return res;
}
