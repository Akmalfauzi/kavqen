import { Router, Request, Response } from 'express';
import { prisma } from './db.js';
import { authMiddleware } from './middlewares.js';
import { canOwnWorkflows, getActor } from './access.js';

export const analyticsRouter = Router();
analyticsRouter.get('/summary', authMiddleware, async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    if (!canOwnWorkflows(actor)) return res.status(403).json({ success: false, message: 'Owner access required' });
    const [workflows, submissions] = await Promise.all([
      prisma.workflow.findMany({
        where: { ownerId: actor!.id, deletedAt: null },
        select: { id: true, name: true, status: true }
      }),
      prisma.submission.findMany({
        where: { workflow: { ownerId: actor!.id, deletedAt: null } },
        select: { id: true, workflowId: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      })
    ]);
    const now = Date.now();
    const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now - (6 - index) * 86400000).toISOString().slice(0, 10);
      return { date, count: submissions.filter((item) => item.createdAt.toISOString().slice(0, 10) === date).length };
    });
    return res.json({ success: true, data: {
      totalWorkflows: workflows.length,
      publishedWorkflows: workflows.filter((item) => item.status === 'PUBLISHED').length,
      totalSubmissions: submissions.length,
      submissionsLast7Days: submissions.filter((item) => item.createdAt.getTime() >= now - 7 * 86400000).length,
      lastSevenDays,
      byWorkflow: workflows.map((workflow) => ({
        id: workflow.id, name: workflow.name, status: workflow.status,
        submissions: submissions.filter((item) => item.workflowId === workflow.id).length
      })).sort((a, b) => b.submissions - a.submissions),
      recentSubmissions: submissions.slice(0, 10).map((item) => ({ id: item.id, workflowId: item.workflowId, createdAt: item.createdAt }))
    } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
