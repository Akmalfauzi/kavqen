import type { Prisma } from '@prisma/client';
import { randomBytes, createHash } from 'node:crypto';

export const DEMO_AGENTS = ['sarah', 'clinic', 'complaint'];
export const DEMO_WORKFLOWS = ['demo-merchant', 'demo-clinic', 'demo-support'];
export const demoCatalogLocked = (_req: unknown, res: any) => res.status(403).json({ success: false, message: 'The demo catalog contains three fixed agents and workflows. Adding or deleting them is disabled.' });

// Only server-selected published demo forms can produce signup invitations.
export async function inviteDemoParticipant(tx: Prisma.TransactionClient, user: { id: string; email: string }) {
  const workflows = await tx.workflow.findMany({ where: { id: { in: DEMO_WORKFLOWS }, deletedAt: null, status: 'PUBLISHED', ownerId: { not: null } } });
  for (const workflow of workflows) {
    const code = await tx.accessCode.findFirst({ where: { id: `demo-public-${workflow.id}`, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (!code) continue;
    await tx.accessCode.create({ data: {
      workflowId: workflow.id, createdById: workflow.ownerId!, inviteEmail: user.email.toLowerCase(), inviteStatus: 'PENDING',
      codeHash: createHash('sha256').update(randomBytes(32)).digest('hex'), prefix: 'INVITE', expiresAt: code.expiresAt,
    } });
    await tx.userNotification.create({ data: { userId: user.id, kind: 'invitation', title: 'Try a voice-guided form', description: `You are invited to complete ${workflow.name}. Accept the invitation on your dashboard.` } });
  }
}
