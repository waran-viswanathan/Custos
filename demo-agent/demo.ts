/**
 * Custos end-to-end demo: "Atlas", an AI treasury agent, tries to hold
 * tokenized T-bills. Unverified → blocked. KYB'd + screened + attested →
 * allowed. Revoked → blocked again. Run via `pnpm demo` (starts the full
 * local stack) or directly with the stack already up: `pnpm --filter
 * @custos/demo-agent demo`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatUnits,
  http,
  parseUnits,
  toHex,
  type Address,
  type Hex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { Custos, custosGateAbi, mockTBillAbi, registrationMessage, type Deployments } from '@custos/sdk';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const RPC_URL = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
const ADMIN_TOKEN = process.env.ADMIN_BEARER_TOKEN ?? 'dev-admin-token-change-me';
// anvil default key #0 = deployer = issuer = MockTBill owner in the local stack
const ISSUER_KEY = (process.env.ISSUER_PRIVATE_KEY ??
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as Hex;

const here = path.dirname(fileURLToPath(import.meta.url));
const deployments = JSON.parse(
  readFileSync(process.env.DEPLOYMENTS_FILE ?? path.join(here, '../contracts/deployments/local.json'), 'utf8'),
) as Deployments;

const chain = defineChain({
  id: deployments.chainId,
  name: 'custos-local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});
const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
const issuer = createWalletClient({ account: privateKeyToAccount(ISSUER_KEY), chain, transport: http(RPC_URL) });

const custos = new Custos({
  apiUrl: API_URL,
  rpcUrl: RPC_URL,
  registryAddress: deployments.registry,
  gateAddress: deployments.gate,
});

const ok = (msg: string) => console.log(`  ✅ ${msg}`);
const blocked = (msg: string) => console.log(`  ❌ ${msg}`);
const step = (n: number, msg: string) => console.log(`\n[${n}] ${msg}`);
const cTBILL = (amount: bigint) => `${formatUnits(amount, 6)} cTBILL`;
const balanceOfAbi = [{
  type: 'function',
  name: 'balanceOf',
  stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const;

async function transferTBill(to: Address, amount: bigint): Promise<{ ok: boolean; reason?: string }> {
  try {
    const sim = await publicClient.simulateContract({
      address: deployments.tbill,
      abi: mockTBillAbi,
      functionName: 'transfer',
      args: [to, amount],
      account: issuer.account,
    });
    const hash = await issuer.writeContract(sim.request);
    // a tx can simulate clean on a lagging RPC replica yet revert at execution
    // (e.g. revocation landed in between) — the receipt status is the truth
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') return { ok: false, reason: 'REVERTED_AT_EXECUTION' };
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const reason =
      msg.match(/reverted with the following reason:\s*\n?\s*([A-Z_]+)/)?.[1] ??
      msg.match(/([A-Z][A-Z_]{3,})/)?.[1] ??
      'UNKNOWN';
    return { ok: false, reason };
  }
}

async function main() {
  console.log('━━━ Custos demo: an AI agent meets a compliance-gated T-bill ━━━');
  const issuerAddr = issuer.account.address;

  // ---- setup: issuer configures the token's transfer policy + mints supply
  step(1, 'Issuer configures on-chain policy for cTBILL (US/GB only, 5,000 cTBILL max per transfer)');
  const setPolicySim = await publicClient.simulateContract({
    address: deployments.gate,
    abi: custosGateAbi,
    functionName: 'setPolicy',
    args: [
      deployments.tbill,
      {
        requireAccredited: false,
        allowedJurisdictions: [toHex('US', { size: 2 }), toHex('GB', { size: 2 })],
        maxTransferAmount: parseUnits('5000', 6),
        active: true,
      },
    ],
    account: issuer.account,
  });
  await publicClient.waitForTransactionReceipt({ hash: await issuer.writeContract(setPolicySim.request) });

  const supply = await publicClient.readContract({
    address: deployments.tbill, abi: balanceOfAbi, functionName: 'balanceOf', args: [issuerAddr],
  });
  if (supply === 0n) {
    const mintSim = await publicClient.simulateContract({
      address: deployments.tbill, abi: mockTBillAbi, functionName: 'mint',
      args: [issuerAddr, parseUnits('1000000', 6)], account: issuer.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: await issuer.writeContract(mintSim.request) });
  }
  ok('policy active, issuer treasury funded');

  // ---- the agent is born
  const atlasKey = generatePrivateKey();
  const atlas = privateKeyToAccount(atlasKey);
  step(2, `"Atlas" (AI treasury agent) spins up with a fresh wallet ${atlas.address}`);
  ok('wallet created — zero history, zero credentials');

  step(3, `Issuer attempts to send Atlas ${cTBILL(parseUnits('1000', 6))} — before any verification`);
  // standalone pre-flight so the blocked check is on the audit trail (a
  // reverted transfer rolls back its own event)
  const preflight = await custos.isPermitted(atlas.address, deployments.tbill, parseUnits('1000', 6));
  const logSim = await publicClient.simulateContract({
    address: deployments.gate, abi: custosGateAbi, functionName: 'preflightAndLog',
    args: [atlas.address, deployments.tbill, parseUnits('1000', 6)], account: issuer.account,
  });
  await publicClient.waitForTransactionReceipt({ hash: await issuer.writeContract(logSim.request) });
  const attempt1 = await transferTBill(atlas.address, parseUnits('1000', 6));
  if (!attempt1.ok) blocked(`transfer reverted on-chain: ${attempt1.reason} (pre-flight said: ${preflight.reason})`);
  else throw new Error('expected the unverified transfer to revert!');

  step(4, 'Atlas registers with Custos (owner: Atlas Capital LLC, US) and undergoes KYB + sanctions screening');
  const registration = {
    wallet: atlas.address,
    owner: { name: 'Atlas Capital LLC', email: 'ops@atlascapital.example', entityType: 'COMPANY' as const },
    jurisdiction: 'US',
    erc8004TokenId: 7,
  };
  const challenge = await custos.challenge(atlas.address);
  const signature = await atlas.signMessage({ message: registrationMessage(registration, challenge) });
  await custos.register({ ...registration, nonce: challenge.nonce, domain: challenge.domain, signature });
  ok('submitted — verification pipeline running (KYB → sanctions → on-chain attestation)');
  const verified = await custos.waitForVerification(atlas.address, { timeoutMs: 120_000 });
  if (verified.status !== 'VERIFIED') throw new Error(`expected VERIFIED, got ${verified.status}`);
  ok(`VERIFIED — EAS attestation ${verified.attestationUID}`);

  step(5, 'Issuer retries the same transfer');
  const attempt2 = await transferTBill(atlas.address, parseUnits('1000', 6));
  if (!attempt2.ok) throw new Error(`expected success, got ${attempt2.reason}`);
  // retry the read: load-balanced public RPCs can serve a pre-transfer state
  let balance = 0n;
  for (let i = 0; i < 10 && balance === 0n; i++) {
    balance = await publicClient.readContract({
      address: deployments.tbill, abi: balanceOfAbi, functionName: 'balanceOf', args: [atlas.address],
    });
    if (balance === 0n) await new Promise((r) => setTimeout(r, 2000));
  }
  ok(`transfer succeeded — Atlas holds ${cTBILL(balance)}`);

  step(6, 'Compliance desk revokes Atlas (kill switch) via the Custos API');
  const revokeRes = await fetch(`${API_URL}/v1/agents/${atlas.address}/revoke`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify({ reason: 'demo: compliance revocation' }),
  });
  if (!revokeRes.ok) throw new Error(`revoke failed: ${revokeRes.status} ${await revokeRes.text()}`);
  ok('revoked on-chain (registry flag + EAS revocation)');

  step(7, 'Issuer attempts one more transfer to the revoked agent');
  const attempt3 = await transferTBill(atlas.address, parseUnits('500', 6));
  if (!attempt3.ok) blocked(`transfer reverted: ${attempt3.reason}`);
  else throw new Error('expected the revoked transfer to revert!');

  console.log('\n━━━ Demo complete: unverified ❌ → verified ✅ → revoked ❌ — the full credential lifecycle. ━━━\n');
}

main().catch((err) => {
  console.error('\n💥 demo failed:', err);
  process.exit(1);
});
