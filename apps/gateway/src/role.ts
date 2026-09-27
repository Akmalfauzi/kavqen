import { Router, Request, Response } from 'express';
import { prisma } from './db.js';
import { authMiddleware, demoGuard } from './middlewares.js';

export const roleRouter = Router();

roleRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const roles = await prisma.role.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: { users: { where: { deletedAt: null } } },
        },
        permissions: {
          include: { permission: true }
        }
      },
    });

    const mappedRoles = roles.map(role => ({
      id: role.id,
      name: role.name,
      code: role.code,
      description: role.description,
      color: role.color,
      permissions: role.permissions.map(rp => rp.permission.name),
      userCount: role._count.users,
    }));

    return res.status(200).json({
      success: true,
      message: 'Roles retrieved successfully',
      data: mappedRoles
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

roleRouter.post('/', authMiddleware, demoGuard, async (req: Request, res: Response) => {
  try {
    const { name, code, description, color, permissions } = req.body;

    if (!name || !code) return res.status(400).json({ success: false, message: 'Role name and code are required' });

    const existingRole = await prisma.role.findFirst({
      where: { OR: [{ name: name as string }, { code: code as string }], deletedAt: null },
    });
    if (existingRole) return res.status(400).json({ success: false, message: 'Role name or code already exists' });

    const permissionRecords = permissions && Array.isArray(permissions) 
      ? await prisma.permission.findMany({ where: { name: { in: permissions } } })
      : [];

    const newRole = await prisma.role.create({
      data: {
        name,
        code,
        description: description || '',
        color: color || 'slate',
        permissions: {
          create: permissionRecords.map(p => ({ permission: { connect: { id: p.id } } }))
        }
      },
      include: { permissions: { include: { permission: true } } }
    });

    return res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: {
        ...newRole,
        permissions: newRole.permissions.map(rp => rp.permission.name),
        userCount: 0,
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

roleRouter.put('/:id', authMiddleware, demoGuard, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, code, description, color, permissions } = req.body;

    if (!name || !code) return res.status(400).json({ success: false, message: 'Role name and code are required' });

    const role = await prisma.role.findFirst({ where: { id, deletedAt: null } });
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    const existingRole = await prisma.role.findFirst({
      where: { OR: [{ name: name as string }, { code: code as string }], id: { not: id }, deletedAt: null },
    });
    if (existingRole) return res.status(400).json({ success: false, message: 'Role name or code already exists' });

    let permissionsUpdate = {};
    if (permissions && Array.isArray(permissions)) {
      const permissionRecords = await prisma.permission.findMany({ where: { name: { in: permissions } } });
      await prisma.rolePermission.deleteMany({ where: { roleId: id } });
      permissionsUpdate = {
        permissions: {
          create: permissionRecords.map(p => ({ permission: { connect: { id: p.id } } }))
        }
      };
    }

    const updatedRole = await prisma.role.update({
      where: { id },
      data: { name, code, description: description || '', color, ...permissionsUpdate },
      include: {
        _count: { select: { users: true } },
        permissions: { include: { permission: true } },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Role updated successfully',
      data: {
        ...updatedRole,
        permissions: updatedRole.permissions.map(rp => rp.permission.name),
        userCount: (updatedRole as any)._count.users,
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

roleRouter.delete('/:id', authMiddleware, demoGuard, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const role = await prisma.role.findFirst({ where: { id, deletedAt: null } });
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    if (role.code === 'ADMIN' || role.code === 'SUPER-ADMIN') {
      return res.status(403).json({ success: false, message: 'Cannot delete critical roles' });
    }

    await prisma.role.update({ where: { id }, data: { deletedAt: new Date() } });
    return res.status(200).json({ success: true, message: 'Role deleted successfully', data: null });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
