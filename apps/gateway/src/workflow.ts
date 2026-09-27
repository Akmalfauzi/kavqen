import { notifyUser } from './notification-realtime.js';
import { Router, Request, Response } from 'express';
import { prisma } from './db.js';
import { authMiddleware } from './middlewares.js';
import { canOwnWorkflows, getActor, ownsWorkflow } from './access.js';
import { referencedFieldNames } from './workflow-fields.js';
import { buildGeneratedWorkflow } from './workflow-generation.js';

export const workflowRouter = Router();

workflowRouter.post('/generate', authMiddleware, async (req: Request, res: Response) => {
  const actor = await getActor(req);
  if (!canOwnWorkflows(actor)) return res.status(403).json({ success: false, message: 'Owner access required' });
  const prompt = req.body?.prompt;
  if (typeof prompt !== 'string' || prompt.trim().length < 10 || prompt.length > 2000) {
    return res.status(400).json({ success: false, message: 'Describe workflow in 10 to 2000 characters' });
  }
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) return res.status(503).json({ success: false, message: 'AssemblyAI API key is not configured' });

  try {
    const fields = await prisma.field.findMany({ where: { deletedAt: null }, select: { name: true, label: true, type: true } });
    const response = await fetch('https://llm-gateway.assemblyai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: apiKey, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: 'qwen3.5-4b-32k-fast',
        messages: [
          { role: 'system', content: `Create a linear voice workflow draft. Respond with only JSON: {"steps":[{"title":"short step title","purpose":"specific instruction for voice agent","target_fields":["existing_field_name"]}]}. Use only steps explicitly requested by the user. Do not add common intake steps, extra questions, or topics the user did not mention. Use 1 to 6 ordered steps. Use only these master fields when directly relevant: ${JSON.stringify(fields)}. Do not invent field names. Write every title and purpose in the user's language.` },
          { role: 'user', content: prompt.trim() }
        ],
        max_tokens: 1200,
        temperature: 0.3
      })
    });
    if (!response.ok) return res.status(502).json({ success: false, message: `AI generation failed (${response.status})` });
    const completion = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = completion.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return res.status(502).json({ success: false, message: 'AI returned no workflow' });
    const draft = buildGeneratedWorkflow(content, fields.map((field) => field.name));
    if (draft.error) return res.status(502).json({ success: false, message: draft.error });
    return res.status(200).json({ success: true, message: 'Workflow draft generated', data: draft });
  } catch (error: any) {
    return res.status(502).json({ success: false, message: error.name === 'TimeoutError' ? 'AI generation timed out' : 'AI generation unavailable' });
  }
});

workflowRouter.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    if (!canOwnWorkflows(actor)) return res.status(403).json({ success: false, message: 'Owner access required' });
    const workflows = await prisma.workflow.findMany({
      where: { deletedAt: null, OR: [{ ownerId: actor!.id }, ...(actor!.role?.code === 'SUPER-ADMIN' ? [{ ownerId: null }] : [])] },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ success: true, message: 'Workflows retrieved', data: workflows });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

workflowRouter.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    const workflow = await prisma.workflow.findFirst({
      where: { id: req.params.id as string, deletedAt: null }
    });
    if (!workflow || !ownsWorkflow(actor, workflow)) return res.status(404).json({ success: false, message: 'Workflow not found' });
    return res.status(200).json({ success: true, message: 'Workflow retrieved', data: workflow });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

workflowRouter.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    if (!canOwnWorkflows(actor)) return res.status(403).json({ success: false, message: 'Owner access required' });
    const { name, description, status, data } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

    const workflow = await prisma.workflow.create({
      data: {
        name,
        description: description || null,
        status: 'DRAFT',
        data: data || {},
        ownerId: actor!.id
      }
    });
    return res.status(201).json({ success: true, message: 'Workflow created', data: workflow });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

workflowRouter.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    const incomingData = req.body.data;
    if (!incomingData || typeof incomingData !== 'object' || Array.isArray(incomingData) ||
        (incomingData.nodes !== undefined && !Array.isArray(incomingData.nodes)) ||
        (incomingData.edges !== undefined && !Array.isArray(incomingData.edges))) {
      return res.status(400).json({ success: false, message: 'Workflow data must contain node and edge arrays' });
    }

    const existing = await prisma.workflow.findFirst({
      where: { id: req.params.id as string, deletedAt: null }
    });
    if (!existing || !ownsWorkflow(actor, existing)) return res.status(404).json({ success: false, message: 'Workflow not found' });

    const currentData = existing.data && typeof existing.data === 'object' && !Array.isArray(existing.data)
      ? existing.data : {};
    const workflow = await prisma.workflow.update({
      where: { id: existing.id },
      data: { data: { ...currentData, ...incomingData }, status: 'DRAFT' }
    });
    return res.status(200).json({ success: true, message: 'Workflow saved', data: workflow });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

workflowRouter.post('/:id/publish', authMiddleware, async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    const workflow = await prisma.workflow.findFirst({
      where: { id: req.params.id as string, deletedAt: null }
    });
    if (!workflow || !ownsWorkflow(actor, workflow)) return res.status(404).json({ success: false, message: 'Workflow not found' });

    const data = workflow.data && typeof workflow.data === 'object' && !Array.isArray(workflow.data)
      ? workflow.data : {};
    if (!Array.isArray(data.nodes) || data.nodes.length === 0 || !Array.isArray(data.edges)) {
      return res.status(400).json({ success: false, message: 'Add workflow steps before publishing' });
    }

    const references = referencedFieldNames(data.nodes);
    if (references.error) return res.status(400).json({ success: false, message: references.error });
    const fields = await prisma.field.findMany({
      where: { deletedAt: null, name: { in: references.names! } }
    });
    const fieldsByName = new Map(fields.map((field) => [field.name, field]));
    const missing = references.names!.filter((name) => !fieldsByName.has(name));
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Master fields missing or deleted: ${missing.join(', ')}`
      });
    }
    const orderedFields = references.names!.map((name) => fieldsByName.get(name)!);
    const knowledge = await prisma.knowledgeDocument.findMany({
      where: { ownerId: actor!.id, deletedAt: null },
      select: { title: true, content: true },
      orderBy: { updatedAt: 'desc' },
      take: 20
    });
    const schema = {
      theme_id: workflow.id,
      title: workflow.name,
      description: workflow.description || '',
      nodes: data.nodes,
      edges: data.edges,
      knowledge,
      fields: orderedFields.map(({ name, label, type, required, prompt_hint, options }) =>
        ({ name, label, type, required, prompt_hint, options }))
    };

    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
    const response = await fetch(`${aiUrl}/api/workflows/${workflow.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schema)
    });
    if (!response.ok) {
      return res.status(502).json({ success: false, message: 'AI service could not publish workflow' });
    }

    const published = await prisma.$transaction(async (tx) => {
      const updated = await tx.workflow.update({
        where: { id: workflow.id },
        data: { status: 'PUBLISHED', data: { ...data, publishedFields: schema.fields } }
      });
      await tx.userNotification.create({ data: {
        userId: actor!.id,
        title: 'Workflow published',
        description: `${workflow.name} is ready to share.`,
        kind: 'workflow'
      } });
      return updated;
    });
    notifyUser(actor!.id);
    return res.status(200).json({ success: true, message: 'Workflow published for voice testing', data: published });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

workflowRouter.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const actor = await getActor(req);
    const workflow = await prisma.workflow.findFirst({
      where: { id: req.params.id as string, deletedAt: null }
    });
    if (!workflow || !ownsWorkflow(actor, workflow)) return res.status(404).json({ success: false, message: 'Workflow not found' });

    await prisma.workflow.update({
      where: { id: req.params.id as string },
      data: { deletedAt: new Date() }
    });
    return res.status(200).json({ success: true, message: 'Workflow deleted', data: null });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
