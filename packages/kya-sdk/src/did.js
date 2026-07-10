// did:key support for Ed25519, using only node:crypto.
// did:key format: 'did:key:z' + base58btc(0xed 0x01 || raw 32-byte public key)

import { generateKeyPairSync, createPublicKey, sign, verify } from 'node:crypto';

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes) {
  let n = BigInt('0x' + Buffer.from(bytes).toString('hex'));
  let out = '';
  while (n > 0n) {
    out = B58_ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b === 0) out = '1' + out;
    else break;
  }
  return out;
}

function base58Decode(str) {
  let n = 0n;
  for (const c of str) {
    const i = B58_ALPHABET.indexOf(c);
    if (i < 0) throw new Error(`invalid base58 character: ${c}`);
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  let bytes = Buffer.from(hex, 'hex');
  let leading = 0;
  for (const c of str) {
    if (c === '1') leading++;
    else break;
  }
  return Buffer.concat([Buffer.alloc(leading), bytes]);
}

// DER prefix for an Ed25519 SPKI public key
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const MULTICODEC_ED25519_PUB = Buffer.from([0xed, 0x01]);

export function generateKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { publicKey, privateKey, did: didFromPublicKey(publicKey) };
}

export function didFromPublicKey(publicKey) {
  const raw = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
  return 'did:key:z' + base58Encode(Buffer.concat([MULTICODEC_ED25519_PUB, raw]));
}

export function publicKeyFromDid(did) {
  if (!did.startsWith('did:key:z')) throw new Error(`unsupported DID method: ${did}`);
  const decoded = base58Decode(did.slice('did:key:z'.length));
  if (decoded[0] !== 0xed || decoded[1] !== 0x01) throw new Error('not an Ed25519 did:key');
  const raw = decoded.subarray(2);
  if (raw.length !== 32) throw new Error('bad key length');
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
    format: 'der',
    type: 'spki',
  });
}

export function signBytes(privateKey, data) {
  return sign(null, data, privateKey);
}

export function verifyBytes(did, data, signature) {
  try {
    return verify(null, data, publicKeyFromDid(did), signature);
  } catch {
    return false;
  }
}
