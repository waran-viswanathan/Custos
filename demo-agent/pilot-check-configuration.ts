import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  createPublicClient,
  defineChain,
  getAddress,
  http,
  toHex,
  zeroHash,
  type Address,
  type Hex,
} from 'viem';
import {
  CustosActions,
  custosAgentMandateAbi,
  custosGateAbi,
  custosMarketManagerAbi,
  custosRegistryAbi,
  mandateScopeKey,
  type Deployments,
} from '@custos/sdk';

type PilotDeployments = Deployments & Required<Pick<Deployments, 'mandates' | 'actionAuthorizer' | 'marketManager' | 'settlementToken'>>;

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`missing ${name}`);
  return value;
};

const manifest = JSON.parse(readFileSync(required('DEPLOYMENTS_FILE'), 'utf8')) as PilotDeployments;
const configuration = JSON.parse(readFileSync(required('CONFIGURATION_EVIDENCE_FILE'), 'utf8')) as {
  poolId: Hex;
  actors: { principal: Address; agent: Address; exitRecipient: Address };
  credentials: Record<string, { address: Address; attestationUID: Hex }>;
  transactions: Record<string, Hex>;
};
assert.equal(manifest.chainId, 84532, 'manifest is not for Base Sepolia');

const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org';
const chain = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
});
const client = createPublicClient({ chain, transport: http(rpcUrl) });
const checks: string[] = [];
const pass = (label: string) => {
  checks.push(label);
  console.log(`PASS: ${label}`);
};

const actors = {
  principal: getAddress(configuration.actors.principal),
  agent: getAddress(configuration.actors.agent),
  issuer: getAddress(manifest.issuer),
  exitRecipient: getAddress(configuration.actors.exitRecipient),
};

for (const [label, address] of Object.entries(actors)) {
  const verified = await client.readContract({
    address: manifest.registry,
    abi: custosRegistryAbi,
    functionName: 'isVerified',
    args: [address],
  });
  assert.equal(verified, true, `${label} credential is not active`);
  const record = await client.readContract({
    address: manifest.registry,
    abi: custosRegistryAbi,
    functionName: 'getAgent',
    args: [address],
  });
  const credential = configuration.credentials[label];
  assert(credential, `missing saved ${label} credential evidence`);
  assert.equal(record.attestationUID.toLowerCase(), credential.attestationUID.toLowerCase());
  assert.equal(record.jurisdictionCode.toLowerCase(), toHex('US', { size: 2 }).toLowerCase());
  pass(`${label} credential active and matched`);
}

const transferPolicy = await client.readContract({
  address: manifest.gate,
  abi: custosGateAbi,
  functionName: 'getPolicy',
  args: [manifest.tbill],
});
assert.equal(transferPolicy.active, true);
assert.equal(transferPolicy.maxTransferAmount, 5_000n * 10n ** 6n);
assert.deepEqual(
  transferPolicy.allowedJurisdictions.map((value) => value.toLowerCase()),
  [toHex('US', { size: 2 }), toHex('GB', { size: 2 })].map((value) => value.toLowerCase()),
);
pass('restricted-token transfer policy matched');

const settlementApproved = await client.readContract({
  address: manifest.gate,
  abi: custosGateAbi,
  functionName: 'approvedSettlements',
  args: [manifest.tbill, manifest.marketManager],
});
assert.equal(settlementApproved, true);
pass('exact market manager settlement approved');

for (const [label, action] of [
  ['swap', CustosActions.SWAP],
  ['liquidity entry', CustosActions.LIQUIDITY_ENTRY],
  ['pool initialization', CustosActions.POOL_INITIALIZE],
] as const) {
  const actionPolicy = await client.readContract({
    address: manifest.gate,
    abi: custosGateAbi,
    functionName: 'getActionPolicy',
    args: [manifest.actionAuthorizer, action, manifest.tbill],
  });
  assert.equal(actionPolicy.active, true, `${label} policy inactive`);
  assert.equal(actionPolicy.maxAmount, 100_000n * 10n ** 6n, `${label} policy cap mismatch`);
  pass(`${label} action policy matched`);
}

const seedAmount = 50_000n * 10n ** 6n;
const pool = await client.readContract({
  address: manifest.marketManager,
  abi: custosMarketManagerAbi,
  functionName: 'getPool',
  args: [configuration.poolId],
});
assert.equal(pool.active, true);
assert.equal(pool.policyAsset.toLowerCase(), manifest.tbill.toLowerCase());
assert.equal(pool.reserve0, seedAmount);
assert.equal(pool.reserve1, seedAmount);
assert.equal(pool.totalShares, seedAmount);
const agentShares = await client.readContract({
  address: manifest.marketManager,
  abi: custosMarketManagerAbi,
  functionName: 'liquidityOf',
  args: [configuration.poolId, actors.agent],
});
assert.equal(agentShares, seedAmount - 1_000n);
pass('pool reserves and agent liquidity matched');

for (const mandate of [
  { label: 'swap', action: CustosActions.SWAP, maxPerAction: 5_000n * 10n ** 6n, maxTotal: 20_000n * 10n ** 6n, spent: 0n },
  { label: 'liquidity', action: CustosActions.LIQUIDITY_ENTRY, maxPerAction: seedAmount, maxTotal: seedAmount, spent: seedAmount },
] as const) {
  const scope = mandateScopeKey({
    agent: actors.agent,
    venue: manifest.marketManager,
    action: mandate.action,
    asset: manifest.tbill,
  });
  const mandateId = await client.readContract({
    address: manifest.mandates,
    abi: custosAgentMandateAbi,
    functionName: 'activeMandateFor',
    args: [scope],
  });
  assert.notEqual(mandateId, zeroHash, `${mandate.label} mandate missing`);
  const record = await client.readContract({
    address: manifest.mandates,
    abi: custosAgentMandateAbi,
    functionName: 'getMandate',
    args: [mandateId],
  });
  assert.equal(record.principal.toLowerCase(), actors.principal.toLowerCase());
  assert.equal(record.agent.toLowerCase(), actors.agent.toLowerCase());
  assert.equal(record.venue.toLowerCase(), manifest.marketManager.toLowerCase());
  assert.equal(record.active, true);
  assert.equal(record.maxPerAction, mandate.maxPerAction);
  assert.equal(record.maxTotal, mandate.maxTotal);
  assert.equal(record.spent, mandate.spent);
  assert(record.validUntil > BigInt(Math.floor(Date.now() / 1000)), `${mandate.label} mandate expired`);
  pass(`${mandate.label} mandate active and matched`);
}

for (const [label, hash] of Object.entries(configuration.transactions)) {
  const receipt = await client.getTransactionReceipt({ hash });
  assert.equal(receipt.status, 'success', `${label} transaction failed`);
}
pass(`${Object.keys(configuration.transactions).length} configuration receipts successful`);

const evidence = {
  chainId: 84532,
  deploymentBlock: manifest.deploymentBlock,
  checkedAt: new Date().toISOString(),
  poolId: configuration.poolId,
  checks,
  pool: {
    reserve0: pool.reserve0.toString(),
    reserve1: pool.reserve1.toString(),
    totalShares: pool.totalShares.toString(),
    agentShares: agentShares.toString(),
  },
};
writeFileSync(required('CONFIGURATION_CHECK_FILE'), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o644 });
console.log(`all ${checks.length} configuration checks passed`);
console.log(`configuration check evidence written to ${required('CONFIGURATION_CHECK_FILE')}`);
