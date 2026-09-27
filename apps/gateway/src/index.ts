import { searchRouter } from './search.js';
import { setupNotificationRealtime } from './notification-realtime.js';
import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import { setupSocketHandlers } from './socket.js';
import { authRouter } from './auth.js';
import { userRouter } from './user.js';
import { roleRouter } from './role.js';
import { permissionRouter } from './permission.js';
import { permissionGroupRouter } from './permission-group.js';
import { fieldRouter } from './field.js';
import { agentRouter } from './agent.js';
import { workflowRouter } from './workflow.js';
import { submissionRouter } from './submission.js';
import { shareRouter } from './share.js';
import { knowledgeRouter } from './knowledge.js';
import { analyticsRouter } from './analytics.js';
import { integrationsRouter } from './integrations.js';
import { notificationsRouter } from './notifications.js';
import { prisma } from './db.js';
import { canOwnWorkflows, getActor, hasActiveFormGrant, ownsWorkflow } from './access.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());
// Rate limit disabled during development: app.use('/api', globalLimiter);

import { authMiddleware, demoGuard } from './middlewares.js';

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/user', userRouter);
app.use('/api/v1/roles', roleRouter);
app.use('/api/v1/permissions', permissionRouter);
app.use('/api/v1/permission-groups', permissionGroupRouter);
app.use('/api/v1/fields', fieldRouter);
app.use('/api/v1/agents', agentRouter);
app.use('/api/v1/workflows', workflowRouter);
app.use('/api/v1/submissions', submissionRouter);
app.use('/api/v1/share', shareRouter);
app.use('/api/v1/knowledge', knowledgeRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/integrations', integrationsRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/search', searchRouter);

app.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'kavqen-gateway is running', data: { status: 'ok', service: 'kavqen-gateway' } });
});

app.get('/api/voice-token', authMiddleware, async (req, res) => {
  try {
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!canOwnWorkflows(actor)) {
      const workflowId = typeof req.query.workflowId === 'string' ? req.query.workflowId : '';
      const workflow = await prisma.workflow.findFirst({ where: { id: workflowId, deletedAt: null, status: 'PUBLISHED' } });
      if (!workflow || !await hasActiveFormGrant(actor.id, workflow.id)) return res.status(403).json({ success: false, message: 'Akses form tidak tersedia atau sudah berakhir.' });
    }

    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'ASSEMBLYAI_API_KEY is not set in apps/gateway/.env' });
    }

    const url = new URL('https://agents.assemblyai.com/v1/token');
    url.searchParams.set('expires_in_seconds', '300');

    const response = await fetch(url, {
      headers: { Authorization: apiKey },
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ success: false, message: text });
    }

    const data = await response.json();
    return res.status(200).json({ success: true, message: 'Voice token generated', data });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/workflows', authMiddleware, async (req, res) => {
  try {
    const actor = await getActor(req);
    if (!canOwnWorkflows(actor)) return res.status(403).json({ success: false, message: 'Owner access required' });
    const workflows = await prisma.workflow.findMany({
      where: { ownerId: actor!.id, deletedAt: null },
      select: { id: true, name: true, description: true, status: true },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ success: true, message: 'Workflows retrieved', data: workflows });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/schema/:theme_id', authMiddleware, async (req, res) => {
  try {
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const themeId = req.params.theme_id;
    if (themeId === 'clinic' || themeId === 'complaint') {
      if (!canOwnWorkflows(actor)) return res.status(403).json({ success: false, message: 'Owner access required' });
    } else {
      const workflow = await prisma.workflow.findFirst({ where: { id: themeId, deletedAt: null, status: 'PUBLISHED' } });
      if (!workflow || (!ownsWorkflow(actor, workflow) && !await hasActiveFormGrant(actor.id, workflow.id))) {
        return res.status(404).json({ success: false, message: 'Schema not found' });
      }
    }
    const lang = 'en';
    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
    const url = `${aiUrl}/api/schema/${req.params.theme_id}?lang=${lang}`;
    const options = undefined;
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: data.detail || data.error || 'Request failed'
      });
    }

    // Wrap in standard response format if it doesn't already have 'success'
    if (data && typeof data.success !== 'undefined') {
      return res.status(200).json(data);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Success',
      data
    });

  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Rate limit disabled during development: aiLimiter
app.post('/api/extract', authMiddleware, demoGuard, async (req, res) => {
  try {
    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
    const url = `${aiUrl}/api/extract`;
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    };
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: data.detail || data.error || 'Request failed'
      });
    }

    // Wrap in standard response format if it doesn't already have 'success'
    if (data && typeof data.success !== 'undefined') {
      return res.status(200).json(data);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Success',
      data
    });

  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

setupSocketHandlers(io);
setupNotificationRealtime(io);

server.listen(port, () => {
  console.log(`🚀 Gateway Server running on http://localhost:${port}`);
});
