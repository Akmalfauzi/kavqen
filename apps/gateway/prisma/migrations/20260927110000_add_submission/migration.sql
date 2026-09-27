CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "agentName" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Submission_workflowId_createdAt_idx" ON "Submission"("workflowId", "createdAt");

ALTER TABLE "Submission" ADD CONSTRAINT "Submission_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
