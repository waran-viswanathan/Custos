# Custos public demo recording

> **Hold:** the links and narration below document the historical v3 replay.
> Do not record or describe it as the current architecture. Replace this shot
> list with v4 addresses and transactions after v4 is deployed, verified,
> configured, and replayed on Base Sepolia.

Target length: **75–90 seconds**. Record at 1080p with the browser at 100–110%
zoom. This is a narrated evidence walkthrough, not a fresh transaction run.

## Tabs to open before recording

1. Custos website, hero section.
2. Historical v3 manifest/evidence archive (replace with the v4 manifest before recording).
3. [Unverified wallet denied](https://sepolia.basescan.org/tx/0x490bdf5c2227544e4035ec6a5fac466c6e77507e815c0d3f5fc0aeb710990f02).
4. [In-limit mandated swap](https://sepolia.basescan.org/tx/0x156745bc0313671425f8446a962a81bdeb84e6da836a85c0823de817dc054928).
5. [Emergency freeze denial](https://sepolia.basescan.org/tx/0x099bd3e60a45caad5c4b3ce5aeba6c31e595c3fbecd0e35962dca8eecda4c088).
6. [Credential-revoked denial](https://sepolia.basescan.org/tx/0xa74b0fcc02e6cef7d5c8b6c1deae22fe0f9266a5f31180cd8b30e94b76d14cf6).
7. [Safe LP exit after revocation](https://sepolia.basescan.org/tx/0xbe8fc304631dc4eab1ad2ac430c24b69f22734e7384e89d47abefa23704b6927).
8. [Complete replay summary](https://github.com/lalithesh-star/Custos/blob/main/contracts/deployments/pilot-84532-replay-summary.md).

On BaseScan, pre-scroll each transaction so its transaction status, method, from,
to, and block are visible. Close personal tabs and disable notifications.

## Shot list and narration

| Time | Screen | Narration |
|---|---|---|
| 0–10s | Website hero | “AI agents can control wallets, but regulated-asset systems verify people and companies—not autonomous software. Custos is the regulated-asset settlement gate for those wallets.” |
| 10–20s | Website protocol layers | “It binds an agent to a verified operator, records exactly what that operator authorized, authenticates the wallet’s signed action, and enforces issuer policy before settlement.” |
| 20–29s | v4 manifest | “This is the hardened v4 deployment on Base Sepolia: separate operational roles, source-verified contracts, and a versioned public manifest.” |
| 29–39s | Unverified denial | “First, an unverified wallet attempts a swap. The transaction reverts before reserves, balances, mandate spend, or its intent nonce can change.” |
| 39–49s | Successful swap | “After verification and a principal-issued mandate with venue, asset, transaction, cumulative, and expiry limits, the same action succeeds.” |
| 49–59s | Emergency-freeze denial | “The Custos emergency freeze blocks the next action atomically. The principal can also revoke its mandate, and the issuer can revoke the credential.” |
| 59–69s | Credential-revoked denial | “Here, credential revocation blocks the next swap at transaction time—the kill switch is part of settlement, not an off-chain promise.” |
| 69–79s | Safe LP exit | “New risk stops immediately, but existing capital is not trapped: the revoked LP can still exit to a verified controlled recipient.” |
| 79–90s | Replay summary | “The public replay passed 34 assertions, including 14 intentional reverts, and exported 78 audit logs. Custos is testnet-only and unaudited; this is proof of the control model, not a production claim.” |

## Recording checklist

- [ ] Use a clean browser profile or hide bookmarks and personal tabs.
- [ ] Record 1920×1080 or higher.
- [ ] Use an external microphone or quiet room; no background music is needed.
- [ ] Keep the cursor still unless pointing to transaction status or addresses.
- [ ] Never open `.env`, terminal history, wallet keys, or the Coinbase portal.
- [ ] Say “Base Sepolia,” “testnet,” and “unaudited” in the narration.
- [ ] Do not say “customer,” “production,” “audited,” or “regulatory approval.”
- [ ] Export MP4/H.264 and watch the complete file once before publishing.
- [ ] Publish as unlisted first; verify every link and caption before making public.

## Final title and description

**Title:** Custos — verified AI-agent wallet enforcement on Base Sepolia

**Description:**

> Custos binds an autonomous wallet to a verified operator, authenticates its
> exact signed action, enforces issuer and operator policy before settlement,
> and supports immediate revocation without trapping an existing LP position.
> This demonstration uses test assets on Base Sepolia. Custos is
> pre-customer, unaudited, and not production-ready. Full evidence:
> https://github.com/lalithesh-star/Custos/blob/main/contracts/deployments/pilot-84532-replay-summary.md
