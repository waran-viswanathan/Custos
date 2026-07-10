import { apiGet } from '@/lib/api';
import { RevokeButton } from './revoke-button';
import { Wallet } from '../wallet';

interface AgentRow {
  id: string;
  wallet: string;
  ownerName: string;
  ownerEntityType: string;
  jurisdiction: string;
  status: string;
  statusReason: string | null;
  createdAt: string;
  updatedAt: string;
}

const badge: Record<string, string> = {
  VERIFIED: 'bg-emerald-100 text-emerald-800',
  PENDING: 'bg-amber-100 text-amber-800',
  IN_REVIEW: 'bg-amber-100 text-amber-800',
  REJECTED: 'bg-red-100 text-red-800',
  REVOKED: 'bg-zinc-200 text-zinc-700',
};

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const { items } = await apiGet<{ items: AgentRow[] }>('/v1/agents?pageSize=100');

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">Wallet</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Jurisdiction</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Verified</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {items.map((a) => (
            <tr key={a.id}>
              <td className="px-4 py-3 font-mono text-xs">
                <Wallet address={a.wallet} />
              </td>
              <td className="px-4 py-3">
                {a.ownerName}
                <span className="ml-2 text-xs text-zinc-400">{a.ownerEntityType}</span>
              </td>
              <td className="px-4 py-3">{a.jurisdiction}</td>
              <td className="px-4 py-3">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${badge[a.status] ?? ''}`}>{a.status}</span>
                {a.statusReason && <span className="ml-2 text-xs text-zinc-400">{a.statusReason}</span>}
              </td>
              <td className="px-4 py-3 text-xs text-zinc-500">
                {a.status === 'VERIFIED' ? new Date(a.updatedAt).toLocaleString() : '—'}
              </td>
              <td className="px-4 py-3 text-right">
                {a.status === 'VERIFIED' && <RevokeButton wallet={a.wallet} />}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                No agents registered yet — run `pnpm demo`.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
