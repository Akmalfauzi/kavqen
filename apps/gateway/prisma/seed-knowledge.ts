import 'dotenv/config';
import { prisma } from '../src/db.js';
import { indexKnowledge } from '../src/knowledge-index.js';
async function main() {
  const documents = await prisma.knowledgeDocument.findMany({ where: { deletedAt: null } });
  for (const document of documents) await indexKnowledge(document);
  console.log(`Indexed ${documents.length} documents in Qdrant.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
