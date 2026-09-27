import { prisma } from './db.js';

export async function getActor(req: any) {
  return prisma.user.findFirst({
    where: { id: req.user?.id, deletedAt: null },
    include: { role: true }
  });
}

export function canOwnWorkflows(actor: Awaited<ReturnType<typeof getActor>>) {
  return actor?.role?.code === 'SUPER-ADMIN' || actor?.role?.code === 'ADMIN';
}

export function ownsWorkflow(actor: Awaited<ReturnType<typeof getActor>>, workflow: { ownerId: string | null }) {
  return !!actor && canOwnWorkflows(actor) &&
    (workflow.ownerId === actor.id || (workflow.ownerId === null && actor.role?.code === 'SUPER-ADMIN'));
}

export async function hasActiveFormGrant(userId: string, workflowId: string) {
  const grant = await prisma.formGrant.findUnique({
    where: { userId_workflowId: { userId, workflowId } },
    include: { accessCode: true }
  });
  return !!grant && grant.expiresAt > new Date() && !grant.accessCode.revokedAt &&
    grant.accessCode.expiresAt > new Date();
}
