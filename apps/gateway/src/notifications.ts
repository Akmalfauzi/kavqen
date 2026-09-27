import { notifyUser } from './notification-realtime.js';
import { Router, Request, Response } from 'express';
import { prisma } from './db.js';
import { authMiddleware } from './middlewares.js';
import { getActor } from './access.js';

export const notificationsRouter = Router();
notificationsRouter.use(authMiddleware);

notificationsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const data = await prisma.userNotification.findMany({
      where: { userId: actor.id, deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

notificationsRouter.patch('/read-all', async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
    await prisma.userNotification.updateMany({
      where: { userId: actor.id, readAt: null, deletedAt: null }, data: { readAt: new Date() }
    });
    notifyUser(actor.id);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

notificationsRouter.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const result = await prisma.userNotification.updateMany({
      where: { id: req.params.id as string, userId: actor.id, deletedAt: null }, data: { readAt: new Date() }
    });
    if (!result.count) return res.status(404).json({ success: false, message: 'Notification not found' });
    notifyUser(actor.id);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

notificationsRouter.delete('/', async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
    await prisma.userNotification.updateMany({
      where: { userId: actor.id, deletedAt: null }, data: { deletedAt: new Date() }
    });
    notifyUser(actor.id);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
