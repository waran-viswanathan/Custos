'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RevokeButton({ wallet }: { wallet: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const revoke = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/agents/revoke', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ wallet, reason }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? 'revoke failed');
      return;
    }
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
      >
        Revoke
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold">Revoke agent credential</h2>
            <p className="mt-1 break-all font-mono text-xs text-zinc-500">{wallet}</p>
            <p className="mt-3 text-sm text-zinc-600">
              This revokes the on-chain registration and the EAS attestation. Gated tokens will reject the agent
              immediately. This cannot be undone — the agent must re-verify.
            </p>
            <input
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (required, recorded on the audit trail)"
              className="mt-4 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(false)} className="rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100">
                Cancel
              </button>
              <button
                type="button"
                disabled={!reason.trim() || busy}
                onClick={revoke}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? 'Revoking…' : 'Revoke credential'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
