ALTER TABLE "Workflow" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Submission" ADD COLUMN "userId" TEXT;

UPDATE "Workflow" SET "ownerId" = (
    SELECT "id" FROM "User" WHERE "email" = 'superadmin@kavqen.com' LIMIT 1
) WHERE "ownerId" IS NULL;

CREATE TABLE "AccessCode" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FormGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "accessCodeId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FormGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccessCode_codeHash_key" ON "AccessCode"("codeHash");
CREATE INDEX "AccessCode_workflowId_idx" ON "AccessCode"("workflowId");
CREATE UNIQUE INDEX "FormGrant_userId_workflowId_key" ON "FormGrant"("userId", "workflowId");
CREATE INDEX "FormGrant_workflowId_idx" ON "FormGrant"("workflowId");
CREATE INDEX "Workflow_ownerId_idx" ON "Workflow"("ownerId");
CREATE INDEX "Submission_userId_idx" ON "Submission"("userId");

ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccessCode" ADD CONSTRAINT "AccessCode_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccessCode" ADD CONSTRAINT "AccessCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormGrant" ADD CONSTRAINT "FormGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormGrant" ADD CONSTRAINT "FormGrant_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormGrant" ADD CONSTRAINT "FormGrant_accessCodeId_fkey" FOREIGN KEY ("accessCodeId") REFERENCES "AccessCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
