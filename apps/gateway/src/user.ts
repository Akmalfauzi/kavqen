import express from 'express';
import { prisma } from './db.js';
import { authMiddleware, demoGuard } from './middlewares.js';
import bcrypt from 'bcrypt';
import CryptoJS from 'crypto-js';

export const userRouter = express.Router();

const profileSelect = {
  id: true, email: true, name: true, phone: true, company: true,
  language: true, createdAt: true, googleId: true, password: true,
  role: { select: { code: true, name: true } },
} as const;

function publicProfile(user: any) {
  const { password, googleId, ...profile } = user;
  return { ...profile, hasPassword: Boolean(password), googleLinked: Boolean(googleId) };
}

userRouter.get('/me', authMiddleware, async (req: any, res: any) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.user.id, deletedAt: null },
      select: profileSelect,
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, message: 'User retrieved successfully', data: publicProfile(user) });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

userRouter.patch('/me', authMiddleware, async (req: any, res: any) => {
  const { name, phone, company, language } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 ||
      typeof phone !== 'string' || phone.trim().length > 40 ||
      (phone.trim() && !/^[+\d\s().-]+$/.test(phone.trim())) ||
      typeof company !== 'string' || company.trim().length > 150 ||
      !['en', 'id', 'es'].includes(language)) {
    return res.status(400).json({ success: false, message: 'Enter a name (1-100 characters), valid phone (up to 40 characters), company (up to 150 characters), and supported language.' });
  }
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id, deletedAt: null },
      data: { name: name.trim(), phone: phone.trim() || null, company: company.trim() || null, language },
      select: profileSelect,
    });
    return res.json({ success: true, message: 'Profile updated', data: publicProfile(user) });
  } catch {
    return res.status(500).json({ success: false, message: 'Unable to save profile. Please try again.' });
  }
});

userRouter.post('/me/password', authMiddleware, async (req: any, res: any) => {
  const decrypt = (value: unknown) => {
    if (typeof value !== 'string' || value.length > 2048) return '';
    try { return CryptoJS.AES.decrypt(value, process.env.ENCRYPTION_KEY || 'default-hackathon-key').toString(CryptoJS.enc.Utf8); }
    catch { return ''; }
  };
  const current = decrypt(req.body?.currentPassword);
  const next = decrypt(req.body?.newPassword);
  if (!current || Buffer.byteLength(current, 'utf8') > 72 || next.length < 8 || Buffer.byteLength(next, 'utf8') > 72) {
    return res.status(400).json({ success: false, message: 'Enter your current password and a new password with at least 8 characters and at most 72 UTF-8 bytes.' });
  }
  try {
    const user = await prisma.user.findFirst({ where: { id: req.user.id, deletedAt: null } });
    if (!user?.password) return res.status(400).json({ success: false, message: 'This account uses Google sign-in. Manage your password in your Google account.' });
    if (!await bcrypt.compare(current, user.password)) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    if (current === next) return res.status(400).json({ success: false, message: 'Choose a different new password.' });
    const result = await prisma.user.updateMany({
      where: { id: user.id, password: user.password, authVersion: user.authVersion, deletedAt: null },
      data: { password: await bcrypt.hash(next, 10), authVersion: { increment: 1 }, resetTokenHash: null, resetTokenExpiresAt: null },
    });
    if (!result.count) return res.status(409).json({ success: false, message: 'Your account changed. Please sign in again.' });
    return res.json({ success: true, message: 'Password changed. Sign in again with your new password.' });
  } catch {
    return res.status(500).json({ success: false, message: 'Unable to change password. Please try again.' });
  }
});

userRouter.get('/', authMiddleware, async (_req: any, res: any) => {
  try {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        googleId: true,
        role: {
          select: {
            id: true,
            name: true,
            code: true,
            color: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const mappedUsers = users.map(user => ({
      id: user.id,
      name: user.name || 'Unknown',
      email: user.email,
      role: user.role?.name || 'No Role',
      roleCode: user.role?.code || 'USER',
      roleColor: user.role?.color || 'slate',
      status: 'Active',
      lastActive: user.createdAt,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=random`
    }));

    return res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: mappedUsers
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

userRouter.post('/', authMiddleware, demoGuard, async (req: any, res: any) => {
  try {
    const { name, email, role, status } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const existingUser = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (existingUser) return res.status(400).json({ success: false, message: 'Email already exists' });

    let roleRecord;
    if (role) {
      roleRecord = await prisma.role.findFirst({ where: { name: role, deletedAt: null } });
    }

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        roleId: roleRecord?.id || null,
      }
    });
    return res.status(201).json({ success: true, message: 'User created', data: newUser });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

userRouter.put('/:id', authMiddleware, demoGuard, async (req: any, res: any) => {
  try {
    const id = req.params.id as string;
    const { name, email, role, status } = req.body;

    const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (email) {
      const existingUser = await prisma.user.findFirst({ where: { email, id: { not: id }, deletedAt: null } });
      if (existingUser) return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    let roleRecord;
    if (role) {
      roleRecord = await prisma.role.findFirst({ where: { name: role, deletedAt: null } });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        roleId: roleRecord ? roleRecord.id : undefined,
      }
    });

    return res.status(200).json({ success: true, message: 'User updated', data: updatedUser });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

userRouter.delete('/:id', authMiddleware, demoGuard, async (req: any, res: any) => {
  try {
    const id = req.params.id as string;
    const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.id === req.user.id) {
      return res.status(403).json({ success: false, message: 'Cannot delete yourself' });
    }

    await prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
    return res.status(200).json({ success: true, message: 'User deleted', data: null });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
