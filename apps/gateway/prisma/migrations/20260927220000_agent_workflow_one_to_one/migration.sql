ALTER TABLE "Workflow" ADD COLUMN "agentId" TEXT;
CREATE UNIQUE INDEX "Workflow_agentId_key" ON "Workflow"("agentId");
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: pair each existing agent with one workflow, oldest agent to oldest
-- workflow, so the three hand-made agents keep the three hand-made workflows.
WITH ranked_agents AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS rn
  FROM "Agent" WHERE "deletedAt" IS NULL
), ranked_workflows AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS rn
  FROM "Workflow" WHERE "deletedAt" IS NULL
)
UPDATE "Workflow" w SET "agentId" = ra."id"
FROM ranked_workflows rw JOIN ranked_agents ra ON ra.rn = rw.rn
WHERE w."id" = rw."id";

-- Every remaining workflow gets its own agent, so the catalog stays the only
-- way in and nothing becomes unreachable.
INSERT INTO "Agent" ("id", "name", "role", "themeId", "voice", "model", "workflowSteps", "avatarGradient", "tags", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text,
       w."name",
       'Voice agent for ' || w."name",
       w."id",
       'Jessica (Calm, Reassuring)',
       'AssemblyAI Universal-3.5 Streaming',
       0,
       'from-purple-500 to-indigo-400',
       ARRAY['Migrated'],
       true,
       NOW(), NOW()
FROM "Workflow" w
WHERE w."deletedAt" IS NULL AND w."agentId" IS NULL;

UPDATE "Workflow" w SET "agentId" = a."id"
FROM "Agent" a
WHERE w."agentId" IS NULL AND w."deletedAt" IS NULL
  AND a."themeId" = w."id" AND 'Migrated' = ANY(a."tags");
