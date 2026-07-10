import { NextResponse } from 'next/server';

export async function GET() {
  const nonce = crypto.randomUUID();
  const res = NextResponse.json({ nonce });
  res.cookies.set('custos_nonce', nonce, { httpOnly: true, sameSite: 'strict', maxAge: 300 });
  return res;
}
