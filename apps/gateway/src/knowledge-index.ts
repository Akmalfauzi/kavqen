import { createHash } from 'node:crypto';
import { prisma } from './db.js';

type Document = { id: string; ownerId: string; title: string; content: string };
export const knowledgeRevision = (document: Pick<Document, 'title' | 'content'>) => createHash('sha256').update(`${document.title}\n${document.content}`).digest('hex');

async function request(path: string, method: string, body?: unknown) {
  const token = process.env.KNOWLEDGE_INTERNAL_TOKEN;
  if (!token) throw new Error('Knowledge service is not configured');
  const response = await fetch(`${process.env.AI_SERVICE_URL || 'http://localhost:8001'}/api/knowledge${path}`, {
    method, headers: { 'Content-Type': 'application/json', 'X-Knowledge-Token': token },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error('Knowledge index is unavailable. Please try again.');
  return response.json();
}
export async function indexKnowledge(document: Document) {
  await request(`/documents/${encodeURIComponent(document.id)}`, 'PUT', document);
}
export async function deleteKnowledge(document: Document) {
  await request(`/documents/${encodeURIComponent(document.id)}?ownerId=${encodeURIComponent(document.ownerId)}`, 'DELETE');
}
export async function searchKnowledge(ownerId: string, query: string) {
  const result = await request('/search', 'POST', { ownerId, query: query.slice(0, 4000) }) as {
    data: Array<{ documentId: string; revision: string; title: string; content: string; score: number }>;
  };
  // PostgreSQL remains authoritative for ownership/deletion and document revision.
  const documents = await prisma.knowledgeDocument.findMany({ where: { ownerId, deletedAt: null, id: { in: result.data.map(hit => hit.documentId) } } });
  const current = new Map(documents.map(document => [document.id, knowledgeRevision(document)]));
  return result.data.filter(hit => current.get(hit.documentId) === hit.revision).map(({ documentId, title, content, score }) => ({ id: documentId, title, content, score }));
}
