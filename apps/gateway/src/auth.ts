import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import CryptoJS from 'crypto-js';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from './db.js';
import { sendPasswordReset } from './mail.js';
import { OAuth2Client } from 'google-auth-library';

export const authRouter = express.Router();
const resetMessage = 'If an account exists for this email, a password reset link will be sent.';
const normalizeEmail = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';
const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const googleClient = new OAuth2Client();

function decryptPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try {
    return CryptoJS.AES.decrypt(value, process.env.ENCRYPTION_KEY || 'default-hackathon-key').toString(CryptoJS.enc.Utf8);
  } catch { return ''; }
}

function validPassword(password: string) {
  return password.length >= 8 && Buffer.byteLength(password, 'utf8') <= 72;
}

function session(user: { id: string; email: string; name: string | null; authVersion: number }, remember: boolean) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  const token = jwt.sign({ id: user.id, email: user.email, authVersion: user.authVersion }, secret, { expiresIn: remember ? '30d' : '1d' });
  return { token, user: { id: user.id, email: user.email, name: user.name } };
}

// Rate limit disabled during development: authLimiter
authRouter.post('/register', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const password = decryptPassword(req.body?.password);
  if (!validEmail(email) || !name || name.length > 100 || !validPassword(password)) {
    return res.status(400).json({ success: false, message: 'Enter a valid email, name (1-100 characters), and password (at least 8 characters, at most 72 UTF-8 bytes).' });
  }
  try {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
    const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    if (existing) return res.status(409).json({ success: false, message: 'Email already registered. Sign in or reset your password.' });
    const role = await prisma.role.findFirst({ where: { code: 'USER', deletedAt: null } });
    if (!role) return res.status(503).json({ success: false, message: 'Registration is temporarily unavailable.' });
    const user = await prisma.user.create({ data: { email, name, password: await bcrypt.hash(password, 10), roleId: role.id } });
    return res.status(201).json({ success: true, message: 'Account created', data: session(user, false) });
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'Email already registered.' });
    console.error('[Auth] Registration failed');
    return res.status(500).json({ success: false, message: 'Unable to create account. Please try again.' });
  }
});

// Rate limit disabled during development: authLimiter
authRouter.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = decryptPassword(req.body?.password);
  // Google identity must never be trusted from a client-provided ID.
  if (req.body?.googleId || !validEmail(email) || !password || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }
  try {
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null } });
    if (!user?.password || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    return res.json({ success: true, message: 'Success', data: session(user, req.body.rememberMe === true) });
  } catch {
    return res.status(500).json({ success: false, message: 'Unable to sign in. Please try again.' });
  }
});

// Rate limit disabled during development: authLimiter
authRouter.post('/google', async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId || !process.env.JWT_SECRET) {
    return res.status(503).json({ success: false, message: 'Google sign-in is temporarily unavailable.' });
  }
  const credential = req.body?.credential;
  if (typeof credential !== 'string' || !credential || credential.length > 16384) {
    return res.status(400).json({ success: false, message: 'Google credentials are missing. Please try again.' });
  }

  let identity;
  try {
    // Validates Google's signature, issuer, audience and token expiry.
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
    identity = ticket.getPayload();
  } catch {
    return res.status(401).json({ success: false, message: 'Google sign-in could not be verified. Please try again.' });
  }
  if (!identity?.sub || identity.email_verified !== true || !identity.email || !validEmail(normalizeEmail(identity.email))) {
    return res.status(401).json({ success: false, message: 'A verified Google email address is required.' });
  }

  try {
    const email = normalizeEmail(identity.email);
    let user = await prisma.user.findUnique({ where: { googleId: identity.sub } });
    if (user?.deletedAt) return res.status(403).json({ success: false, message: 'This account is no longer available.' });
    if (user) return res.json({ success: true, message: 'Signed in with Google', data: session(user, req.body.rememberMe === true) });

    user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    if (user) {
      if (user.deletedAt || user.googleId || !user.password) {
        return res.status(409).json({ success: false, message: 'This email cannot be linked to this Google account. Use your existing sign-in method.' });
      }
      // An email match alone must not grant access to an existing password account.
      if (!req.body.password) {
        return res.status(409).json({ success: false, code: 'GOOGLE_LINK_REQUIRED', message: 'Enter your existing Kavqen password to link this Google account.', data: { email: user.email } });
      }
      const password = decryptPassword(req.body.password);
      if (!password || Buffer.byteLength(password, 'utf8') > 72 || !await bcrypt.compare(password, user.password)) {
        return res.status(401).json({ success: false, message: 'Incorrect Kavqen password. Please try again.' });
      }
      const linked = await prisma.user.updateMany({
        where: { id: user.id, googleId: null, deletedAt: null, password: user.password, authVersion: user.authVersion },
        data: { googleId: identity.sub },
      });
      if (!linked.count) return res.status(409).json({ success: false, message: 'Your account changed. Please start Google sign-in again.' });
      return res.json({ success: true, message: 'Google account linked', data: session(user, req.body.rememberMe === true) });
    }

    const role = await prisma.role.findFirst({ where: { code: 'USER', deletedAt: null } });
    if (!role) return res.status(503).json({ success: false, message: 'Registration is temporarily unavailable.' });
    const created = await prisma.user.create({
      data: { email, googleId: identity.sub, name: identity.name?.trim().slice(0, 100) || email.split('@')[0], roleId: role.id },
    });
    return res.status(201).json({ success: true, message: 'Google account created', data: session(created, req.body.rememberMe === true) });
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'This account was just updated. Please sign in again.' });
    return res.status(500).json({ success: false, message: 'Unable to sign in with Google. Please try again.' });
  }
});

// Rate limit disabled during development: authLimiter
authRouter.post('/forgot-password', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!validEmail(email)) return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  try {
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null } });
    if (user?.password) {
      const token = randomBytes(32).toString('hex');
      const hash = tokenHash(token);
      const resetUrl = new URL('/reset-password', process.env.CLIENT_URL || 'http://localhost:3002');
      resetUrl.hash = `token=${token}`;
      await prisma.user.update({ where: { id: user.id }, data: { resetTokenHash: hash, resetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
      try {
        await sendPasswordReset(user.email, resetUrl.toString());
      } catch {
        await prisma.user.updateMany({ where: { id: user.id, resetTokenHash: hash }, data: { resetTokenHash: null, resetTokenExpiresAt: null } });
        console.error('[Auth] Password reset email delivery failed. Check SMTP configuration.');
      }
    }
    return res.json({ success: true, message: resetMessage });
  } catch {
    return res.status(500).json({ success: false, message: 'Unable to process request. Please try again.' });
  }
});

// Rate limit disabled during development: authLimiter
authRouter.post('/reset-password', async (req, res) => {
  const token = req.body?.token;
  const password = decryptPassword(req.body?.password);
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ success: false, message: 'Reset link is invalid or expired. Request a new link.' });
  }
  if (!validPassword(password)) return res.status(400).json({ success: false, message: 'Password must contain at least 8 characters and at most 72 UTF-8 bytes.' });
  try {
    const hash = await bcrypt.hash(password, 10);
    // Atomic consumption prevents two concurrent requests from reusing one link.
    const result = await prisma.user.updateMany({
      where: { resetTokenHash: tokenHash(token), resetTokenExpiresAt: { gt: new Date() }, deletedAt: null },
      data: { password: hash, resetTokenHash: null, resetTokenExpiresAt: null, authVersion: { increment: 1 } },
    });
    if (!result.count) return res.status(400).json({ success: false, message: 'Reset link is invalid or expired. Request a new link.' });
    return res.json({ success: true, message: 'Password updated. Sign in with your new password.' });
  } catch {
    return res.status(500).json({ success: false, message: 'Unable to reset password. Please try again.' });
  }
});
