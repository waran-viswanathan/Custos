// KYA credentials and presentations (spec §3, §7, §8).
// Credentials are JWTs signed by the issuer; presentations are JWTs signed by
// the agent, bound to a specific payment payload and audience.

import { createHash } from 'node:crypto';
import { signJWT, verifyJWT } from './jws.js';

const PRESENTATION_TTL_SECONDS = 60;

export function issueCredential({ issuer, issuerPrivateKey, subject, validityDays = 90, now = Date.now() }) {
  const validFrom = new Date(now).toISOString();
  const validUntil = new Date(now + validityDays * 86400_000).toISOString();
  return signJWT(
    {
      iss: issuer,
      sub: subject.agent,
      iat: Math.floor(now / 1000),
      vc: {
        '@context': ['https://www.w3.org/ns/credentials/v2', 'https://kya.dev/context/v1'],
        type: ['VerifiableCredential', 'KYACredential'],
        credentialSubject: { ...subject, validFrom, validUntil },
      },
    },
    issuerPrivateKey,
  );
}

// Assurance tier is DERIVED from evidence (spec §4) — never trusted from the label.
export function deriveTier(subject, { accreditedIssuers }) {
  let tier = 0;
  const kyb = subject.operatorKYB;
  if (kyb && kyb.level && kyb.level !== 'none' && accreditedIssuers.has(kyb.issuer)) {
    tier = 1;
    if (subject.runtime?.type !== 'self-attested' && subject.runtime?.evidence) {
      tier = 2;
      if (subject.bond?.registry) tier = 3;
    }
  }
  return tier;
}

export function verifyCredential(credentialJwt, { trustList, registry, now = Date.now() }) {
  const errors = [];
  const { valid, payload, error } = verifyJWT(credentialJwt, 'iss');
  if (!valid) return { valid: false, errors: [error] };

  const subject = payload.vc?.credentialSubject;
  if (!subject) return { valid: false, errors: ['missing credentialSubject'] };

  if (!trustList.has(payload.iss)) errors.push(`issuer ${payload.iss.slice(0, 24)}… not on trust list`);
  if (subject.agent !== payload.sub) errors.push('sub/agent mismatch');
  if (now < Date.parse(subject.validFrom)) errors.push('credential not yet valid');
  if (now > Date.parse(subject.validUntil)) errors.push('credential expired');

  const status = registry.status(subject.revocation?.id);
  if (!status.known) errors.push('credential not found in registry');
  else if (status.revoked) errors.push(`credential revoked at ${status.revokedAt}`);

  const tier = deriveTier(subject, { accreditedIssuers: trustList });
  if (subject.assuranceTier > tier) errors.push(`claimed tier ${subject.assuranceTier} exceeds evidence (derived ${tier})`);

  return { valid: errors.length === 0, errors, issuer: payload.iss, subject, tier };
}

export function paymentNonce(paymentPayload) {
  return createHash('sha256').update(paymentPayload).digest('hex');
}

export function createPresentation({ credentialJwt, agentDid, agentPrivateKey, audience, paymentPayload, now = Date.now() }) {
  return signJWT(
    {
      iss: agentDid,
      aud: audience,
      nonce: paymentNonce(paymentPayload),
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + PRESENTATION_TTL_SECONDS,
      vp: { type: ['VerifiablePresentation'], verifiableCredential: [credentialJwt] },
    },
    agentPrivateKey,
  );
}

// Full verification algorithm (spec §8): presentation binding first, then credential.
export function verifyPresentation(vpJwt, { audience, paymentPayload, trustList, registry, now = Date.now() }) {
  const { valid, payload, error } = verifyJWT(vpJwt, 'iss');
  if (!valid) return { valid: false, errors: [`presentation: ${error}`] };

  const errors = [];
  if (payload.aud !== audience) errors.push(`presentation bound to audience ${payload.aud}, not ${audience}`);
  if (payload.nonce !== paymentNonce(paymentPayload)) errors.push('presentation not bound to this payment payload');
  if (now / 1000 > payload.exp) errors.push('presentation expired');

  const credentialJwt = payload.vp?.verifiableCredential?.[0];
  if (!credentialJwt) return { valid: false, errors: [...errors, 'no credential in presentation'] };

  const cred = verifyCredential(credentialJwt, { trustList, registry, now });
  errors.push(...cred.errors);

  if (cred.subject && cred.subject.agent !== payload.iss) {
    errors.push('presentation signer is not the credentialed agent');
  }

  return { ...cred, valid: errors.length === 0, errors };
}
