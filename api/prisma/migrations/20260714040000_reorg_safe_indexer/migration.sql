ALTER TABLE "AuditEvent"
ADD COLUMN "chainId" INTEGER,
ADD COLUMN "chainIndexerId" TEXT,
ADD COLUMN "chainBlockNumber" BIGINT,
ADD COLUMN "chainBlockHash" TEXT;

ALTER TABLE "IndexerCursor"
ADD COLUMN "lastBlockHash" TEXT;

CREATE INDEX "AuditEvent_chainId_chainBlockNumber_idx"
ON "AuditEvent"("chainId", "chainBlockNumber");

CREATE INDEX "AuditEvent_chainIndexerId_chainBlockNumber_idx"
ON "AuditEvent"("chainIndexerId", "chainBlockNumber");
