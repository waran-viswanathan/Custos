import { loadDeployments } from '@/lib/deployments';
import { PolicyEditor } from './policy-editor';

export const dynamic = 'force-dynamic';

export default function PoliciesPage() {
  const d = loadDeployments();
  return (
    <PolicyEditor
      gate={d.gate}
      defaultToken={d.tbill}
      chainId={d.chainId}
      rpcUrl={process.env.NEXT_PUBLIC_RPC_URL ?? 'http://127.0.0.1:8545'}
    />
  );
}
