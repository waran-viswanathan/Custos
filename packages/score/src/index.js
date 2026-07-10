// Score v0: deterministic rules + velocity (per plan: ML anomaly model comes at
// months 7–9 once live outcome data exists). Returns risk 0–100 and a verdict.
//
// Components:
//   identity  — risk falls as derived assurance tier rises
//   velocity  — transactions per agent within a sliding window
//   amount    — payment amount vs the credential's committed per-txn cap
//   sanctions — settlement-address screening (stub list here; real provider later)

const TIER_RISK = { 0: 45, 1: 15, 2: 5, 3: 2 };

export class Scorer {
  #history = new Map(); // agentDid -> [timestamps]

  constructor({ velocityMax = 10, velocityWindowSeconds = 60, sanctionedAddresses = new Set(), allowThreshold = 25, blockThreshold = 55 } = {}) {
    this.velocityMax = velocityMax;
    this.velocityWindowMs = velocityWindowSeconds * 1000;
    this.sanctionedAddresses = sanctionedAddresses;
    this.allowThreshold = allowThreshold;
    this.blockThreshold = blockThreshold;
  }

  score({ verification, payment, now = Date.now() }) {
    const components = {};
    const agent = verification.subject?.agent ?? 'unknown';

    components.identity = TIER_RISK[verification.tier] ?? 60;

    const seen = (this.#history.get(agent) ?? []).filter((t) => now - t < this.velocityWindowMs);
    seen.push(now);
    this.#history.set(agent, seen);
    components.velocity = seen.length > this.velocityMax ? Math.min(40, (seen.length - this.velocityMax) * 8) : 0;

    components.amount = 0;
    const cap = verification.policy?.perTxnCap;
    if (cap !== undefined && BigInt(payment.amount) > BigInt(cap)) components.amount = 50;

    components.sanctions = this.sanctionedAddresses.has(payment.payTo) || this.sanctionedAddresses.has(payment.from) ? 100 : 0;

    const risk = Math.min(100, Object.values(components).reduce((a, b) => a + b, 0));
    const verdict = components.sanctions > 0 ? 'block' : risk < this.allowThreshold ? 'allow' : risk < this.blockThreshold ? 'review' : 'block';
    return { risk, verdict, components, agent };
  }
}
