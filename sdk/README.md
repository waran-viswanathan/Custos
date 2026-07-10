# @custos/sdk

TypeScript SDK for Custos — compliance credentials for AI agents transacting in tokenized RWAs.

## Quickstart

```ts
import { Custos } from '@custos/sdk';
import deployments from '../contracts/deployments/local.json';

const custos = new Custos({
  apiUrl: 'http://localhost:4000',
  rpcUrl: 'http://127.0.0.1:8545',
  registryAddress: deployments.registry,
  gateAddress: deployments.gate,
});

// 1. Submit the agent for KYB + sanctions verification
await custos.register({
  wallet: agentWallet,
  owner: { name: 'Atlas Capital LLC', email: 'ops@atlas.example', entityType: 'COMPANY' },
  jurisdiction: 'US',
});

// 2. Wait for the verification pipeline (KYB → sanctions → on-chain attestation)
const result = await custos.waitForVerification(agentWallet);
console.log(result.status); // 'VERIFIED'

// 3. Pre-flight any transfer against the issuer's on-chain policy
const { allowed, reason } = await custos.isPermitted(agentWallet, tbillAddress, 1_000_000_000n);
if (!allowed) throw new Error(`blocked: ${reason}`);
```

Also exported: `custosRegistryAbi`, `custosGateAbi`, `mockTBillAbi`, `mockEasAbi` (typed `as const` for viem), and the `Deployments` interface matching `contracts/deployments/*.json`.
