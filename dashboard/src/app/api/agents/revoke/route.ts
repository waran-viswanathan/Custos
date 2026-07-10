import { NextResponse, type NextRequest } from 'next/server';
import { apiPost } from '@/lib/api';

// Proxies the revoke to the Custos API so the admin bearer token stays server-side.
export async function POST(req: NextRequest) {
  const { wallet, reason } = (await req.json()) as { wallet: string; reason: string };
  if (!wallet || !reason) return NextResponse.json({ error: 'wallet and reason required' }, { status: 400 });
  try {
    const result = await apiPost(`/v1/agents/${wallet}/revoke`, { reason });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'revoke failed' }, { status: 502 });
  }
}
