import { NextResponse, type NextRequest } from 'next/server';
import { createPublicClient, http, getAddress, keccak256, toBytes, verifyMessage } from 'viem';
import { custosGateAbi } from '@custos/sdk';
import { createSessionValue, loginMessage } from '@/lib/auth';
import { loadDeployments } from '@/lib/deployments';

const ISSUER_ROLE = keccak256(toBytes('ISSUER_ROLE'));
const ADMIN_ROLE = `0x${'0'.repeat(64)}` as const;

export async function POST(req: NextRequest) {
  const { address, signature } = (await req.json()) as { address: string; signature: `0x${string}` };
  const nonce = req.cookies.get('custos_nonce')?.value;
  if (!nonce) return NextResponse.json({ error: 'missing nonce' }, { status: 400 });

  const wallet = getAddress(address);
  const valid = await verifyMessage({ address: wallet, message: loginMessage(wallet, nonce), signature });
  if (!valid) return NextResponse.json({ error: 'bad signature' }, { status: 401 });

  const d = loadDeployments();
  const client = createPublicClient({ transport: http(process.env.NEXT_PUBLIC_RPC_URL ?? 'http://127.0.0.1:8545') });
  const [isIssuer, isAdmin] = await Promise.all([
    client.readContract({ address: d.gate, abi: custosGateAbi, functionName: 'hasRole', args: [ISSUER_ROLE, wallet] }),
    client.readContract({ address: d.gate, abi: custosGateAbi, functionName: 'hasRole', args: [ADMIN_ROLE, wallet] }),
  ]);
  if (!isIssuer && !isAdmin) return NextResponse.json({ error: 'address lacks ISSUER_ROLE' }, { status: 403 });

  const res = NextResponse.json({ ok: true, address: wallet });
  res.cookies.set('custos_session', await createSessionValue(wallet), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 12,
  });
  res.cookies.delete('custos_nonce');
  return res;
}
