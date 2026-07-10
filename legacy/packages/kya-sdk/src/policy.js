// Policy commitment: keccak256 over a canonical (sorted-key) JSON serialization,
// per KYA spec §6. keccak256 keeps the commitment cheaply verifiable on EVM chains.

import { keccak_256 } from '@noble/hashes/sha3';

export function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function commitPolicy(policy) {
  const bytes = keccak_256(new TextEncoder().encode(canonicalize(policy)));
  return '0x' + Buffer.from(bytes).toString('hex');
}

export function verifyPolicyCommitment(policy, commitment) {
  return commitPolicy(policy) === commitment;
}
