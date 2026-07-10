// Reference registry: issuance records + revocation status (spec §9).
// This in-memory implementation stands in for the on-chain EAS registry on Base;
// the interface (issue / revoke / status) is what the SDK and middleware depend on.

import { randomUUID } from 'node:crypto';

export class MemoryRegistry {
  #records = new Map();

  issue({ agent, operator, issuer, now = Date.now() }) {
    const id = randomUUID();
    this.#records.set(id, { agent, operator, issuer, issuedAt: new Date(now).toISOString(), revoked: false, revokedAt: null, revokedBy: null });
    return id;
  }

  // Kill switch: operator or issuer may revoke (spec §9).
  revoke(id, { by, now = Date.now() }) {
    const rec = this.#records.get(id);
    if (!rec) throw new Error(`unknown credential id ${id}`);
    if (by !== rec.operator && by !== rec.issuer) throw new Error(`${by} is not authorized to revoke ${id}`);
    rec.revoked = true;
    rec.revokedAt = new Date(now).toISOString();
    rec.revokedBy = by;
  }

  status(id) {
    const rec = this.#records.get(id);
    if (!rec) return { known: false, revoked: false };
    return { known: true, revoked: rec.revoked, revokedAt: rec.revokedAt };
  }

  directory() {
    return [...this.#records.entries()].map(([id, r]) => ({ id, ...r }));
  }
}
