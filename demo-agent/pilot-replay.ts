import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
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
  mockTBillAbi,
  mockUsdAbi,
  type ActionIntent,
  type Deployments,
} from '@custos/sdk';

type PilotDeployments = Deployments & Required<Pick<Deployments, 'operatorBinding' | 'mandates' | 'actionAuthorizer' | 'marketManager' | 'settlementToken'>>;
type StepResult = { hash?: Hex; status?: 'success' | 'reverted'; details?: Record<string, string | number | boolean> };
type ReplayEvidence = {
  chainId: number;
  deploymentBlock: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  poolId: Hex;
  steps: Record<string, StepResult>;
  finalState?: Record<string, string | number | boolean>;
  auditLogs?: unknown[];
};

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`missing ${name}`);
  return value;
};

const manifest = JSON.parse(readFileSync(required('DEPLOYMENTS_FILE'), 'utf8')) as PilotDeployments;
const configuration = JSON.parse(readFileSync(required('CONFIGURATION_EVIDENCE_FILE'), 'utf8')) as {
  poolId: Hex;
  actors: { principal: Address; agent: Address; exitRecipient: Address };
};
assert.equal(manifest.chainId, 84532, 'manifest is not for Base Sepolia');

const evidencePath = required('REPLAY_EVIDENCE_FILE');
const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org';
const chain = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
});
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
const account = (name: string) => privateKeyToAccount(required(name) as Hex);
const admin = account('ADMIN_PRIVATE_KEY');
const attester = account('ATTESTER_PRIVATE_KEY');
const issuer = account('ISSUER_PRIVATE_KEY');
const principal = account('PRINCIPAL_PRIVATE_KEY');
const agent = account('AGENT_PRIVATE_KEY');
const exitRecipient = getAddress(required('EXIT_RECIPIENT_ADDRESS'));

assert.equal(admin.address, getAddress(required('ADMIN_ADDRESS')));
assert.equal(attester.address, getAddress(required('ATTESTER_ADDRESS')));
assert.equal(issuer.address, getAddress(required('ISSUER_ADDRESS')));
assert.equal(principal.address, getAddress(configuration.actors.principal));
assert.equal(agent.address, getAddress(configuration.actors.agent));
assert.equal(exitRecipient, getAddress(configuration.actors.exitRecipient));

const walletFor = (signer: PrivateKeyAccount) => createWalletClient({ account: signer, chain, transport: http(rpcUrl) });
const wallets = new Map<string, ReturnType<typeof walletFor>>(
  [admin, attester, issuer, principal, agent].map((signer) => [signer.address.toLowerCase(), walletFor(signer)]),
);
const txNonces = new Map<string, number>();
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function eventually<T>(label: string, read: () => Promise<T>, accept: (value: T) => boolean): Promise<T> {
  let last: T | undefined;
  for (let attempt = 1; attempt <= 12; attempt++) {
    last = await read();
    if (accept(last)) return last;
    await delay(attempt * 750);
  }
  throw new Error(`RPC did not expose expected state: ${label}; last=${json(last)}`);
}

const replay: ReplayEvidence = existsSync(evidencePath)
  ? JSON.parse(readFileSync(evidencePath, 'utf8')) as ReplayEvidence
  : {
      chainId: 84532,
      deploymentBlock: manifest.deploymentBlock,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      poolId: configuration.poolId,
      steps: {},
    };

const json = (value: unknown) => JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item, 2);
const save = () => {
  replay.updatedAt = new Date().toISOString();
  writeFileSync(evidencePath, `${json(replay)}\n`, { mode: 0o644 });
};

async function runStep(label: string, operation: () => Promise<StepResult>) {
  if (replay.steps[label]) {
    console.log(`SKIP: ${label}`);
    return replay.steps[label];
  }
  const result = await operation();
  replay.steps[label] = result;
  save();
  console.log(`PASS: ${label}${result.hash ? ` ${result.hash}` : ''}`);
  return result;
}

async function nextTxNonce(signer: PrivateKeyAccount) {
  const key = signer.address.toLowerCase();
  const cached = txNonces.get(key);
  if (cached !== undefined) {
    txNonces.set(key, cached + 1);
    return cached;
  }
  const nonce = await publicClient.getTransactionCount({ address: signer.address, blockTag: 'pending' });
  txNonces.set(key, nonce + 1);
  return nonce;
}

async function broadcast(
  signer: PrivateKeyAccount,
  request: { address: Address; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] },
  expected: 'success' | 'reverted',
) {
  const client = wallets.get(signer.address.toLowerCase());
  if (!client) throw new Error(`no wallet for ${signer.address}`);
  const nonce = await nextTxNonce(signer);
  let hash: Hex;
  if (expected === 'success') {
    let simulation: any;
    for (let attempt = 1; attempt <= 8; attempt++) {
      try {
        simulation = await publicClient.simulateContract({ ...request, account: signer, nonce } as any);
        break;
      } catch (error) {
        if (attempt === 8) throw error;
        await delay(attempt * 750);
      }
    }
    hash = await client.writeContract({ ...simulation.request, nonce } as any);
  } else {
    hash = await client.writeContract({ ...request, nonce, gas: 1_500_000n } as any);
  }
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  assert.equal(receipt.status, expected, `transaction ${hash} was ${receipt.status}, expected ${expected}`);
  return { hash, status: expected } as const;
}

async function latestTimestamp() {
  return (await publicClient.getBlock({ blockTag: 'latest' })).timestamp;
}

async function authorizerNonce(address: Address) {
  return publicClient.readContract({
    address: manifest.actionAuthorizer,
    abi: custosActionAuthorizerAbi,
    functionName: 'nonces',
    args: [address],
  });
}

async function swapCall(signer: PrivateKeyAccount, amountIn: bigint, recipient: Address = signer.address, minOut = 0n) {
  const params = { poolId: configuration.poolId, tokenIn: manifest.tbill, amountIn, minOut, recipient };
  const contextHash = await publicClient.readContract({
    address: manifest.marketManager,
    abi: custosMarketManagerAbi,
    functionName: 'swapContext',
    args: [params.poolId, params.tokenIn, params.amountIn, params.minOut],
  });
  const intent: ActionIntent = {
    agent: signer.address,
    venue: manifest.marketManager,
    executor: manifest.marketManager,
    action: CustosActions.SWAP,
    asset: manifest.tbill,
    amount: amountIn,
    recipient,
    nonce: await authorizerNonce(signer.address),
    deadline: await latestTimestamp() + 600n,
    contextHash,
  };
  const signature = await signer.signTypedData(actionIntentTypedData(84532, manifest.actionAuthorizer, intent));
  return { params, intent, signature };
}

const swapRequest = (call: Awaited<ReturnType<typeof swapCall>>) => ({
  address: manifest.marketManager,
  abi: custosMarketManagerAbi,
  functionName: 'swapExactInput',
  args: [call.params, call.intent, call.signature],
});

async function activeSwapMandate() {
  const scope = mandateScopeKey({
    agent: agent.address,
    venue: manifest.marketManager,
    action: CustosActions.SWAP,
    asset: manifest.tbill,
  });
  const id = await publicClient.readContract({
    address: manifest.mandates,
    abi: custosAgentMandateAbi,
    functionName: 'activeMandateFor',
    args: [scope],
  });
  const record = await publicClient.readContract({
    address: manifest.mandates,
    abi: custosAgentMandateAbi,
    functionName: 'getMandate',
    args: [id],
  });
  return { id, record };
}

async function grantSwapMandate(maxPerAction: bigint, maxTotal: bigint, validUntil: bigint) {
  const now = await latestTimestamp();
  const previous = await activeSwapMandate();
  const result = await broadcast(principal, {
    address: manifest.mandates,
    abi: custosAgentMandateAbi,
    functionName: 'grantMandate',
    args: [{
      agent: agent.address,
      venue: manifest.marketManager,
      action: CustosActions.SWAP,
      asset: manifest.tbill,
      maxPerAction,
      maxTotal,
      validAfter: now - 1n,
      validUntil,
    }],
  }, 'success');
  await eventually(
    'new swap mandate',
    activeSwapMandate,
    (current) => current.id !== previous.id && current.record.active
      && current.record.maxPerAction === maxPerAction && current.record.maxTotal === maxTotal,
  );
  return result;
}

async function revokeActiveSwapMandate() {
  const current = await activeSwapMandate();
  const result = await broadcast(principal, {
    address: manifest.mandates,
    abi: custosAgentMandateAbi,
    functionName: 'revokeMandate',
    args: [current.id],
  }, 'success');
  await eventually(
    'revoked swap mandate',
    () => publicClient.readContract({
      address: manifest.mandates,
      abi: custosAgentMandateAbi,
      functionName: 'getMandate',
      args: [current.id],
    }),
    (record) => !record.active,
  );
  return result;
}

async function expectSwapDenied(signer: PrivateKeyAccount, amount: bigint) {
  const nonceBefore = await authorizerNonce(signer.address);
  const poolBefore = await publicClient.readContract({
    address: manifest.marketManager,
    abi: custosMarketManagerAbi,
    functionName: 'getPool',
    args: [configuration.poolId],
  });
  const result = await broadcast(signer, swapRequest(await swapCall(signer, amount)), 'success');
  const nonceAfter = await authorizerNonce(signer.address);
  const poolAfter = await publicClient.readContract({
    address: manifest.marketManager,
    abi: custosMarketManagerAbi,
    functionName: 'getPool',
    args: [configuration.poolId],
  });
  assert.equal(nonceAfter, nonceBefore + 1n, 'recorded denial did not consume its single-use intent');
  assert.equal(poolAfter.reserve0, poolBefore.reserve0, 'denied action changed reserve0');
  assert.equal(poolAfter.reserve1, poolBefore.reserve1, 'denied action changed reserve1');
  return { ...result, details: { decision: 'denied', intentNonce: Number(nonceAfter), reservesUnchanged: true } };
}

async function expectSwapStructurallyReverted(signer: PrivateKeyAccount, amount: bigint) {
  const nonceBefore = await authorizerNonce(signer.address);
  const result = await broadcast(signer, swapRequest(await swapCall(signer, amount)), 'reverted');
  assert.equal(await authorizerNonce(signer.address), nonceBefore);
  return { ...result, details: { decision: 'structural revert', intentNonceUnchanged: true } };
}

const one = 10n ** 6n;
const fiveThousand = 5_000n * one;

await runStep('01.unverified_agent_denied', async () => {
  const [allowed, reason] = await publicClient.readContract({
    address: manifest.gate,
    abi: custosGateAbi,
    functionName: 'isActionPermitted',
    args: [admin.address, manifest.actionAuthorizer, CustosActions.SWAP, manifest.tbill, one],
  });
  assert.equal(allowed, false);
  assert.equal(reason, 'AGENT_NOT_VERIFIED');
  const result = await expectSwapDenied(admin, one);
  return { ...result, details: { ...result.details, reason } };
});

await runStep('02.revoke_initial_swap_mandate', revokeActiveSwapMandate);
await runStep('03.verified_without_mandate_denied', async () => {
  assert.equal(await publicClient.readContract({
    address: manifest.registry,
    abi: custosRegistryAbi,
    functionName: 'isVerified',
    args: [agent.address],
  }), true);
  const current = await eventually('inactive initial mandate', activeSwapMandate, (value) => !value.record.active);
  assert.equal(current.record.active, false);
  return expectSwapDenied(agent, one);
});

await runStep('04.grant_capped_swap_mandate', async () =>
  grantSwapMandate(fiveThousand, 20_000n * one, await latestTimestamp() + 24n * 60n * 60n));

await runStep('05.mint_replay_asset', async () => {
  const balance = await publicClient.readContract({ address: manifest.tbill, abi: mockTBillAbi, functionName: 'balanceOf', args: [agent.address] });
  if (balance >= 25_000n * one) return { details: { alreadyFunded: true } };
  return broadcast(issuer, {
    address: manifest.tbill,
    abi: mockTBillAbi,
    functionName: 'mint',
    args: [agent.address, 25_000n * one - balance],
  }, 'success');
});

await runStep('06.in_limit_swap_succeeds', async () => {
  const before = await activeSwapMandate();
  const result = await broadcast(agent, swapRequest(await swapCall(agent, 1_000n * one)), 'success');
  const after = await eventually(
    'in-limit swap mandate spend',
    activeSwapMandate,
    (value) => value.record.spent === before.record.spent + 1_000n * one,
  );
  assert.equal(after.record.spent - before.record.spent, 1_000n * one);
  return { ...result, details: { mandateSpent: after.record.spent.toString() } };
});

for (const variant of ['amount', 'recipient', 'context', 'venue'] as const) {
  await runStep(`07.tampered_${variant}_denied`, async () => {
    const base = await swapCall(agent, 100n * one);
    let changed = structuredClone(base);
    if (variant === 'amount') {
      const amountIn = 101n * one;
      changed.params.amountIn = amountIn;
      changed.intent.amount = amountIn;
      changed.intent.contextHash = await publicClient.readContract({
        address: manifest.marketManager,
        abi: custosMarketManagerAbi,
        functionName: 'swapContext',
        args: [configuration.poolId, manifest.tbill, amountIn, 0n],
      });
    } else if (variant === 'recipient') {
      changed.params.recipient = exitRecipient;
      changed.intent.recipient = exitRecipient;
    } else if (variant === 'context') {
      changed.params.minOut = 1n;
      changed.intent.contextHash = await publicClient.readContract({
        address: manifest.marketManager,
        abi: custosMarketManagerAbi,
        functionName: 'swapContext',
        args: [configuration.poolId, manifest.tbill, 100n * one, 1n],
      });
    } else {
      changed.intent.venue = manifest.gate;
    }
    const nonceBefore = await authorizerNonce(agent.address);
    const result = await broadcast(agent, swapRequest(changed), 'reverted');
    assert.equal(await authorizerNonce(agent.address), nonceBefore);
    return { ...result, details: { signedFieldsTampered: variant, intentNonceUnchanged: true } };
  });
}

await runStep('08.per_action_cap_denied', async () => {
  const mandate = await activeSwapMandate();
  assert.equal(mandate.record.maxPerAction, fiveThousand);
  return expectSwapDenied(agent, fiveThousand + one);
});

for (const [index, amount] of [fiveThousand, fiveThousand, fiveThousand, 4_000n * one].entries()) {
  await runStep(`09.cumulative_swap_${index + 1}`, async () => {
    const before = await activeSwapMandate();
    const result = await broadcast(agent, swapRequest(await swapCall(agent, amount)), 'success');
    const mandate = await eventually(
      `cumulative swap ${index + 1} spend`,
      activeSwapMandate,
      (value) => value.record.spent === before.record.spent + amount,
    );
    return { ...result, details: { mandateSpent: mandate.record.spent.toString() } };
  });
}

await runStep('10.cumulative_cap_denied', async () => {
  const mandate = await eventually(
    'cumulative mandate fully consumed',
    activeSwapMandate,
    (value) => value.record.spent === value.record.maxTotal,
  );
  assert.equal(mandate.record.spent, mandate.record.maxTotal);
  return expectSwapDenied(agent, one);
});

await runStep('11.revoke_cumulative_mandate', revokeActiveSwapMandate);
await runStep('12.grant_short_mandate', async () => grantSwapMandate(fiveThousand, fiveThousand, await latestTimestamp() + 20n));
await runStep('13.wait_for_mandate_expiry', async () => {
  const observed = await latestTimestamp();
  const mandate = await eventually(
    'short-lived mandate visible',
    activeSwapMandate,
    (value) => value.record.active && value.record.validUntil <= observed + 60n,
  );
  for (let attempt = 0; attempt < 30; attempt++) {
    const now = await latestTimestamp();
    if (now > mandate.record.validUntil) return { details: { expiredAt: mandate.record.validUntil.toString(), observedAt: now.toString() } };
    await delay(2_000);
  }
  throw new Error('Base Sepolia did not advance beyond the short mandate expiry');
});
await runStep('14.expired_mandate_denied', async () => expectSwapDenied(agent, one));

await runStep('15.grant_revocation_mandate', async () =>
  grantSwapMandate(fiveThousand, 10_000n * one, await latestTimestamp() + 24n * 60n * 60n));
await runStep('16.principal_revokes_mandate', revokeActiveSwapMandate);
await runStep('17.principal_revocation_denied', async () => expectSwapDenied(agent, one));

await runStep('18.grant_freeze_mandate', async () =>
  grantSwapMandate(fiveThousand, 10_000n * one, await latestTimestamp() + 24n * 60n * 60n));
await runStep('19.emergency_freeze_on', async () => broadcast(admin, {
  address: manifest.mandates,
  abi: custosAgentMandateAbi,
  functionName: 'setEmergencyFreeze',
  args: [agent.address, true],
}, 'success'));
await runStep('20.emergency_freeze_denied', async () => expectSwapDenied(agent, one));
await runStep('21.emergency_freeze_off', async () => broadcast(admin, {
  address: manifest.mandates,
  abi: custosAgentMandateAbi,
  functionName: 'setEmergencyFreeze',
  args: [agent.address, false],
}, 'success'));

await runStep('22.pause_pool', async () => {
  const result = await broadcast(issuer, {
    address: manifest.marketManager,
    abi: custosMarketManagerAbi,
    functionName: 'setPoolActive',
    args: [configuration.poolId, false],
  }, 'success');
  await eventually(
    'paused pool',
    () => publicClient.readContract({ address: manifest.marketManager, abi: custosMarketManagerAbi, functionName: 'getPool', args: [configuration.poolId] }),
    (pool) => !pool.active,
  );
  return result;
});
await runStep('23.paused_swap_denied', async () => expectSwapStructurallyReverted(agent, one));
await runStep('24.paused_liquidity_entry_denied', async () => {
  const amount0 = one;
  const amount1 = one;
  const contextHash = await publicClient.readContract({
    address: manifest.marketManager,
    abi: custosMarketManagerAbi,
    functionName: 'liquidityContext',
    args: [configuration.poolId, amount0, amount1, 0n],
  });
  const intent: ActionIntent = {
    agent: agent.address,
    venue: manifest.marketManager,
    executor: manifest.marketManager,
    action: CustosActions.LIQUIDITY_ENTRY,
    asset: manifest.tbill,
    amount: manifest.tbill.toLowerCase() < manifest.settlementToken.toLowerCase() ? amount0 : amount1,
    recipient: agent.address,
    nonce: await authorizerNonce(agent.address),
    deadline: await latestTimestamp() + 600n,
    contextHash,
  };
  const signature = await agent.signTypedData(actionIntentTypedData(84532, manifest.actionAuthorizer, intent));
  const nonceBefore = await authorizerNonce(agent.address);
  const result = await broadcast(agent, {
    address: manifest.marketManager,
    abi: custosMarketManagerAbi,
    functionName: 'addLiquidity',
    args: [configuration.poolId, amount0, amount1, 0n, intent, signature],
  }, 'reverted');
  assert.equal(await authorizerNonce(agent.address), nonceBefore);
  return { ...result, details: { intentNonceUnchanged: true } };
});
await runStep('25.unpause_pool', async () => {
  const result = await broadcast(issuer, {
    address: manifest.marketManager,
    abi: custosMarketManagerAbi,
    functionName: 'setPoolActive',
    args: [configuration.poolId, true],
  }, 'success');
  await eventually(
    'active pool',
    () => publicClient.readContract({ address: manifest.marketManager, abi: custosMarketManagerAbi, functionName: 'getPool', args: [configuration.poolId] }),
    (pool) => pool.active,
  );
  return result;
});

await runStep('26.revoke_agent_credential', async () => {
  const result = await broadcast(attester, {
    address: manifest.registry,
    abi: custosRegistryAbi,
    functionName: 'revokeAgent',
    args: [agent.address, 'PILOT_REVOCATION'],
  }, 'success');
  await eventually(
    'revoked agent credential',
    () => publicClient.readContract({ address: manifest.registry, abi: custosRegistryAbi, functionName: 'isVerified', args: [agent.address] }),
    (verified) => !verified,
  );
  return result;
});
await runStep('27.credential_revocation_denied', async () => {
  assert.equal(await publicClient.readContract({
    address: manifest.registry,
    abi: custosRegistryAbi,
    functionName: 'isVerified',
    args: [agent.address],
  }), false);
  return expectSwapDenied(agent, one);
});

await runStep('28.revoked_lp_safe_exit', async () => {
  const shares = one;
  const sharesBefore = await publicClient.readContract({
    address: manifest.marketManager,
    abi: custosMarketManagerAbi,
    functionName: 'liquidityOf',
    args: [configuration.poolId, agent.address],
  });
  const tbillBefore = await publicClient.readContract({ address: manifest.tbill, abi: mockTBillAbi, functionName: 'balanceOf', args: [exitRecipient] });
  const usdBefore = await publicClient.readContract({ address: manifest.settlementToken, abi: mockUsdAbi, functionName: 'balanceOf', args: [exitRecipient] });
  const result = await broadcast(agent, {
    address: manifest.marketManager,
    abi: custosMarketManagerAbi,
    functionName: 'removeLiquidity',
    args: [configuration.poolId, shares, 0n, 0n, exitRecipient],
  }, 'success');
  const after = await eventually(
    'safe liquidity exit balances',
    async () => ({
      shares: await publicClient.readContract({ address: manifest.marketManager, abi: custosMarketManagerAbi, functionName: 'liquidityOf', args: [configuration.poolId, agent.address] }),
      tbill: await publicClient.readContract({ address: manifest.tbill, abi: mockTBillAbi, functionName: 'balanceOf', args: [exitRecipient] }),
      usd: await publicClient.readContract({ address: manifest.settlementToken, abi: mockUsdAbi, functionName: 'balanceOf', args: [exitRecipient] }),
    }),
    (value) => sharesBefore - value.shares === shares && value.tbill > tbillBefore && value.usd > usdBefore,
  );
  const sharesAfter = after.shares;
  const tbillAfter = after.tbill;
  const usdAfter = after.usd;
  assert.equal(sharesBefore - sharesAfter, shares);
  assert(tbillAfter > tbillBefore);
  assert(usdAfter > usdBefore);
  return { ...result, details: { sharesBurned: shares.toString(), restrictedAssetReceived: (tbillAfter - tbillBefore).toString(), settlementAssetReceived: (usdAfter - usdBefore).toString() } };
});

const finalBlock = await publicClient.getBlockNumber();
const auditLogs = await publicClient.getLogs({
  address: [
    manifest.registry,
    manifest.operatorBinding,
    manifest.mandates,
    manifest.actionAuthorizer,
    manifest.gate,
    manifest.marketManager,
  ],
  fromBlock: BigInt(manifest.deploymentBlock),
  toBlock: finalBlock,
});
const finalPool = await publicClient.readContract({
  address: manifest.marketManager,
  abi: custosMarketManagerAbi,
  functionName: 'getPool',
  args: [configuration.poolId],
});
const finalMandate = await activeSwapMandate();
replay.auditLogs = auditLogs;
replay.finalState = {
  block: finalBlock.toString(),
  agentVerified: await publicClient.readContract({ address: manifest.registry, abi: custosRegistryAbi, functionName: 'isVerified', args: [agent.address] }),
  agentIntentNonce: (await authorizerNonce(agent.address)).toString(),
  activeMandateSpent: finalMandate.record.spent.toString(),
  reserve0: finalPool.reserve0.toString(),
  reserve1: finalPool.reserve1.toString(),
  totalShares: finalPool.totalShares.toString(),
  auditLogCount: auditLogs.length,
};
replay.completedAt = new Date().toISOString();
save();
console.log(`all ${Object.keys(replay.steps).length} replay steps passed`);
console.log(`replay and audit evidence written to ${evidencePath}`);
