import { Router } from 'express';
import { prisma } from './db.js';
import { authMiddleware } from './middlewares.js';
import { getActor, canOwnWorkflows } from './access.js';

export const searchRouter = Router();
searchRouter.get('/', authMiddleware, async (req, res) => {
  if (req.query.q !== undefined && typeof req.query.q !== 'string') return res.status(400).json({ success: false, message: 'Invalid search query' });
  const query = ((req.query.q as string) || '').trim();
  if (query.length > 100) return res.status(400).json({ success: false, message: 'Search must be 100 characters or fewer.' });
  try {
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const match = { contains: query, mode: 'insensitive' as const };
    const now = new Date();
    const data: { id: string; title: string; category: string; hint: string; href: string }[] = [];
    if (canOwnWorkflows(actor)) {
      const workflows = await prisma.workflow.findMany({
        where: { deletedAt: null, AND: [
          { OR: [{ ownerId: actor.id }, ...(actor.role?.code === 'SUPER-ADMIN' ? [{ ownerId: null }] : [])] },
          { OR: [{ name: match }, { description: match }] },
        ] }, select: { id: true, name: true, description: true }, orderBy: { updatedAt: 'desc' }, take: 20,
      });
      data.push(...workflows.map(item => ({ id: `workflow:${item.id}`, title: item.name, category: 'Workflow', hint: item.description || 'Your workflow', href: `/workflows/${encodeURIComponent(item.id)}` })));
      const documents = await prisma.knowledgeDocument.findMany({
        where: { ownerId: actor.id, deletedAt: null, OR: [{ title: match }, { content: match }] },
        select: { id: true, title: true, category: true }, orderBy: { updatedAt: 'desc' }, take: 10,
      });
      data.push(...documents.map(item => ({ id: `knowledge:${item.id}`, title: item.title, category: 'Knowledge', hint: item.category, href: '/knowledge' })));
    } else {
      const grants = await prisma.formGrant.findMany({
        where: { userId: actor.id, expiresAt: { gt: now }, accessCode: { revokedAt: null, expiresAt: { gt: now } },
          workflow: { deletedAt: null, status: 'PUBLISHED', OR: [{ name: match }, { description: match }] } },
        select: { workflow: { select: { id: true, name: true, description: true } } }, orderBy: { redeemedAt: 'desc' }, take: 20,
      });
      data.push(...grants.map(({ workflow }) => ({ id: `form:${workflow.id}`, title: workflow.name, category: 'My forms', hint: workflow.description || 'A form available for you to complete', href: `/forms/${encodeURIComponent(workflow.id)}` })));
      const submissions = await prisma.submission.findMany({
        where: { userId: actor.id, workflow: { name: match } }, select: { id: true, createdAt: true, workflow: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }, take: 20,
      });
      data.push(...submissions.map(item => ({ id: `submission:${item.id}`, title: item.workflow.name, category: 'Form history', hint: `Submitted ${item.createdAt.toISOString()}`, href: `/submissions?submission=${encodeURIComponent(item.id)}` })));
    }
    return res.json({ success: true, data });
  } catch {
    return res.status(500).json({ success: false, message: 'Search failed. Please try again.' });
  }
});
