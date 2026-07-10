import { apiGet } from '@/lib/api';

interface Stats {
  verifiedAgents: number;
  totalAgents: number;
  checksRun: number;
  transfersPermitted7d: number;
  transfersBlocked7d: number;
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
    { label: 'Verified agents', value: stats.verifiedAgents },
    { label: 'Total registered', value: stats.totalAgents },
    { label: 'Checks run', value: stats.checksRun },
    { label: 'Transfers permitted (7d)', value: stats.transfersPermitted7d },
    { label: 'Transfers blocked (7d)', value: stats.transfersBlocked7d },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="text-3xl font-semibold tabular-nums">{t.value}</div>
          <div className="mt-1 text-xs text-zinc-500">{t.label}</div>
        </div>
      ))}
    </div>
  );
}
