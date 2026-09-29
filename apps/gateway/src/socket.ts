import { Server as SocketIOServer, Socket } from 'socket.io';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { prisma } from './db.js';
import { getActor, hasActiveFormGrant, ownsWorkflow } from './access.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

export function setupSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO Gateway] Client connected: ${socket.id}`);

    socket.on('start_session', async (data: { theme_id: string }) => {
      const themeId = data.theme_id || 'clinic';
      console.log(`[Socket.IO Gateway] Starting voice session for theme: ${themeId}`);

      try {
        const token = socket.handshake.auth?.token;
        if (typeof token !== 'string') throw new Error('Unauthorized');
        if (!process.env.JWT_SECRET) throw new Error('JWT secret unavailable');
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as { id: string; authVersion?: number };
        const actor = await getActor({ user: decoded });
        if (!actor || actor.authVersion !== (decoded.authVersion ?? 0)) throw new Error('Unauthorized');
        const workflow = await prisma.workflow.findFirst({ where: { OR: [{ id: themeId }, { agentId: themeId }], status: 'PUBLISHED', deletedAt: null } });
        if (!workflow || (!ownsWorkflow(actor, workflow) && !await hasActiveFormGrant(actor.id, workflow.id))) {
          throw new Error('Access denied');
        }
        // Fetch schema & prompt from Python AI Service
        const schemaRes = await axios.get(`${AI_SERVICE_URL}/api/schema/${workflow.id}`);
        const schemaData = schemaRes.data.data;

        socket.emit('session_initialized', {
          theme_id: workflow.id,
          greeting: schemaData.greeting,
          fields: schemaData.fields,
        });
      } catch (err) {
        console.error('[Socket.IO Gateway] Failed to fetch schema from AI service:', err);
        socket.emit('error', { message: 'Failed to initialize session configuration' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO Gateway] Client disconnected: ${socket.id}`);
    });
  });
}
