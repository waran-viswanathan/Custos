import { readFileSync, writeFileSync } from 'node:fs';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeAbiParameters,
  getAddress,
  http,
  maxUint256,
  parseEventLogs,
  toHex,
  zeroHash,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import {
  CustosActions,
  actionIntentTypedData,
  custosActionAuthorizerAbi,
  custosAgentMandateAbi,
  custosGateAbi,
  custosMarketManagerAbi,
  custosRegistryAbi,
  mandateScopeKey,
  mockEasAbi,
  mockTBillAbi,
  mockUsdAbi,
  type ActionIntent,
  type Deployments,
} from '@custos/sdk';

type PilotDeployments = Deployments & Required<Pick<Deployments, 'mandates' | 'actionAuthorizer' | 'marketManager' | 'settlementToken'>>;

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`missing ${name}`);
  return value;
};

const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org';
const manifestPath = required('DEPLOYMENTS_FILE');
const evidencePath = required('CONFIGURATION_EVIDENCE_FILE');
const deployments = JSON.parse(readFileSync(manifestPath, 'utf8')) as PilotDeployments;
if (deployments.chainId !== 84532) throw new Error(`expected Base Sepolia, got ${deployments.chainId}`);

const chain = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
});
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

const account = (name: string) => privateKeyToAccount(required(name) as Hex);
const attester = account('ATTESTER_PRIVATE_KEY');
const issuer = account('ISSUER_PRIVATE_KEY');
const principal = account('PRINCIPAL_PRIVATE_KEY');
const agent = account('AGENT_PRIVATE_KEY');

const wallet = (signer: PrivateKeyAccount) => createWalletClient({ account: signer, chain, transport: http(rpcUrl) });
const wallets = new Map<string, ReturnType<typeof wallet>>([
  [attester.address.toLowerCase(), wallet(attester)],
  [issuer.address.toLowerCase(), wallet(issuer)],
  [principal.address.toLowerCase(), wallet(principal)],
  [agent.address.toLowerCase(), wallet(agent)],
]);
const nextNonces = new Map<string, number>();
const transactions: Record<string, Hex> = {};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function nextNonce(signer: PrivateKeyAccount): Promise<number> {
  const key = signer.address.toLowerCase();
  const existing = nextNonces.get(key);
  if (existing !== undefined) {
    nextNonces.set(key, existing + 1);
    return existing;
  }
  const nonce = await publicClient.getTransactionCount({ address: signer.address, blockTag: 'pending' });
  nextNonces.set(key, nonce + 1);
  return nonce;
}

async function send(
  label: string,
  signer: PrivateKeyAccount,
  request: { address: Address; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] },
) {
  const nonce = await nextNonce(signer);
  let simulation: any;
  for (let attempt = 1; ; attempt++) {
    try {
      simulation = await publicClient.simulateContract({ ...request, account: signer, nonce } as any);
      break;
    } catch (error) {
      if (attempt >= 6) throw error;
      await delay(attempt * 1_500);
    }
  }
  const client = wallets.get(signer.address.toLowerCase());
  if (!client) throw new Error(`no wallet client for ${signer.address}`);
  const hash = await client.writeContract({ ...simulation.request, nonce } as any);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  if (receipt.status !== 'success') throw new Error(`${label} reverted: ${hash}`);
  transactions[label] = hash;
  console.log(`PASS: ${label} ${hash}`);
  return { hash, receipt };
}

const jurisdiction = toHex('US', { size: 2 });
const credentialSpecs = [
  { label: 'principal', address: getAddress(required('PRINCIPAL_ADDRESS')), tokenId: 1001n, accredited: true },
  { label: 'agent', address: getAddress(required('AGENT_ADDRESS')), tokenId: 1002n, accredited: false },
  { label: 'issuer', address: getAddress(required('ISSUER_ADDRESS')), tokenId: 1003n, accredited: true },
  { label: 'exitRecipient', address: getAddress(required('EXIT_RECIPIENT_ADDRESS')), tokenId: 1004n, accredited: true },
];
const credentials: Record<string, { address: Address; attestationUID: Hex; tokenId: string }> = {};

async function ensureCredential(spec: (typeof credentialSpecs)[number]) {
  const existing = await publicClient.readContract({
    address: deployments.registry,
    abi: custosRegistryAbi,
    functionName: 'getAgent',
    args: [spec.address],
  });
  const verified = await publicClient.readContract({
    address: deployments.registry,
    abi: custosRegistryAbi,
    functionName: 'isVerified',
    args: [spec.address],
  });
  if (verified) {
    credentials[spec.label] = { address: spec.address, attestationUID: existing.attestationUID, tokenId: spec.tokenId.toString() };
    console.log(`SKIP: ${spec.label} credential already active`);
    return;
  }

  const data = encodeAbiParameters(
    [{ type: 'bool' }, { type: 'bytes2' }, { type: 'bool' }, { type: 'uint256' }],
    [true, jurisdiction, spec.accredited, spec.tokenId],
  );
  const attested = await send(`attest.${spec.label}`, attester, {
    address: deployments.eas,
    abi: mockEasAbi,
    functionName: 'attest',
    args: [{
      schema: deployments.schemaUID,
      data: { recipient: spec.address, expirationTime: 0n, revocable: true, refUID: zeroHash, data, value: 0n },
    }],
  });
  const event = parseEventLogs({ abi: mockEasAbi, eventName: 'Attested', logs: attested.receipt.logs })
    .find((log) => log.args.recipient?.toLowerCase() === spec.address.toLowerCase());
  if (!event) throw new Error(`missing Attested event for ${spec.label}`);
  const uid = event.args.uid as Hex;

  await send(`register.${spec.label}`, attester, {
    address: deployments.registry,
    abi: custosRegistryAbi,
    functionName: 'registerAgent',
    args: [spec.address, spec.tokenId, uid],
  });
  credentials[spec.label] = { address: spec.address, attestationUID: uid, tokenId: spec.tokenId.toString() };
}

for (const spec of credentialSpecs) await ensureCredential(spec);

const allowedJurisdictions = [toHex('US', { size: 2 }), toHex('GB', { size: 2 })];
const policy = { requireAccredited: false, allowedJurisdictions, maxTransferAmount: 5_000n * 10n ** 6n, active: true };
await send('policy.transfer', issuer, {
  address: deployments.gate,
  abi: custosGateAbi,
  functionName: 'setPolicy',
  args: [deployments.tbill, policy],
});
await send('policy.settlement', issuer, {
  address: deployments.gate,
  abi: custosGateAbi,
  functionName: 'setSettlement',
  args: [deployments.tbill, deployments.marketManager, true],
});

const actionPolicy = { requireAccredited: false, allowedJurisdictions, maxAmount: 100_000n * 10n ** 6n, active: true };
for (const [label, action] of [
  ['swap', CustosActions.SWAP],
  ['liquidityEntry', CustosActions.LIQUIDITY_ENTRY],
  ['poolInitialize', CustosActions.POOL_INITIALIZE],
] as const) {
  await send(`policy.${label}`, issuer, {
    address: deployments.gate,
    abi: custosGateAbi,
    functionName: 'setActionPolicy',
    args: [deployments.actionAuthorizer, action, deployments.tbill, actionPolicy],
  });
}

const feeBps = 30;
const [token0, token1] = BigInt(deployments.tbill) < BigInt(deployments.settlementToken)
  ? [deployments.tbill, deployments.settlementToken]
  : [deployments.settlementToken, deployments.tbill];
const poolId = await publicClient.readContract({
  address: deployments.marketManager,
  abi: custosMarketManagerAbi,
  functionName: 'getPoolId',
  args: [token0, token1, deployments.tbill, feeBps],
});
let poolExists = true;
try {
  await publicClient.readContract({ address: deployments.marketManager, abi: custosMarketManagerAbi, functionName: 'getPool', args: [poolId] });
} catch {
  poolExists = false;
}
if (!poolExists) {
  await send('pool.create', issuer, {
    address: deployments.marketManager,
    abi: custosMarketManagerAbi,
    functionName: 'createPool',
    args: [deployments.tbill, deployments.settlementToken, deployments.tbill, feeBps],
  });
} else {
  console.log('SKIP: pool already exists');
}

const seedAmount = 50_000n * 10n ** 6n;
for (const [label, address, abi] of [
  ['tbill', deployments.tbill, mockTBillAbi],
  ['settlement', deployments.settlementToken, mockUsdAbi],
] as const) {
  const balance = await publicClient.readContract({ address, abi, functionName: 'balanceOf', args: [agent.address] });
  if (balance < seedAmount) {
    await send(`mint.${label}`, issuer, {
      address,
      abi,
      functionName: 'mint',
      args: [agent.address, seedAmount - balance],
    });
  } else {
    console.log(`SKIP: ${label} seed balance already funded`);
  }
}

const now = BigInt(Math.floor(Date.now() / 1000));
const mandates = [
  { label: 'swap', action: CustosActions.SWAP, maxPerAction: 5_000n * 10n ** 6n, maxTotal: 20_000n * 10n ** 6n },
  { label: 'liquidity', action: CustosActions.LIQUIDITY_ENTRY, maxPerAction: seedAmount, maxTotal: seedAmount },
];
for (const mandate of mandates) {
  const scope = mandateScopeKey({ agent: agent.address, venue: deployments.marketManager, action: mandate.action, asset: deployments.tbill });
  const currentId = await publicClient.readContract({
    address: deployments.mandates,
    abi: custosAgentMandateAbi,
    functionName: 'activeMandateFor',
    args: [scope],
  });
  if (currentId !== zeroHash) {
    const current = await publicClient.readContract({
      address: deployments.mandates,
      abi: custosAgentMandateAbi,
      functionName: 'getMandate',
      args: [currentId],
    });
    if (current.active && current.validUntil > now) {
      console.log(`SKIP: ${mandate.label} mandate already active`);
      continue;
    }
  }
  await send(`mandate.${mandate.label}`, principal, {
    address: deployments.mandates,
    abi: custosAgentMandateAbi,
    functionName: 'grantMandate',
    args: [
      agent.address,
      deployments.marketManager,
      mandate.action,
      deployments.tbill,
      mandate.maxPerAction,
      mandate.maxTotal,
      now - 60n,
      now + 7n * 24n * 60n * 60n,
    ],
  });
}

for (const [label, address, abi] of [
  ['tbill', deployments.tbill, mockTBillAbi],
  ['settlement', deployments.settlementToken, mockUsdAbi],
] as const) {
  const allowance = await publicClient.readContract({
    address,
    abi,
    functionName: 'allowance',
    args: [agent.address, deployments.marketManager],
  });
  if (allowance < seedAmount) {
    await send(`approve.${label}`, agent, {
      address,
      abi,
      functionName: 'approve',
      args: [deployments.marketManager, maxUint256],
    });
  }
}

const existingShares = await publicClient.readContract({
  address: deployments.marketManager,
  abi: custosMarketManagerAbi,
  functionName: 'liquidityOf',
  args: [poolId, agent.address],
});
if (existingShares === 0n) {
  const amount0 = seedAmount;
  const amount1 = seedAmount;
  const contextHash = await publicClient.readContract({
    address: deployments.marketManager,
    abi: custosMarketManagerAbi,
    functionName: 'liquidityContext',
    args: [poolId, amount0, amount1, 0n],
  });
  const intent: ActionIntent = {
    agent: agent.address,
    venue: deployments.marketManager,
    executor: deployments.marketManager,
    action: CustosActions.LIQUIDITY_ENTRY,
    asset: deployments.tbill,
    amount: seedAmount,
    recipient: agent.address,
    nonce: await publicClient.readContract({
      address: deployments.actionAuthorizer,
      abi: custosActionAuthorizerAbi,
      functionName: 'nonces',
      args: [agent.address],
    }),
    deadline: now + 60n * 60n,
    contextHash,
  };
  const signature = await agent.signTypedData(actionIntentTypedData(84532, deployments.actionAuthorizer, intent));
  await send('liquidity.seed', agent, {
    address: deployments.marketManager,
    abi: custosMarketManagerAbi,
    functionName: 'addLiquidity',
    args: [poolId, amount0, amount1, 0n, intent, signature],
  });
} else {
  console.log('SKIP: pool already seeded');
}

const readPool = () => publicClient.readContract({
  address: deployments.marketManager,
  abi: custosMarketManagerAbi,
  functionName: 'getPool',
  args: [poolId],
});
let finalPool: Awaited<ReturnType<typeof readPool>> | undefined;
for (let attempt = 1; attempt <= 10; attempt++) {
  const snapshot = await readPool();
  if (snapshot.reserve0 > 0n && snapshot.reserve1 > 0n && snapshot.totalShares > 0n) {
    finalPool = snapshot;
    break;
  }
  await delay(attempt * 1_000);
}
if (!finalPool) throw new Error('seed transaction succeeded but the RPC did not expose the updated pool state');
const evidence = {
  chainId: 84532,
  deploymentBlock: deployments.deploymentBlock,
  configuredAt: new Date().toISOString(),
  poolId,
  feeBps,
  actors: {
    principal: principal.address,
    agent: agent.address,
    exitRecipient: getAddress(required('EXIT_RECIPIENT_ADDRESS')),
  },
  credentials,
  policy: {
    jurisdictions: ['US', 'GB'],
    maxTransferAmount: policy.maxTransferAmount.toString(),
    actionMaxAmount: actionPolicy.maxAmount.toString(),
  },
  pool: {
    token0: finalPool.token0,
    token1: finalPool.token1,
    policyAsset: finalPool.policyAsset,
    reserve0: finalPool.reserve0.toString(),
    reserve1: finalPool.reserve1.toString(),
    totalShares: finalPool.totalShares.toString(),
    active: finalPool.active,
  },
  transactions,
};
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o644 });
console.log(`configuration evidence written to ${evidencePath}`);
