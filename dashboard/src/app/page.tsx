import { apiGet } from '@/lib/api';

interface Stats {
  verifiedAgents: number;
  totalAgents: number;
  checksRun: number;
  transfersPermitted7d: number;
  transfersBlocked7d: number;
  actionDenialsObserved7d: number;
}

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  let stats: Stats | null = null;
  try {
    stats = await apiGet<Stats>('/v1/stats');
  } catch {
    // API offline
  }

  if (!stats) {
    return <p className="text-sm text-zinc-500">Custos API is unreachable — is the local stack running? (`pnpm demo`)</p>;
  }

  const tiles = [
    { label: 'Active verified agents', value: stats.verifiedAgents },
    { label: 'Total registered', value: stats.totalAgents },
    { label: 'Checks run', value: stats.checksRun },
    { label: 'Transfers permitted (7d)', value: stats.transfersPermitted7d },
    { label: 'Transfer denials observed (7d)', value: stats.transfersBlocked7d },
    { label: 'Action denials observed (7d)', value: stats.actionDenialsObserved7d },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Settlement control overview</h1>
        <p className="mt-1 text-sm text-zinc-500">Operator verification, autonomous-wallet eligibility, policy decisions, and observed denials.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="text-3xl font-semibold tabular-nums">{t.value}</div>
          <div className="mt-1 text-xs text-zinc-500">{t.label}</div>
        </div>
      ))}
      </div>
    </div>
  );
}
