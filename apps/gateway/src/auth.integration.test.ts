import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import express from 'express';
import CryptoJS from 'crypto-js';
import jwt from 'jsonwebtoken';
import { authRouter } from './auth.js';
import { authMiddleware } from './middlewares.js';
import { prisma } from './db.js';

test('email/password authentication and single-use password recovery', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kavqen-auth-'));
  process.env.MAIL_DRIVER = 'file';
  process.env.DEV_MAIL_DIR = directory;
  process.env.NODE_ENV = 'test';
  const email = `auth-test-${randomUUID()}@example.com`;
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  app.get('/protected', authMiddleware, (_req, res) => res.json({ success: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.on('listening', resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const encrypt = (password: string) => CryptoJS.AES.encrypt(password, process.env.ENCRYPTION_KEY || 'default-hackathon-key').toString();
  async function post(path: string, body: unknown) {
    const response = await fetch(`${base}/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as any };
  }
  async function latestResetToken() {
    const files = (await readdir(directory)).sort();
    const mail = JSON.parse(await readFile(join(directory, files[files.length - 1]), 'utf8'));
    assert.equal(mail.to, email);
    const match = mail.text.match(/#token=([a-f0-9]{64})/);
    assert.ok(match);
    return match[1] as string;
  }
  try {
    assert.equal((await post('register', { email, name: 'Test' })).status, 400);
    assert.equal((await post('register', { email, name: 'Test', password: encrypt('short') })).status, 400);
    assert.equal((await post('register', { email, name: 'Test', password: encrypt('x'.repeat(73)) })).status, 400);
    const signup = await post('register', { email: ` ${email.toUpperCase()} `, name: ' Test User ', password: encrypt('OriginalPassword123') });
    assert.equal(signup.status, 201);
    assert.equal(signup.body.data.user.email, email);
    assert.equal(signup.body.data.user.name, 'Test User');
    const originalToken = signup.body.data.token;
    assert.equal((await post('register', { email, name: 'Test', password: encrypt('OriginalPassword123') })).status, 409);
    assert.equal((await post('login', { email, googleId: 'unverified-google-id' })).status, 401);
    assert.equal((await post('login', { email, password: encrypt('wrong-password') })).status, 401);
    const normal = await post('login', { email, password: encrypt('OriginalPassword123') });
    assert.equal(normal.status, 200);
    const shortClaims = jwt.decode(normal.body.data.token) as jwt.JwtPayload;
    assert.equal(shortClaims.exp! - shortClaims.iat!, 86400);
    const remembered = await post('login', { email, password: encrypt('OriginalPassword123'), rememberMe: true });
    assert.equal(remembered.status, 200);
    const longClaims = jwt.decode(remembered.body.data.token) as jwt.JwtPayload;
    assert.equal(longClaims.exp! - longClaims.iat!, 30 * 86400);
    const unknown = await post('forgot-password', { email: `missing-${randomUUID()}@example.com` });
    assert.equal((await readdir(directory)).length, 0);
    const known = await post('forgot-password', { email: email.toUpperCase() });
    assert.deepEqual(known, unknown);
    const firstToken = await latestResetToken();
    await post('forgot-password', { email });
    const nextToken = await latestResetToken();
    assert.notEqual(firstToken, nextToken);
    assert.equal((await post('reset-password', { token: firstToken, password: encrypt('ChangedPassword123') })).status, 400);
    const results = await Promise.all([1, 2].map(() => post('reset-password', { token: nextToken, password: encrypt('ChangedPassword123') })));
    assert.deepEqual(results.map(result => result.status).sort(), [200, 400]);
    const revoked = await fetch(`${base}/protected`, { headers: { Authorization: `Bearer ${originalToken}` } });
    assert.equal(revoked.status, 401);
    assert.equal((await post('login', { email, password: encrypt('OriginalPassword123') })).status, 401);
    const changed = await post('login', { email, password: encrypt('ChangedPassword123') });
    assert.equal(changed.status, 200);
    assert.equal((await fetch(`${base}/protected`, { headers: { Authorization: `Bearer ${changed.body.data.token}` } })).status, 200);
    await post('forgot-password', { email });
    const expired = await latestResetToken();
    await prisma.user.update({ where: { email }, data: { resetTokenExpiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await post('reset-password', { token: expired, password: encrypt('AnotherPassword123') })).status, 400);
    await prisma.user.update({ where: { email }, data: { deletedAt: new Date() } });
    assert.equal((await post('login', { email, password: encrypt('ChangedPassword123') })).status, 401);
    assert.equal((await fetch(`${base}/protected`, { headers: { Authorization: `Bearer ${changed.body.data.token}` } })).status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
