'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  formatUnits,
  fromHex,
  http,
  isAddress,
  parseUnits,
  toHex,
  type Address,
  type Hex,
} from 'viem';
import { custosGateAbi } from '@custos/sdk';

const COMMON_JURISDICTIONS = ['US', 'GB', 'DE', 'FR', 'CH', 'SG', 'AE', 'JP', 'CA', 'AU'];

interface Props {
  gate: Address;
  defaultToken: Address;
  chainId: number;
  rpcUrl: string;
}

export function PolicyEditor({ gate, defaultToken, chainId, rpcUrl }: Props) {
  const [token, setToken] = useState<string>(defaultToken);
  const [requireAccredited, setRequireAccredited] = useState(false);
  const [jurisdictions, setJurisdictions] = useState<string[]>([]);
  const [customJur, setCustomJur] = useState('');
  const [maxAmount, setMaxAmount] = useState(''); // human units, 6 decimals; empty = no cap
  const [active, setActive] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chain = defineChain({
    id: chainId,
    name: `custos-${chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });

  const loadPolicy = useCallback(async () => {
    if (!isAddress(token)) return;
    try {
      const client = createPublicClient({ chain, transport: http(rpcUrl) });
      const p = await client.readContract({ address: gate, abi: custosGateAbi, functionName: 'getPolicy', args: [token as Address] });
      setRequireAccredited(p.requireAccredited);
      setJurisdictions(p.allowedJurisdictions.map((j: Hex) => fromHex(j, 'string').replace(/\0/g, '')));
      setMaxAmount(p.maxTransferAmount === 0n ? '' : formatUnits(p.maxTransferAmount, 6));
      setActive(p.active);
      setStatus(p.active ? 'Loaded existing policy.' : 'No active policy for this token (fail closed: all transfers blocked).');
    } catch (err) {
      setStatus(`Could not load policy: ${err instanceof Error ? err.message : err}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, gate, rpcUrl]);

  useEffect(() => {
    void loadPolicy();
  }, [loadPolicy]);

  const toggleJurisdiction = (code: string) =>
    setJurisdictions((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const eth = (window as unknown as { ethereum?: unknown }).ethereum;
      if (!eth) throw new Error('No injected wallet found — install a wallet extension or use the demo issuer key.');
      const wallet = createWalletClient({ chain, transport: custom(eth as Parameters<typeof custom>[0]) });
      const [account] = await wallet.requestAddresses();
      if (!account) throw new Error('no account');
      const hash = await wallet.writeContract({
        address: gate,
        abi: custosGateAbi,
        functionName: 'setPolicy',
        args: [
          token as Address,
          {
            requireAccredited,
            allowedJurisdictions: jurisdictions.map((j) => toHex(j.toUpperCase(), { size: 2 })),
            maxTransferAmount: maxAmount.trim() === '' ? 0n : parseUnits(maxAmount, 6),
            active,
          },
        ],
        account,
      });
      setStatus(`Policy submitted: ${hash}`);
    } catch (err) {
      setStatus(`Failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Token address</label>
        <div className="mt-1 flex gap-2">
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 font-mono text-sm"
          />
          <button type="button" onClick={loadPolicy} className="rounded border border-zinc-300 px-3 text-sm hover:bg-zinc-100">
            Load
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4">
        <div>
          <div className="text-sm font-medium">Require accredited operators</div>
          <div className="text-xs text-zinc-500">Only agents whose owner passed the accreditation check may receive tokens</div>
        </div>
        <input type="checkbox" checked={requireAccredited} onChange={(e) => setRequireAccredited(e.target.checked)} className="h-5 w-5" />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="text-sm font-medium">Allowed jurisdictions</div>
        <div className="text-xs text-zinc-500">Empty = all jurisdictions permitted</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[...new Set([...COMMON_JURISDICTIONS, ...jurisdictions])].map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => toggleJurisdiction(code)}
              className={`rounded-full border px-3 py-1 text-xs ${
                jurisdictions.includes(code)
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-zinc-300 text-zinc-500 hover:bg-zinc-50'
              }`}
            >
              {code}
            </button>
          ))}
          <input
            value={customJur}
            onChange={(e) => setCustomJur(e.target.value.toUpperCase().slice(0, 2))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && /^[A-Z]{2}$/.test(customJur)) {
                toggleJurisdiction(customJur);
                setCustomJur('');
              }
            }}
            placeholder="+ code"
            className="w-20 rounded-full border border-dashed border-zinc-300 px-3 py-1 text-xs"
          />
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="text-sm font-medium">Max transfer amount (cTBILL)</div>
        <div className="text-xs text-zinc-500">Empty = no cap</div>
        <input
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
          placeholder="e.g. 5000"
          className="mt-2 w-48 rounded border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4">
        <div>
          <div className="text-sm font-medium">Policy active</div>
          <div className="text-xs text-zinc-500">Inactive fails closed: every transfer of this token is blocked</div>
        </div>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5" />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={busy || !isAddress(token)}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {busy ? 'Submitting…' : 'Save policy on-chain'}
        </button>
        {status && <span className="text-xs text-zinc-500">{status}</span>}
      </div>
    </div>
  );
}
