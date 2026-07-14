import { loadDeployments } from '@/lib/deployments';
import { PolicyEditor } from './policy-editor';

export const dynamic = 'force-dynamic';

export default function PoliciesPage() {
  const d = loadDeployments();
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Issuer settlement policy</h1>
        <p className="mt-1 text-sm text-zinc-500">Configure holder eligibility and transfer caps enforced by CustosGate before token settlement.</p>
      </div>
      <PolicyEditor
        gate={d.gate}
        defaultToken={d.tbill}
        chainId={d.chainId}
        rpcUrl={process.env.NEXT_PUBLIC_RPC_URL ?? 'http://127.0.0.1:8545'}
      />
    </div>
  );
}
