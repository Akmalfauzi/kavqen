import { Router, Request, Response } from 'express';
import { indexKnowledge, deleteKnowledge, searchKnowledge } from './knowledge-index.js';
import { prisma } from './db.js';
import { authMiddleware } from './middlewares.js';
import { canOwnWorkflows, getActor } from './access.js';

export const knowledgeRouter = Router();
knowledgeRouter.use(authMiddleware);

function validate(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 160 ||
      typeof input.category !== 'string' || !input.category.trim() || input.category.length > 80 ||
      typeof input.content !== 'string' || !input.content.trim() || input.content.length > 20000) return null;
  return { title: input.title.trim(), category: input.category.trim(), content: input.content.trim() };
}

knowledgeRouter.get('/', async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    if (!canOwnWorkflows(actor)) return res.status(403).json({ success: false, message: 'Owner access required' });
    const data = await prisma.knowledgeDocument.findMany({
      where: { ownerId: actor!.id, deletedAt: null }, orderBy: { updatedAt: 'desc' }
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

knowledgeRouter.post('/search', async (req, res) => {
  const actor = await getActor(req);
  if (!canOwnWorkflows(actor)) return res.status(403).json({ success: false, message: 'Owner access required' });
  if (typeof req.body?.query !== 'string' || !req.body.query.trim() || req.body.query.length > 4000) return res.status(400).json({ success: false, message: 'Enter a search query (1-4000 characters)' });
  try { return res.json({ success: true, data: await searchKnowledge(actor!.id, req.body.query) }); }
  catch { return res.status(503).json({ success: false, message: 'Knowledge search is temporarily unavailable' }); }
});

knowledgeRouter.post('/', async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    if (!canOwnWorkflows(actor)) return res.status(403).json({ success: false, message: 'Owner access required' });
    const input = validate(req.body);
    if (!input) return res.status(400).json({ success: false, message: 'Title, category, and content are required within size limits' });
    const data = await prisma.$transaction(async tx => {
      const document = await tx.knowledgeDocument.create({ data: { ...input, ownerId: actor!.id } });
      await indexKnowledge(document);
      return document;
    }, { timeout: 90000 });
    return res.status(201).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

knowledgeRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    if (!canOwnWorkflows(actor)) return res.status(403).json({ success: false, message: 'Owner access required' });
    const input = validate(req.body);
    if (!input) return res.status(400).json({ success: false, message: 'Title, category, and content are required within size limits' });
    const data = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${String(req.params.id)}))`;
      const document = await tx.knowledgeDocument.findFirst({ where: { id: String(req.params.id), ownerId: actor!.id, deletedAt: null } });
      if (!document) return null;
      const updated = await tx.knowledgeDocument.update({ where: { id: document.id }, data: input });
      await indexKnowledge(updated);
      return updated;
    }, { timeout: 90000 });
    if (!data) return res.status(404).json({ success: false, message: 'Document not found' });
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

knowledgeRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    if (!canOwnWorkflows(actor)) return res.status(403).json({ success: false, message: 'Owner access required' });
    const removed = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${String(req.params.id)}))`;
      const document = await tx.knowledgeDocument.findFirst({ where: { id: String(req.params.id), ownerId: actor!.id, deletedAt: null } });
      if (!document) return false;
      await deleteKnowledge(document);
      await tx.knowledgeDocument.update({ where: { id: document.id }, data: { deletedAt: new Date() } });
      return true;
    }, { timeout: 90000 });
    if (!removed) return res.status(404).json({ success: false, message: 'Document not found' });
    return res.json({ success: true, data: null });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
