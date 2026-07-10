import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { loadDeployments } from '@/lib/deployments';
import { Wallet } from '../wallet';

interface AuditItem {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  chainTxHash: string | null;
  createdAt: string;
  agent: { wallet: string; ownerName: string } | null;
}

const EVENT_TYPES = [
  'AGENT_SUBMITTED',
  'VERIFICATION_STARTED',
  'CHECK_COMPLETED',
  'VERIFICATION_REJECTED',
  'ATTESTATION_CREATED',
  'AGENT_REGISTERED_ONCHAIN',
  'AGENT_REVOKED',
  'CHAIN_TRANSFER_CHECKED',
  'CHAIN_AGENT_REGISTERED',
  'CHAIN_AGENT_REVOKED',
];

export const dynamic = 'force-dynamic';

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string; type?: string }>;
}) {
  const params = await searchParams;
  const d = loadDeployments();
  const query = new URLSearchParams({ pageSize: '100' });
  if (params.agent) query.set('agent', params.agent);
  if (params.type) query.set('type', params.type);
  const { items } = await apiGet<{ items: AuditItem[] }>(`/v1/audit?${query}`);

  const txLink = (hash: string) =>
    d.chainId === 84532 ? `https://sepolia.basescan.org/tx/${hash}` : undefined;

  return (
    <div>
      <form method="get" className="mb-4 flex gap-3 text-sm">
        <input
          name="agent"
          defaultValue={params.agent ?? ''}
          placeholder="Filter by agent wallet (0x…)"
          className="w-96 rounded border border-zinc-300 px-3 py-1.5 font-mono text-xs"
        />
        <select name="type" defaultValue={params.type ?? ''} className="rounded border border-zinc-300 px-2 py-1.5 text-xs">
          <option value="">All event types</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-100">
          Filter
        </button>
        {(params.agent || params.type) && (
          <Link href="/audit" className="self-center text-xs text-blue-600">
            clear
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3">Detail</th>
              <th className="px-4 py-3">Tx</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap px-4 py-2 text-xs text-zinc-500">
                  {new Date(e.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      e.type.startsWith('CHAIN_') ? 'bg-indigo-100 text-indigo-800' : 'bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    {e.type}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{e.agent ? <Wallet address={e.agent.wallet} /> : '—'}</td>
                <td className="max-w-md truncate px-4 py-2 font-mono text-xs text-zinc-500">
                  {JSON.stringify(e.payload)}
                </td>
                <td className="px-4 py-2 font-mono text-xs">
                  {e.chainTxHash ? (
                    txLink(e.chainTxHash) ? (
                      <a href={txLink(e.chainTxHash)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                        {e.chainTxHash.slice(0, 10)}…
                      </a>
                    ) : (
                      <span title={e.chainTxHash}>{e.chainTxHash.slice(0, 10)}…</span>
                    )
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                  No audit events match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
