import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import CryptoJS from 'crypto-js';
import { randomUUID } from 'node:crypto';
import { prisma } from './db.js';
import { authRouter } from './auth.js';
import { knowledgeRouter } from './knowledge.js';
import { shareRouter } from './share.js';
import { submissionRouter } from './submission.js';
import { agentRouter } from './agent.js';
import { workflowRouter } from './workflow.js';
import { DEMO_WORKFLOWS } from './demo.js';

test('judge signup, invitation acceptance, own submission and immutable catalog', async () => {
  process.env.MAIL_DRIVER = 'disabled';
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter); app.use('/share', shareRouter);
  app.use('/knowledge', knowledgeRouter);
  app.use('/submissions', submissionRouter); app.use('/agents', agentRouter); app.use('/workflows', workflowRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.on('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const email = `judge-test-${randomUUID()}@example.com`;
  let userId = '';
  const password = CryptoJS.AES.encrypt('JudgeTest123!', process.env.ENCRYPTION_KEY || 'default-hackathon-key').toString();
  const call = async (path: string, token: string, method = 'GET', body?: unknown) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() as any };
  };
  try {
    assert.equal(await prisma.workflow.count({ where: { id: { in: DEMO_WORKFLOWS }, deletedAt: null, status: 'PUBLISHED' } }), 3, 'Run the demo seed first');
    const signup = await call('/auth/register', '', 'POST', { name: 'Judge Test', email, password, roleId: 'SUPER-ADMIN' });
    assert.equal(signup.status, 201); userId = signup.body.data.user.id;
    const token = signup.body.data.token;
    const dashboard = await call('/share/dashboard', token);
    assert.equal(dashboard.body.data.invites.length, 3);
    const invite = await prisma.accessCode.findFirstOrThrow({ where: { inviteEmail: email, workflowId: 'demo-merchant' } });
    assert.equal((await call('/share/forms/demo-merchant', token)).status, 404);
    assert.equal((await call(`/share/invites/${invite.id}/respond`, token, 'POST', { action: 'accept' })).status, 200);
    assert.equal((await call('/share/forms/demo-merchant', token)).status, 200);
    const input = { workflowId: 'demo-merchant', data: { merchant_name: 'Judge Test', business_name: 'Demo Shop', business_email: email, monthly_orders: 'Under 100' } };
    const results = await Promise.all([1, 2].map(() => call('/submissions', token, 'POST', input)));
    assert.deepEqual(results.map(r => r.status).sort(), [200, 201], JSON.stringify(results.map(r => r.body)));
    assert.equal(await prisma.submission.count({ where: { userId } }), 1);
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: 'owner@demo.kavqen.test' } });
    const ownerLogin = await call('/auth/login', '', 'POST', { email: owner.email, password: CryptoJS.AES.encrypt('KavqenDemo2026!', process.env.ENCRYPTION_KEY || 'default-hackathon-key').toString() });
    assert.equal(ownerLogin.status, 200);
    const ownerToken = ownerLogin.body.data.token;
    const search = await call('/knowledge/search', ownerToken, 'POST', { query: 'When is the clinic reception open?', ownerId: 'forged-owner' });
    assert.equal(search.status, 200);
    assert.equal(search.body.data[0].id, 'demo-knowledge-clinic');
    const catalog = await call('/agents', ownerToken);
    assert.equal(catalog.body.data.length, 3);
    for (const endpoint of ['/agents', '/workflows']) {
      assert.equal((await call(endpoint, ownerToken, 'POST', {})).status, 403);
      assert.equal((await call(`${endpoint}/clinic`, ownerToken, 'DELETE')).status, 403);
    }
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (userId) {
      await prisma.submission.deleteMany({ where: { userId } });
      await prisma.formGrant.deleteMany({ where: { userId } });
      await prisma.userNotification.deleteMany({ where: { userId } });
    }
    await prisma.accessCode.deleteMany({ where: { inviteEmail: email } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  }
});
