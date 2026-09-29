#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
mode="${1:-local}"
if [[ "$mode" != local && "$mode" != docker ]]; then
  echo 'Usage: bash scripts/reset-demo.sh [local|docker]' >&2
  exit 1
fi

echo 'WARNING: This deletes ALL database records, including accounts and submissions,'
echo 'and clears the configured Kavqen Qdrant collection before restoring demo seeds.'
echo 'Back up your database first. Stop client/gateway traffic; keep AI and Qdrant running.'
echo "Target: $mode environment, DATABASE_URL from apps/gateway/.env."
read -r -p 'Type RESET KAVQEN DEMO to continue: ' confirmation
[[ "$confirmation" == 'RESET KAVQEN DEMO' ]] || { echo 'Cancelled.'; exit 1; }

qdrant_action() {
  if [[ "$mode" == docker ]]; then
    docker compose exec -T ai-service python - "$1"
  else
    (cd apps/ai-service && .venv/bin/python - "$1")
  fi <<'PY'
import os
import sys
from dotenv import load_dotenv
from qdrant_client import QdrantClient, models

load_dotenv('.env')
client = QdrantClient(url=os.getenv('QDRANT_URL', 'http://localhost:6333'),
                      api_key=os.getenv('QDRANT_API_KEY') or None, timeout=60)
collection = os.getenv('QDRANT_COLLECTION', 'kavqen_knowledge_v1')
client.get_collections()
if sys.argv[1] == 'clear' and client.collection_exists(collection):
    client.delete(collection, points_selector=models.FilterSelector(filter=models.Filter()), wait=True)
print('Qdrant ' + sys.argv[1] + ' complete.')
PY
}

# Check vector storage before the destructive database command.
qdrant_action check
if [[ "$mode" == docker ]]; then
  docker compose run --rm --no-deps gateway node node_modules/prisma/build/index.js migrate reset --force --skip-seed
else
  pnpm --filter gateway exec prisma migrate reset --force --skip-seed
fi
qdrant_action clear
if [[ "$mode" == docker ]]; then
  docker compose run --rm --no-deps gateway node --import tsx prisma/seed.ts
else
  pnpm --filter gateway exec tsx prisma/seed.ts
fi
echo 'Demo restored: three agents, three workflows/forms, and seeded submissions.'
