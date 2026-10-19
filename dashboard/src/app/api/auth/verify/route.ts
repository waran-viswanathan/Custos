import { NextResponse, type NextRequest } from 'next/server';
import { getAddress, isAddress, isHex, verifyMessage } from 'viem';
import { createSessionValue } from '@/lib/auth';
import { loginMessage } from '@/lib/login-message';
import { hasIssuerRole } from '@/lib/issuer-auth';
import { consumeLoginChallenge } from '@/lib/api';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.address !== 'string' || !isAddress(body.address)
      || typeof body.signature !== 'string' || !isHex(body.signature) || body.signature.length > 2048) {
    return NextResponse.json({ error: 'invalid address or signature' }, { status: 400 });
  }
  const nonce = req.cookies.get('custos_nonce')?.value;
  if (!nonce || !/^[0-9a-f-]{36}$/i.test(nonce)) return NextResponse.json({ error: 'missing or invalid nonce' }, { status: 400 });
  const wallet = getAddress(body.address);
  const valid = await verifyMessage({ address: wallet, message: loginMessage(wallet, nonce), signature: body.signature }).catch(() => false);
  if (!valid) return NextResponse.json({ error: 'bad signature' }, { status: 401 });

  try {
    if (!await hasIssuerRole(wallet)) return NextResponse.json({ error: 'address lacks issuer authorization' }, { status: 403 });
    if (!await consumeLoginChallenge(nonce)) return NextResponse.json({ error: 'login challenge expired or already consumed' }, { status: 401 });
    const res = NextResponse.json({ ok: true, address: wallet });
    res.cookies.set('custos_session', await createSessionValue(wallet), {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 60 * 60 * 12, path: '/',
    });
    res.cookies.delete('custos_nonce');
    return res;
  } catch {
    return NextResponse.json({ error: 'sign-in temporarily unavailable' }, { status: 503 });
  }
}
