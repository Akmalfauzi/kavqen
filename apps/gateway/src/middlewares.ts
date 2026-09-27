import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { prisma } from './db.js';

export const authMiddleware = async (req: any, res: any, next: any) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return res.status(500).json({ success: false, message: 'JWT_SECRET is not configured' });
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
    if (typeof decoded.id !== 'string') return res.status(401).json({ success: false, message: 'Invalid token' });
    const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { authVersion: true, deletedAt: true } });
    if (!user || user.deletedAt || (decoded.authVersion ?? 0) !== user.authVersion) {
      return res.status(401).json({ success: false, message: 'Session expired. Please sign in again.' });
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

export const demoGuard = async (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: true }
    });
    if (user?.role?.code === 'SUPER-ADMIN') {
      return next();
    }
    return res.status(403).json({ success: false, message: 'Disabled for demo' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


// Rate Limiters
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // Limit each IP to 10 login/register requests
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts, please try again later.' },
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10, // Limit each IP to 10 AI requests per minute
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many AI requests, please try again later.' },
});
