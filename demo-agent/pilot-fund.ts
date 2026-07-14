import { createPublicClient, createWalletClient, formatEther, http, type Address, type Hex } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing pilot setting: ${name}`);
  return value;
}

const account = privateKeyToAccount(required('SEPOLIA_DEPLOYER_PRIVATE_KEY') as Hex);
const transport = http(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org');
const publicClient = createPublicClient({ chain: baseSepolia, transport });
const walletClient = createWalletClient({ account, chain: baseSepolia, transport });
const targets: Array<{ label: string; address: Address; target: bigint }> = [
  { label: 'admin', address: required('ADMIN_ADDRESS') as Address, target: 30_000_000_000_000n },
  { label: 'attester', address: required('ATTESTER_ADDRESS') as Address, target: 30_000_000_000_000n },
  { label: 'issuer', address: required('ISSUER_ADDRESS') as Address, target: 60_000_000_000_000n },
  { label: 'principal', address: required('PRINCIPAL_ADDRESS') as Address, target: 60_000_000_000_000n },
  { label: 'agent', address: required('AGENT_ADDRESS') as Address, target: 120_000_000_000_000n },
];

const balances = await Promise.all(targets.map(({ address }) => publicClient.getBalance({ address })));
const deficits = balances.map((balance, index) => balance >= targets[index]!.target ? 0n : targets[index]!.target - balance);
const gasBuffer = 20_000_000_000_000n;
const requiredBalance = deficits.reduce((total, deficit) => total + deficit, gasBuffer);
const deployerBalance = await publicClient.getBalance({ address: account.address });

if (deployerBalance < requiredBalance) {
  throw new Error([
    'deployer needs more Base Sepolia ETH before wallet funding',
    `deployer: ${account.address}`,
    `current: ${formatEther(deployerBalance)} ETH`,
    `required: ${formatEther(requiredBalance)} ETH`,
  ].join('\n'));
}

let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
for (let index = 0; index < targets.length; index += 1) {
  const target = targets[index]!;
  const value = deficits[index]!;
  if (value === 0n) {
    console.log(`${target.label} already funded`);
    continue;
  }
  console.log(`funding ${target.label} ${target.address} with ${formatEther(value)} ETH`);
  const hash = await walletClient.sendTransaction({ account, to: target.address, value, nonce });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  if (receipt.status !== 'success') throw new Error(`funding transaction reverted: ${hash}`);
  nonce += 1;
}

console.log('pilot transaction wallets funded; exit recipient remains receive-only');
