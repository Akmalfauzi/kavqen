import express, { Request, Response } from 'express';
import { prisma } from './db.js';
import { authMiddleware, demoGuard } from './middlewares.js';
import { validateFieldInput } from './field-validation.js';

export const fieldRouter = express.Router();

fieldRouter.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const fields = await prisma.field.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ success: true, message: 'Success', data: fields });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

fieldRouter.post('/', authMiddleware, demoGuard, async (req: Request, res: Response) => {
  try {
    const validated = validateFieldInput(req.body);
    if (validated.error) return res.status(400).json({ success: false, message: validated.error });
    const existing = await prisma.field.findUnique({ where: { name: validated.data!.name } });
    if (existing) return res.status(409).json({ success: false, message: 'Field name already exists' });
    const field = await prisma.field.create({ data: validated.data! });
    return res.status(201).json({ success: true, message: 'Created', data: field });
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'Field name already exists' });
    return res.status(500).json({ success: false, message: error.message });
  }
});

fieldRouter.put('/:id', authMiddleware, demoGuard, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const validated = validateFieldInput(req.body);
    if (validated.error) return res.status(400).json({ success: false, message: validated.error });
    const current = await prisma.field.findFirst({ where: { id, deletedAt: null } });
    if (!current) return res.status(404).json({ success: false, message: 'Field not found' });
    if (validated.data!.name !== current.name) {
      const existing = await prisma.field.findUnique({ where: { name: validated.data!.name } });
      if (existing) return res.status(409).json({ success: false, message: 'Field name already exists' });
    }
    const field = await prisma.field.update({ where: { id }, data: validated.data! });
    return res.status(200).json({ success: true, message: 'Updated', data: field });
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'Field name already exists' });
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Field not found' });
    return res.status(500).json({ success: false, message: error.message });
  }
});

fieldRouter.delete('/:id', authMiddleware, demoGuard, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const current = await prisma.field.findFirst({ where: { id, deletedAt: null } });
    if (!current) return res.status(404).json({ success: false, message: 'Field not found' });
    const field = await prisma.field.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    return res.status(200).json({ success: true, message: 'Deleted', data: field });
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Field not found' });
    return res.status(500).json({ success: false, message: error.message });
  }
});
