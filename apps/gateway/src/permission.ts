import { Router, Request, Response } from 'express';
import { prisma } from './db.js';
import { authMiddleware, demoGuard } from './middlewares.js';

export const permissionRouter = Router();

permissionRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const groups = await prisma.permissionGroup.findMany({
      where: { deletedAt: null },
      include: {
        permissions: {
          where: { deletedAt: null },
          select: { id: true, name: true, description: true },
        },
      },
    });
    return res.status(200).json({ success: true, message: 'Permissions retrieved successfully', data: groups });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

permissionRouter.post('/', authMiddleware, demoGuard, async (req: Request, res: Response) => {
  try {
    const { name, description, groupName } = req.body;
    if (!name || !groupName) return res.status(400).json({ success: false, message: 'Name and group name are required' });

    let group = await prisma.permissionGroup.findFirst({ where: { name: groupName, deletedAt: null } });
    if (!group) {
      group = await prisma.permissionGroup.create({ data: { name: groupName } });
    }

    const existing = await prisma.permission.findFirst({ where: { name, deletedAt: null } });
    if (existing) return res.status(400).json({ success: false, message: 'Permission already exists' });

    const perm = await prisma.permission.create({
      data: { name, description: description || '', groupId: group.id }
    });
    return res.status(201).json({ success: true, message: 'Permission created', data: perm });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

permissionRouter.put('/:id', authMiddleware, demoGuard, async (req: Request, res: Response) => {
  try {
    const { name, description, groupName } = req.body;
    if (!name || !groupName) return res.status(400).json({ success: false, message: 'Name and group name are required' });

    const perm = await prisma.permission.findFirst({ where: { id: req.params.id as string, deletedAt: null } });
    if (!perm) return res.status(404).json({ success: false, message: 'Permission not found' });

    const existing = await prisma.permission.findFirst({ where: { name, id: { not: req.params.id as string }, deletedAt: null } });
    if (existing) return res.status(400).json({ success: false, message: 'Permission already exists' });

    let group = await prisma.permissionGroup.findFirst({ where: { name: groupName, deletedAt: null } });
    if (!group) {
      group = await prisma.permissionGroup.create({ data: { name: groupName } });
    }

    const updated = await prisma.permission.update({
      where: { id: req.params.id as string },
      data: { name, description: description || '', groupId: group.id }
    });
    return res.status(200).json({ success: true, message: 'Permission updated', data: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

permissionRouter.delete('/:id', authMiddleware, demoGuard, async (req: Request, res: Response) => {
  try {
    const perm = await prisma.permission.findFirst({ where: { id: req.params.id as string, deletedAt: null } });
    if (!perm) return res.status(404).json({ success: false, message: 'Permission not found' });

    await prisma.permission.update({ where: { id: req.params.id as string }, data: { deletedAt: new Date() } });
    return res.status(200).json({ success: true, message: 'Permission deleted', data: null });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
