import { notifyUser } from './notification-realtime.js';
import { sendSubmissionNotification, mailEnabled } from './mail.js';
import { createSubmissionEvent } from './integrations.js';
import { Router, Request, Response } from 'express';
import { prisma } from './db.js';
import { authMiddleware } from './middlewares.js';
import { canOwnWorkflows, getActor, hasActiveFormGrant, ownsWorkflow } from './access.js';
import { validateSubmission, type PublishedField } from './submission-validation.js';

export const submissionRouter = Router();

function receiptWithFields<T extends { workflow: { name: string; data: unknown } }>(submission: T) {
  const config = submission.workflow.data as { publishedFields?: unknown } | null;
  const fields = Array.isArray(config?.publishedFields) ? config.publishedFields : [];
  return {
    ...submission,
    workflow: { name: submission.workflow.name },
    fields: fields.filter((field): field is { name: string; label?: string } =>
      Boolean(field && typeof field === 'object' && typeof field.name === 'string'))
      .map(field => ({ name: field.name, label: typeof field.label === 'string' ? field.label : undefined })),
  };
}

submissionRouter.get('/mine', authMiddleware, async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
    // A receipt remains accessible to its submitter after form access expires.
    const submissions = await prisma.submission.findMany({
      where: { userId: actor.id },
      select: { id: true, workflowId: true, agentName: true, data: true, createdAt: true,
        workflow: { select: { name: true, data: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return res.json({ success: true, data: submissions.map(receiptWithFields) });
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal memuat riwayat form.' });
  }
});

submissionRouter.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { workflowId, agentName, data } = req.body;
    if (typeof workflowId !== 'string' || !workflowId || !data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ success: false, message: 'Workflow and filled form fields are required' });
    }

    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, status: 'PUBLISHED', deletedAt: null }
    });
    if (!workflow) return res.status(404).json({ success: false, message: 'Published workflow not found' });
    if (!ownsWorkflow(actor, workflow) && !await hasActiveFormGrant(actor.id, workflow.id)) {
      return res.status(403).json({ success: false, message: 'Form access expired or not granted' });
    }

    const workflowData = workflow.data && typeof workflow.data === 'object' && !Array.isArray(workflow.data)
      ? workflow.data : {};
    const fields = Array.isArray(workflowData.publishedFields)
      ? workflowData.publishedFields as unknown as PublishedField[] : [];
    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'Form contains invalid fields' });
    }
    const validated = validateSubmission(fields, data);
    if (validated.error) return res.status(400).json({ success: false, message: validated.error });

    const outcome = await prisma.$transaction(async (tx) => {
      // Serialize submissions for this account/form without deleting legacy receipts.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actor.id + ':' + workflowId}, 0))`;
      const existing = await tx.submission.findFirst({ where: { userId: actor.id, workflowId }, orderBy: { createdAt: 'asc' } });
      if (existing) return { submission: existing, created: false };

      const created = await tx.submission.create({
        data: {
          workflowId,
          userId: actor.id,
          agentName: typeof agentName === 'string' ? agentName : null,
          data: validated.data!
        }
      });
      if (workflow.ownerId) await tx.userNotification.create({ data: {
        userId: workflow.ownerId,
        title: 'New form submission',
        description: `${workflow.name} received a new submission.`,
        kind: 'submission'
      } });
      return { submission: created, created: true };
    });
    if (outcome.created && workflow.ownerId) {
      notifyUser(workflow.ownerId);
      // Email is best-effort: a mail outage must not fail an accepted submission.
      if (mailEnabled()) prisma.user.findUnique({ where: { id: workflow.ownerId }, select: { email: true } })
        .then(owner => owner && sendSubmissionNotification(
          owner.email,
          workflow.name,
          actor.name || actor.email,
          fields.map(field => ({
            label: field.label || field.name,
            value: String((validated.data as Record<string, unknown>)[field.name] ?? '')
          }))
        ))
        .catch(error => console.error('Submission email failed:', error?.message || error));

      // Only a date answer can become an appointment; forms without one are skipped.
      // A datetime field wins over a plain date: it gives a real slot, not a whole day.
      const dateField = fields.find(field => field.type === 'datetime') || fields.find(field => field.type === 'date');
      const dateValue = dateField && (validated.data as Record<string, string>)[dateField.name];
      if (dateValue) {
        const answers = fields
          .map(field => `${field.label || field.name}: ${(validated.data as Record<string, string>)[field.name] ?? ''}`)
          .join('\n');
        createSubmissionEvent(workflow.ownerId, workflow.name, answers, dateValue)
          .catch(error => console.error('Calendar event failed:', error?.message || error));
      }
    }
    return res.status(outcome.created ? 201 : 200).json({ success: true, alreadySubmitted: !outcome.created, message: outcome.created ? 'Form submitted' : 'Form already submitted', data: outcome.submission });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

submissionRouter.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    if (!canOwnWorkflows(actor)) return res.status(403).json({ success: false, message: 'Owner access required' });
    const workflowId = typeof req.query.workflowId === 'string' ? req.query.workflowId : undefined;
    const submissions = await prisma.submission.findMany({
      where: { ...(workflowId ? { workflowId } : {}), workflow: { ownerId: actor!.id } },
      include: { user: { select: { name: true, email: true } }, workflow: { select: { name: true, data: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    return res.status(200).json({ success: true, message: 'Submissions retrieved', data: submissions.map(receiptWithFields) });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
