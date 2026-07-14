'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginMessage } from '@/lib/auth';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const eth = (window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!eth) throw new Error('No injected wallet found.');
      const [address] = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      if (!address) throw new Error('no account');
      const { nonce } = (await (await fetch('/api/auth/nonce')).json()) as { nonce: string };
      const signature = await eth.request({
        method: 'personal_sign',
        params: [loginMessage(address, nonce), address],
      });
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address, signature }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'sign-in failed');
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-24 max-w-sm rounded-lg border border-zinc-200 bg-white p-8 text-center">
      <h1 className="text-lg font-semibold">Custos issuer control console</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Sign in with the wallet that holds <code className="font-mono text-xs">ISSUER_ROLE</code> on CustosGate.
      </p>
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="mt-6 w-full rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {busy ? 'Check your wallet…' : 'Sign-In With Ethereum'}
      </button>
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  );
}
