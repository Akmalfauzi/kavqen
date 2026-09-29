import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_AGENTS, DEMO_WORKFLOWS, inviteDemoParticipant } from '../src/demo.js';
import { indexKnowledge } from '../src/knowledge-index.js';

const field = (name: string, label: string, type = 'string', options: string[] = []) => ({ name, label, type, options, required: true, prompt_hint: `Ask for ${label.toLowerCase()}. Confirm the answer; do not guess.` });
export const scenarios = [
  { agent: 'sarah', id: 'demo-merchant', name: 'Merchant Onboarding', description: 'Collect business details for a merchant account review.', code: 'KQ-DEMO-MERCHANT',
    fields: [field('merchant_name', 'Full name'), field('business_name', 'Business name'), field('business_email', 'Business email', 'email'), field('monthly_orders', 'Monthly order volume', 'enum', ['Under 100', '100-1000', 'Over 1000'])],
    answers: ['Taylor Morgan', 'Bright Coffee', 'taylor@example.com', '100-1000'],
    knowledge: 'Merchant applications are reviewed within two business days. Supported businesses sell lawful products and services. The voice form collects information only; it does not approve an account or collect payment details.' },
  { agent: 'clinic', id: 'demo-clinic', name: 'Clinic Appointment Request', description: 'Collect contact details and preferred appointment times. This is not medical triage.', code: 'KQ-DEMO-CLINIC',
    fields: [field('patient_name', 'Full name'), field('patient_phone', 'Phone number', 'phone'), field('visit_reason', 'Reason for visit', 'text'), field('preferred_date', 'Preferred appointment date', 'date')],
    answers: ['Jordan Lee', '+12025550123', 'Routine checkup', '2026-10-15'],
    knowledge: 'Clinic reception is open Monday to Friday, 9 AM to 5 PM. Requests are reviewed by reception; a submitted form is not a confirmed booking. This demo does not provide diagnoses or emergency triage. For an emergency, contact local emergency services.' },
  { agent: 'complaint', id: 'demo-support', name: 'Customer Support Request', description: 'Capture an order issue and preferred resolution for a support team.', code: 'KQ-DEMO-SUPPORT',
    fields: [field('customer_name', 'Full name'), field('order_reference', 'Order reference'), field('issue_summary', 'Issue description', 'text'), field('resolution', 'Preferred resolution', 'enum', ['Replacement', 'Refund review', 'Contact support'])],
    answers: ['Casey Kim', 'ORDER-1042', 'The package arrived with a damaged item.', 'Replacement'],
    knowledge: 'Support responds within one business day. Keep the order reference and packaging photos available. A request does not guarantee a refund or replacement; a human support agent reviews eligibility. Never ask for passwords or credit card numbers.' },
];

export async function seedDemo(db: PrismaClient, ownerRoleId: string, participantRoleId: string) {
  const password = await bcrypt.hash('KavqenDemo2026!', 10);
  const owner = await db.user.upsert({ where: { email: 'owner@demo.kavqen.test' },
    create: { email: 'owner@demo.kavqen.test', name: 'Kavqen Demo Owner', password, roleId: ownerRoleId, language: 'en' },
    update: { name: 'Kavqen Demo Owner', password, roleId: ownerRoleId, deletedAt: null, language: 'en' } });
  const expiresAt = new Date(Date.now() + 30 * 86400000);
  const configs = path.resolve(process.cwd(), '../../configs');
  mkdirSync(configs, { recursive: true });

  // Verify embedding/index availability before changing the active demo catalog.
  for (const scenario of scenarios) {
    await indexKnowledge({ id: `demo-knowledge-${scenario.agent}`, ownerId: owner.id, title: scenario.name, content: scenario.knowledge });
  }

  // Retire old catalog entries without deleting their real submissions/history.
  await db.$transaction(async tx => {
    await tx.workflow.updateMany({ where: { id: { notIn: DEMO_WORKFLOWS } }, data: { deletedAt: new Date(), agentId: null } });
    await tx.agent.updateMany({ where: { id: { notIn: DEMO_AGENTS } }, data: { deletedAt: new Date(), isActive: false } });
  });
  for (const [i, scenario] of scenarios.entries()) {
    for (const f of scenario.fields) await db.field.upsert({ where: { name: f.name }, create: { ...f, category: 'Demo' }, update: { ...f, deletedAt: null } });
    const nodes = [
      { id: 'start', type: 'trigger', title: 'Start', position: { x: 300, y: 0 }, config: {} },
      ...scenario.fields.map((f, n) => ({ id: `step-${n}`, type: 'step', title: f.label, position: { x: 300, y: 180 * (n + 1) }, config: { step_name: f.label, purpose: f.prompt_hint, target_fields: [f.name] } })),
      { id: 'end', type: 'action', title: 'Review and submit', position: { x: 300, y: 1000 }, config: {} },
    ];
    const edges = nodes.slice(1).map((node, n) => ({ id: `edge-${n}`, source: nodes[n].id, target: node.id }));
    const agent = { name: `${scenario.name} Agent`, role: scenario.description, themeId: scenario.id, voice: 'Alba (Natural & Clear)', model: 'AssemblyAI Voice Agent', workflowSteps: nodes.length, avatarGradient: ['from-pink-500 to-amber-500', 'from-sky-500 to-indigo-600', 'from-emerald-500 to-cyan-500'][i], description: scenario.description, tags: ['Demo', 'Voice forms'], isActive: true, deletedAt: null };
    await db.agent.upsert({ where: { id: scenario.agent }, create: { id: scenario.agent, ...agent }, update: agent });
    const workflow = { name: scenario.name, description: scenario.description, ownerId: owner.id, agentId: scenario.agent, status: 'PUBLISHED', deletedAt: null, data: { nodes, edges, publishedFields: scenario.fields } };
    await db.workflow.upsert({ where: { id: scenario.id }, create: { id: scenario.id, ...workflow }, update: workflow });
    writeFileSync(path.join(configs, `${scenario.id}.json`), JSON.stringify({ theme_id: scenario.id, title: scenario.name, description: scenario.description, nodes, edges, fields: scenario.fields }, null, 2));
    const code = { workflowId: scenario.id, createdById: owner.id, codeHash: createHash('sha256').update(scenario.code).digest('hex'), prefix: 'KQ-DEMO', expiresAt, revokedAt: null };
    await db.accessCode.upsert({ where: { id: `demo-public-${scenario.id}` }, create: { id: `demo-public-${scenario.id}`, ...code }, update: code });
    await db.knowledgeDocument.upsert({ where: { id: `demo-knowledge-${scenario.agent}` }, create: { id: `demo-knowledge-${scenario.agent}`, ownerId: owner.id, title: scenario.name, category: 'Demo', content: scenario.knowledge }, update: { ownerId: owner.id, title: scenario.name, content: scenario.knowledge, deletedAt: null } });
  }
  // One record per participant/form, matching the submission uniqueness rule.
  for (let i = 0; i < 12; i++) {
    const email = i === 0 ? 'participant@demo.kavqen.test' : `participant${i}@demo.kavqen.test`;
    const user = await db.user.upsert({ where: { email }, create: { email, name: `Demo Participant ${i + 1}`, password, roleId: participantRoleId, language: 'en' }, update: { password, roleId: participantRoleId, deletedAt: null, language: 'en' } });
    for (const [n, scenario] of scenarios.entries()) {
      if (i === 0 && n > 0) continue;
      await db.formGrant.upsert({ where: { userId_workflowId: { userId: user.id, workflowId: scenario.id } }, create: { userId: user.id, workflowId: scenario.id, accessCodeId: `demo-public-${scenario.id}`, expiresAt }, update: { expiresAt } });
      const answers = Object.fromEntries(scenario.fields.map((f, j) => [f.name, j === 0 ? user.name : scenario.answers[j]]));
      const submission = { workflowId: scenario.id, userId: user.id, agentName: `${scenario.name} Agent`, data: answers, createdAt: new Date(Date.now() - (i * 3 + n + 1) * 3600000) };
      await db.submission.upsert({ where: { id: `demo-submission-${i}-${n}` }, create: { id: `demo-submission-${i}-${n}`, ...submission }, update: submission });
    }
    if (i === 0) {
      const existing = await db.accessCode.count({ where: { inviteEmail: email, workflowId: { in: DEMO_WORKFLOWS } } });
      if (!existing) await db.$transaction(tx => inviteDemoParticipant(tx, user));
    }
  }
  console.log('Demo ready: 3 agents, 3 published forms, 34 sample submissions.');
  console.log('Owner: owner@demo.kavqen.test | Participant: participant@demo.kavqen.test');
  console.log('Password: KavqenDemo2026! | Access valid until:', expiresAt.toISOString());
  console.log('Share codes:', scenarios.map(s => s.code).join(', '));
}
