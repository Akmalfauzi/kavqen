import { notifyUser } from './notification-realtime.js';
import { Router, Request, Response } from 'express';
import { createHash, randomBytes } from 'crypto';
import { prisma } from './db.js';
import { authMiddleware } from './middlewares.js';
import { getActor, ownsWorkflow, hasActiveFormGrant } from './access.js';

export const shareRouter = Router();
shareRouter.use(authMiddleware);

const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '');
const hashCode = (code: string) => createHash('sha256').update(normalizeCode(code)).digest('hex');

shareRouter.post('/codes', async (req: Request, res: Response) => {
  try {
    const { workflowId, expiresAt } = req.body;
    const expiry = new Date(expiresAt);
    if (typeof workflowId !== 'string' || !Number.isFinite(expiry.getTime()) || expiry <= new Date()) {
      return res.status(400).json({ success: false, message: 'Valid workflow and future expiry are required' });
    }
    const actor = await getActor(req);
    const workflow = await prisma.workflow.findFirst({ where: { id: workflowId, deletedAt: null } });
    if (!workflow || !ownsWorkflow(actor, workflow)) return res.status(404).json({ success: false, message: 'Workflow not found' });
    if (workflow.status !== 'PUBLISHED') return res.status(400).json({ success: false, message: 'Publish workflow before sharing' });

    const code = `KQ-${randomBytes(8).toString('hex').toUpperCase()}`;
    const record = await prisma.accessCode.create({
      data: { workflowId, createdById: actor!.id, codeHash: hashCode(code), prefix: code.slice(0, 7), expiresAt: expiry }
    });
    return res.status(201).json({ success: true, message: 'Access code created', data: {
      id: record.id, code, prefix: record.prefix, expiresAt: record.expiresAt, createdAt: record.createdAt
    } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

shareRouter.get('/codes', async (req: Request, res: Response) => {
  try {
    const workflowId = String(req.query.workflowId || '');
    const actor = await getActor(req);
    const workflow = await prisma.workflow.findFirst({ where: { id: workflowId, deletedAt: null } });
    if (!workflow || !ownsWorkflow(actor, workflow)) return res.status(404).json({ success: false, message: 'Workflow not found' });
    const codes = await prisma.accessCode.findMany({
      where: { workflowId },
      select: { id: true, prefix: true, expiresAt: true, revokedAt: true, createdAt: true, inviteEmail: true, inviteStatus: true },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ success: true, message: 'Access codes retrieved', data: codes });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

shareRouter.delete('/codes/:id', async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    const code = await prisma.accessCode.findUnique({
      where: { id: req.params.id as string }, include: { workflow: true }
    });
    if (!code || !ownsWorkflow(actor, code.workflow)) return res.status(404).json({ success: false, message: 'Access code not found' });
    await prisma.accessCode.update({ where: { id: code.id }, data: { revokedAt: new Date() } });
    if (code.inviteEmail) {
      const recipient = await prisma.user.findFirst({ where: { email: { equals: code.inviteEmail, mode: 'insensitive' }, deletedAt: null } });
      if (recipient) notifyUser(recipient.id);
    }
    return res.status(200).json({ success: true, message: 'Access code revoked', data: null });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

shareRouter.post('/redeem', async (req: Request, res: Response) => {
  try {
    const rawCode = req.body.code;
    if (typeof rawCode !== 'string' || !rawCode.trim()) {
      return res.status(400).json({ success: false, message: 'Access code is required' });
    }
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const code = await prisma.accessCode.findUnique({
      where: { codeHash: hashCode(rawCode) }, include: { workflow: true }
    });
    if (!code || code.inviteEmail || code.revokedAt || code.expiresAt <= new Date() ||
        code.workflow.deletedAt || code.workflow.status !== 'PUBLISHED') {
      return res.status(400).json({ success: false, message: 'Code invalid or expired' });
    }
    const grant = await prisma.formGrant.upsert({
      where: { userId_workflowId: { userId: actor.id, workflowId: code.workflowId } },
      update: { accessCodeId: code.id, expiresAt: code.expiresAt, redeemedAt: new Date() },
      create: { userId: actor.id, workflowId: code.workflowId, accessCodeId: code.id, expiresAt: code.expiresAt }
    });
    return res.status(200).json({ success: true, message: 'Form access granted', data: {
      workflowId: grant.workflowId, name: code.workflow.name, expiresAt: grant.expiresAt
    } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

shareRouter.get('/forms', async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const grants = await prisma.formGrant.findMany({
      where: { userId: actor.id, expiresAt: { gt: new Date() }, accessCode: { revokedAt: null, expiresAt: { gt: new Date() } },
        workflow: { status: 'PUBLISHED', deletedAt: null } },
      include: { workflow: { select: { id: true, name: true, description: true } } },
      orderBy: { redeemedAt: 'desc' }
    });
    return res.status(200).json({ success: true, message: 'Available forms retrieved', data: grants.map((grant) => ({
      id: grant.workflow.id, name: grant.workflow.name, description: grant.workflow.description, expiresAt: grant.expiresAt
    })) });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

shareRouter.get('/forms/:id', async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const workflow = await prisma.workflow.findFirst({
      where: { id: req.params.id as string, status: 'PUBLISHED', deletedAt: null }
    });
    if (!workflow || (!ownsWorkflow(actor, workflow) && !await hasActiveFormGrant(actor.id, workflow.id))) {
      return res.status(404).json({ success: false, message: 'Form unavailable or access expired' });
    }
    const submission = await prisma.submission.findFirst({ where: { userId: actor.id, workflowId: workflow.id }, orderBy: { createdAt: 'asc' }, select: { id: true, data: true, createdAt: true } });
    const data = workflow.data && typeof workflow.data === 'object' && !Array.isArray(workflow.data) ? workflow.data : {};
    return res.status(200).json({ success: true, message: 'Form retrieved', data: {
      id: workflow.id, name: workflow.name, description: workflow.description, submission,
      fields: Array.isArray(data.publishedFields) ? data.publishedFields : []
    } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

shareRouter.post('/invites', async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const expiry = new Date(req.body.expiresAt);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof req.body.workflowId !== 'string' || !Number.isFinite(expiry.getTime()) || expiry <= new Date()) {
    return res.status(400).json({ success: false, message: 'Isi email dan waktu kedaluwarsa yang valid.' });
  }
  try {
    const actor = await getActor(req);
    const workflow = await prisma.workflow.findFirst({ where: { id: req.body.workflowId, deletedAt: null, status: 'PUBLISHED' } });
    if (!workflow || !ownsWorkflow(actor, workflow)) return res.status(404).json({ success: false, message: 'Form tidak tersedia.' });
    if (email === actor!.email.toLowerCase()) return res.status(400).json({ success: false, message: 'Tidak bisa mengundang akun sendiri.' });
    const recipient = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null } });
    await prisma.$transaction(async tx => {
      await tx.accessCode.updateMany({ where: { workflowId: workflow.id, inviteEmail: email, inviteStatus: 'PENDING', revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.accessCode.create({ data: { workflowId: workflow.id, createdById: actor!.id, codeHash: hashCode(randomBytes(32).toString('hex')), prefix: 'INVITE', inviteEmail: email, inviteStatus: 'PENDING', expiresAt: expiry } });
      if (recipient) await tx.userNotification.create({ data: { userId: recipient.id, title: 'New form invitation', description: `${actor!.name || actor!.email} invited you to complete ${workflow.name}. Open your dashboard to respond.`, kind: 'invitation' } });
    });
    if (recipient) notifyUser(recipient.id);
    return res.status(201).json({ success: true, message: 'Undangan tersedia di dashboard penerima saat login dengan email tersebut.' });
  } catch { return res.status(500).json({ success: false, message: 'Gagal membuat undangan.' }); }
});

shareRouter.get('/dashboard', async (req, res) => {
  try {
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const now = new Date();
    const [grants, submissions, invites] = await Promise.all([
      prisma.formGrant.findMany({ where: { userId: actor.id, expiresAt: { gt: now }, accessCode: { revokedAt: null, expiresAt: { gt: now } }, workflow: { status: 'PUBLISHED', deletedAt: null } }, select: { workflowId: true } }),
      prisma.submission.findMany({ where: { userId: actor.id }, select: { workflowId: true } }),
      prisma.accessCode.findMany({ where: { inviteEmail: actor.email.toLowerCase(), inviteStatus: 'PENDING', revokedAt: null, expiresAt: { gt: now }, workflow: { deletedAt: null, status: 'PUBLISHED' } }, select: { id: true, expiresAt: true, workflow: { select: { name: true, description: true } }, createdBy: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' } }),
    ]);
    const filled = new Set(submissions.map(s => s.workflowId));
    return res.json({ success: true, data: { invites, totals: { active: grants.length, pending: invites.length, submitted: submissions.length, unfilled: grants.filter(g => !filled.has(g.workflowId)).length } } });
  } catch { return res.status(500).json({ success: false, message: 'Gagal memuat dashboard.' }); }
});

shareRouter.post('/invites/:id/respond', async (req, res) => {
  if (!['accept', 'decline'].includes(req.body.action)) return res.status(400).json({ success: false, message: 'Pilih terima atau tolak.' });
  try {
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const invite = await prisma.accessCode.findFirst({ where: { id: req.params.id as string, inviteEmail: actor.email.toLowerCase(), inviteStatus: 'PENDING', revokedAt: null, expiresAt: { gt: new Date() }, workflow: { deletedAt: null, status: 'PUBLISHED' } }, include: { workflow: true } });
    if (!invite) return res.status(404).json({ success: false, message: 'Undangan sudah direspons, dicabut, atau kedaluwarsa.' });
    await prisma.$transaction(async tx => {
      const changed = await tx.accessCode.updateMany({ where: { id: invite.id, inviteStatus: 'PENDING', revokedAt: null, expiresAt: { gt: new Date() } }, data: { inviteStatus: req.body.action === 'accept' ? 'ACCEPTED' : 'DECLINED' } });
      if (!changed.count) throw new Error('Invitation changed');
      if (req.body.action === 'accept') {
        const existing = await tx.formGrant.findUnique({ where: { userId_workflowId: { userId: actor.id, workflowId: invite.workflowId } }, include: { accessCode: true } });
        if (!existing || existing.accessCode.revokedAt || existing.expiresAt < invite.expiresAt) await tx.formGrant.upsert({
          where: { userId_workflowId: { userId: actor.id, workflowId: invite.workflowId } },
          create: { userId: actor.id, workflowId: invite.workflowId, accessCodeId: invite.id, expiresAt: invite.expiresAt },
          update: { accessCodeId: invite.id, expiresAt: invite.expiresAt, redeemedAt: new Date() },
        });
      }
      await tx.userNotification.create({ data: { userId: invite.createdById, title: req.body.action === 'accept' ? 'Invitation accepted' : 'Invitation declined', description: `${actor.name || actor.email} responded to the invitation for ${invite.workflow.name}.`, kind: 'invitation' } });
    });
    notifyUser(actor.id); notifyUser(invite.createdById);
    return res.json({ success: true });
  } catch { return res.status(409).json({ success: false, message: 'Gagal responded to the invitation for. Muat ulang dan coba lagi.' }); }
});
