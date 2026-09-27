import type { Server, Namespace } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from './db.js';

let channel: Namespace | undefined;
export function setupNotificationRealtime(io: Server) {
  channel = io.of('/notifications');
  channel.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !process.env.JWT_SECRET) throw new Error();
      const claims = jwt.verify(token, process.env.JWT_SECRET) as jwt.JwtPayload;
      if (typeof claims.id !== 'string' || !claims.exp) throw new Error();
      const user = await prisma.user.findUnique({ where: { id: claims.id } });
      if (!user || user.deletedAt || user.authVersion !== (claims.authVersion ?? 0)) throw new Error();
      socket.data.userId = user.id;
      socket.data.authVersion = user.authVersion;
      socket.data.expiresAt = claims.exp * 1000;
      next();
    } catch { next(new Error('Unauthorized')); }
  });
  channel.on('connection', socket => {
    socket.join(`user:${socket.data.userId}`);
    const timer = setInterval(async () => {
      try {
        const user = await prisma.user.findUnique({ where: { id: socket.data.userId }, select: { deletedAt: true, authVersion: true } });
        if (!user || user.deletedAt || socket.data.expiresAt <= Date.now() || user.authVersion !== socket.data.authVersion) socket.disconnect(true);
      } catch { socket.disconnect(true); }
    }, 60000);
    socket.on('disconnect', () => clearInterval(timer));
  });
}

export function notifyUser(userId: string) {
  // Emit only after the database transaction commits. Clients reload their own API data.
  channel?.to(`user:${userId}`).emit('notifications:changed');
}
