import { Router, Request, Response } from 'express';
import { prisma } from './db.js';
import { authMiddleware, demoGuard } from './middlewares.js';

export const permissionGroupRouter = Router();

permissionGroupRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const groups = await prisma.permissionGroup.findMany({
      where: { deletedAt: null },
      include: {
        _count: { select: { permissions: { where: { deletedAt: null } } } }
      }
    });

    const mappedGroups = groups.map(g => ({
      id: g.id,
      name: g.name,
      permissionCount: g._count.permissions,
      createdAt: g.createdAt,
    }));

    return res.status(200).json({ success: true, message: 'Permission groups retrieved successfully', data: mappedGroups });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

permissionGroupRouter.post('/', authMiddleware, demoGuard, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Group name is required' });

    const existing = await prisma.permissionGroup.findFirst({ where: { name, deletedAt: null } });
    if (existing) return res.status(400).json({ success: false, message: 'Group already exists' });

    const group = await prisma.permissionGroup.create({ data: { name } });
    return res.status(201).json({ success: true, message: 'Group created', data: group });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

permissionGroupRouter.put('/:id', authMiddleware, demoGuard, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Group name is required' });

    const group = await prisma.permissionGroup.findFirst({ where: { id: req.params.id as string, deletedAt: null } });
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    const existing = await prisma.permissionGroup.findFirst({ where: { name, id: { not: req.params.id as string }, deletedAt: null } });
    if (existing) return res.status(400).json({ success: false, message: 'Group already exists' });

    const updated = await prisma.permissionGroup.update({
      where: { id: req.params.id as string },
      data: { name }
    });
    return res.status(200).json({ success: true, message: 'Group updated', data: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

permissionGroupRouter.delete('/:id', authMiddleware, demoGuard, async (req: Request, res: Response) => {
  try {
    const group = await prisma.permissionGroup.findFirst({ 
      where: { id: req.params.id as string, deletedAt: null },
      include: { _count: { select: { permissions: { where: { deletedAt: null } } } } }
    });
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (group._count.permissions > 0) return res.status(400).json({ success: false, message: 'Cannot delete group with active permissions' });

    await prisma.permissionGroup.update({ where: { id: req.params.id as string }, data: { deletedAt: new Date() } });
    return res.status(200).json({ success: true, message: 'Group deleted', data: null });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
