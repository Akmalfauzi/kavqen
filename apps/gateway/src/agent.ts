import { DEMO_AGENTS, demoCatalogLocked } from './demo.js';
import express, { Request, Response } from 'express';
import { prisma } from './db.js';
import { canOwnWorkflows, getActor } from './access.js';
import { authMiddleware, demoGuard } from './middlewares.js';

export const agentRouter = express.Router();
agentRouter.use(authMiddleware, async (req, res, next) => {
  const actor = await getActor(req);
  if (!canOwnWorkflows(actor)) return res.status(403).json({ success: false, message: 'Owner access required' });
  next();
});

agentRouter.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const agents = await prisma.agent.findMany({
      where: { deletedAt: null, id: { in: DEMO_AGENTS } },
      // One workflow per agent: the catalog is the only way into the editor now.
      include: { workflow: { select: { id: true, name: true, status: true } } },
      orderBy: { createdAt: 'asc' }
    });
    return res.status(200).json({ success: true, message: 'Agents retrieved successfully', data: agents });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

agentRouter.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const agent = await prisma.agent.findFirst({
      where: { id: req.params.id as string, deletedAt: null },
      include: { workflow: { select: { id: true, name: true, status: true } } }
    });
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });
    return res.status(200).json({ success: true, message: 'Agent retrieved successfully', data: agent });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

agentRouter.post('/', authMiddleware, demoCatalogLocked);

agentRouter.put('/:id', authMiddleware, demoGuard, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const actor = await getActor(req);
    const existing = await prisma.agent.findFirst({ where: { id, deletedAt: null }, include: { workflow: true } });
    if (!canOwnWorkflows(actor) || !existing?.workflow || existing.workflow.ownerId !== actor!.id) return res.status(403).json({ success: false, message: 'Owner access required' });
    const { name, role, isActive } = req.body;
    if ((name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 100)) || (role !== undefined && (typeof role !== 'string' || role.length > 200)) || (isActive !== undefined && typeof isActive !== 'boolean')) return res.status(400).json({ success: false, message: 'Invalid agent settings' });
    const agent = await prisma.agent.update({ where: { id }, data: { name: name?.trim(), role: role?.trim(), isActive } });
    return res.status(200).json({ success: true, message: 'Agent updated successfully', data: agent });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

agentRouter.delete('/:id', authMiddleware, demoCatalogLocked);
