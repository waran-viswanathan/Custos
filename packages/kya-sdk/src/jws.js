// Minimal EdDSA compact JWS (JWT) — enough for credentials and presentations.

import { signBytes, verifyBytes } from './did.js';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const fromB64u = (s) => Buffer.from(s, 'base64url');

export function signJWT(payload, privateKey, header = {}) {
  const h = b64u(JSON.stringify({ alg: 'EdDSA', typ: 'JWT', ...header }));
  const p = b64u(JSON.stringify(payload));
  const sig = signBytes(privateKey, Buffer.from(`${h}.${p}`));
  return `${h}.${p}.${b64u(sig)}`;
}

// Verifies signature against the DID in the payload field named by `signerClaim`
// (e.g. 'iss'). Returns { valid, payload, error }.
export function verifyJWT(jwt, signerClaim = 'iss') {
  try {
    const [h, p, s] = jwt.split('.');
    if (!h || !p || !s) return { valid: false, error: 'malformed JWT' };
    const header = JSON.parse(fromB64u(h));
    if (header.alg !== 'EdDSA') return { valid: false, error: `unsupported alg ${header.alg}` };
    const payload = JSON.parse(fromB64u(p));
    const signer = payload[signerClaim];
    if (!signer) return { valid: false, error: `missing ${signerClaim} claim` };
    const ok = verifyBytes(signer, Buffer.from(`${h}.${p}`), fromB64u(s));
    return ok ? { valid: true, payload } : { valid: false, error: 'signature invalid', payload };
  } catch (e) {
    return { valid: false, error: `parse error: ${e.message}` };
  }
}
