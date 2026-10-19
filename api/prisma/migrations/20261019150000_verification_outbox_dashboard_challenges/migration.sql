CREATE TABLE "VerificationTask" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    CONSTRAINT "VerificationTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VerificationTask_dispatchedAt_createdAt_idx" ON "VerificationTask"("dispatchedAt", "createdAt");
ALTER TABLE "VerificationTask" ADD CONSTRAINT "VerificationTask_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DashboardChallenge" (
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DashboardChallenge_pkey" PRIMARY KEY ("nonce")
);
CREATE INDEX "DashboardChallenge_expiresAt_idx" ON "DashboardChallenge"("expiresAt");
