import express, { Request, Response } from 'express';
import { prisma } from './db.js';
import { canOwnWorkflows, getActor } from './access.js';
import { authMiddleware, demoGuard } from './middlewares.js';

export const agentRouter = express.Router();

agentRouter.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const agents = await prisma.agent.findMany({
      where: { deletedAt: null },
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

agentRouter.post('/', authMiddleware, demoGuard, async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    if (!canOwnWorkflows(actor)) return res.status(403).json({ success: false, message: 'Owner access required' });
    // An agent is only reachable through its workflow, so the two are created
    // together: a half-made agent would be invisible in the catalog.
    const agent = await prisma.$transaction(async (tx) => {
      const created = await tx.agent.create({ data: req.body });
      await tx.workflow.create({
        data: {
          name: created.name,
          description: created.role,
          status: 'DRAFT',
          ownerId: actor!.id,
          agentId: created.id,
          data: { nodes: [], edges: [], publishedFields: [] }
        }
      });
      return tx.agent.findUniqueOrThrow({
        where: { id: created.id },
        include: { workflow: { select: { id: true, name: true, status: true } } }
      });
    });
    return res.status(201).json({ success: true, message: 'Agent created successfully', data: agent });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

agentRouter.put('/:id', authMiddleware, demoGuard, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const agent = await prisma.agent.update({ where: { id }, data: req.body });
    return res.status(200).json({ success: true, message: 'Agent updated successfully', data: agent });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

agentRouter.delete('/:id', authMiddleware, demoGuard, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    // The workflow has no other way in, so it goes with its agent.
    const agent = await prisma.$transaction(async (tx) => {
      const deletedAt = new Date();
      await tx.workflow.updateMany({ where: { agentId: id, deletedAt: null }, data: { deletedAt } });
      return tx.agent.update({ where: { id }, data: { deletedAt } });
    });
    return res.status(200).json({ success: true, message: 'Agent deleted successfully', data: agent });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
