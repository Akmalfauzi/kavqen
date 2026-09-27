import { Router, Request, Response } from 'express';
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

knowledgeRouter.post('/', async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    if (!canOwnWorkflows(actor)) return res.status(403).json({ success: false, message: 'Owner access required' });
    const input = validate(req.body);
    if (!input) return res.status(400).json({ success: false, message: 'Title, category, and content are required within size limits' });
    const data = await prisma.knowledgeDocument.create({ data: { ...input, ownerId: actor!.id } });
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
    const result = await prisma.knowledgeDocument.updateMany({
      where: { id: req.params.id as string, ownerId: actor!.id, deletedAt: null }, data: input
    });
    if (!result.count) return res.status(404).json({ success: false, message: 'Document not found' });
    const data = await prisma.knowledgeDocument.findUnique({ where: { id: req.params.id as string } });
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

knowledgeRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    if (!canOwnWorkflows(actor)) return res.status(403).json({ success: false, message: 'Owner access required' });
    const result = await prisma.knowledgeDocument.updateMany({
      where: { id: req.params.id as string, ownerId: actor!.id, deletedAt: null }, data: { deletedAt: new Date() }
    });
    if (!result.count) return res.status(404).json({ success: false, message: 'Document not found' });
    return res.json({ success: true, data: null });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
