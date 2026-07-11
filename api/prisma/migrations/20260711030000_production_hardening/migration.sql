CREATE TABLE "RegistrationChallenge" (
  "wallet" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegistrationChallenge_pkey" PRIMARY KEY ("wallet")
);
CREATE UNIQUE INDEX "RegistrationChallenge_nonce_key" ON "RegistrationChallenge"("nonce");
CREATE INDEX "RegistrationChallenge_expiresAt_idx" ON "RegistrationChallenge"("expiresAt");

ALTER TABLE "Agent"
  ADD COLUMN "verificationStage" TEXT NOT NULL DEFAULT 'SUBMITTED',
  ADD COLUMN "accredited" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "attestTxHash" TEXT,
  ADD COLUMN "registerTxHash" TEXT,
  ADD COLUMN "operatorProofMessage" TEXT,
  ADD COLUMN "operatorProofSignature" TEXT,
  ADD COLUMN "operatorProofVerifiedAt" TIMESTAMP(3);

-- Existing demo rows predate signed registration. They remain clearly marked
-- and should be erased before a production database is opened to applicants.
UPDATE "Agent" SET
  "operatorProofMessage" = 'LEGACY_UNVERIFIED_PROOF',
  "operatorProofSignature" = 'LEGACY_UNVERIFIED_PROOF',
  "operatorProofVerifiedAt" = CURRENT_TIMESTAMP
WHERE "operatorProofMessage" IS NULL;

ALTER TABLE "Agent"
  ALTER COLUMN "operatorProofMessage" SET NOT NULL,
  ALTER COLUMN "operatorProofSignature" SET NOT NULL,
  ALTER COLUMN "operatorProofVerifiedAt" SET NOT NULL;

ALTER TABLE "VerificationCheck" DROP CONSTRAINT IF EXISTS "VerificationCheck_agentId_fkey";
ALTER TABLE "VerificationCheck" ADD CONSTRAINT "VerificationCheck_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" DROP CONSTRAINT IF EXISTS "AuditEvent_agentId_fkey";
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
