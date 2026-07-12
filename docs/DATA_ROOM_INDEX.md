# Custos technical data room index

This index is for accelerator diligence and early advisors. It is not a claim of
production readiness.

## 01 — Company and strategy

- `docs/company-summary.md` — current company narrative and evidence boundary.
- `docs/ACCELERATOR_BRIEF.md` — business model, wedge, milestones, and claims.
- `docs/ACCELERATOR_APPLICATION.md` — canonical application answers.
- `docs/STATUS.md` — canonical execution and claims ledger.
- `research/market-validation.md` — evidence and corrections behind the thesis.

## 02 — Product and architecture

- `README.md` — architecture, local setup, integration, and proof summary.
- `docs/STANDARDS_COMPATIBILITY.md` — standards implementation boundary.
- `docs/MARKETS_FOUNDATION.md` — venue-neutral enforcement model.
- `docs/MARKET_MANAGER_POC.md` — experimental market-manager boundary.
- `docs/PILOT_RUNBOOK.md` — public pilot scenarios and pass criteria.

## 03 — Security and operations

- `SECURITY.md` — threat and disclosure posture.
- `docs/PRODUCTION.md` — explicit production release gates.
- `.github/workflows/ci.yml` — build, tests, dependency audit, and demo smoke.
- `contracts/test/` — contract invariant and enforcement tests.
- `api/test/` and `sdk/test/` — application and SDK tests.

## 04 — Public-chain evidence

- `contracts/deployments/pilot-84532.json` — canonical deployment manifest.
- `contracts/deployments/pilot-84532-verification.json` — Sourcify evidence.
- `contracts/deployments/pilot-84532-wiring.json` — wiring and role checks.
- `contracts/deployments/pilot-84532-configuration.json` — configuration transactions.
- `contracts/deployments/pilot-84532-configuration-check.json` — independent state checks.
- `contracts/deployments/pilot-84532-replay-summary.md` — reviewer-readable proof links.
- `contracts/deployments/pilot-84532-replay.json` — complete replay and audit logs.

## 05 — Reproducibility

- `scripts/deploy-pilot-sepolia.sh` — canonical pilot deployment.
- `scripts/verify-pilot-sepolia.sh` — source-verification evidence.
- `scripts/check-pilot-sepolia.sh` — wiring, ownership, and role checks.
- `scripts/configure-pilot-sepolia.sh` — credentials, policies, mandates, and pool.
- `scripts/check-pilot-configuration.sh` — independent configuration verification.
- `scripts/replay-pilot-sepolia.sh` — resumable adversarial replay.
- `demo-agent/pilot-replay.ts` — exact replay logic and invariant checks.

## 06 — Commercial preparation

- `research/target-list.md` — researched buyer and ecosystem targets.
- `gtm/design-partner-interview-script.md` — discovery questions.
- `gtm/one-pager.md` — buyer-facing summary; refresh before external use.
- `gtm/outreach-emails.md` — inactive research asset under accelerator-first GTM.

## Missing before production or institutional diligence

- [ ] Independent smart-contract audit.
- [ ] Application penetration test.
- [ ] Specialist securities, payments, and custody legal memorandum.
- [ ] Real KYB/sanctions provider agreement and integration evidence.
- [ ] Multisig governance and KMS/HSM attester architecture.
- [ ] Incident response, monitoring, backup, and disaster-recovery evidence.
- [ ] Incorporation, cap table, IP assignment, and financing documents.
- [ ] Customer contracts, LOIs, or pilot evidence—none are claimed today.

