import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import CryptoJS from 'crypto-js';
import { authMiddleware } from './middlewares.js';
import { canOwnWorkflows, getActor } from './access.js';
import { prisma } from './db.js';
import { mailEnabled } from './mail.js';

export const integrationsRouter = Router();
integrationsRouter.get('/status', authMiddleware, async (req: Request, res: Response) => {
  const actor = await getActor(req);
  if (!canOwnWorkflows(actor)) return res.status(403).json({ success: false, message: 'Owner access required' });
  let aiService = false;
  try {
    const response = await fetch(`${process.env.AI_SERVICE_URL || 'http://localhost:8001'}/health`, {
      signal: AbortSignal.timeout(3000)
    });
    aiService = response.ok;
  } catch {
    aiService = false;
  }
  return res.json({ success: true, data: {
    gateway: 'online',
    aiService: aiService ? 'online' : 'offline',
    assemblyAi: process.env.ASSEMBLYAI_API_KEY ? 'configured' : 'not_configured',
    email: mailEnabled() ? 'configured' : 'not_configured',
    twilio: 'not_configured',
    webhook: 'not_configured',
    crm: 'not_configured',
    slack: 'not_configured'
  } });
});

// --- Google Calendar OAuth ---
// Authorization-code flow: needs GOOGLE_CLIENT_SECRET, unlike the ID-token
// flow in auth.ts. Refresh tokens are encrypted at rest and never leave the gateway.
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events openid email';

const encrypt = (value: string) =>
  CryptoJS.AES.encrypt(value, process.env.ENCRYPTION_KEY || 'default-hackathon-key').toString();
const decrypt = (value: string) => {
  try { return CryptoJS.AES.decrypt(value, process.env.ENCRYPTION_KEY || 'default-hackathon-key').toString(CryptoJS.enc.Utf8); }
  catch { return ''; }
};

function googleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim()
    || `${process.env.GATEWAY_URL || 'http://localhost:3003'}/api/v1/integrations/google/callback`;
  if (!clientId || !clientSecret) return null;
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

// Returns the Google consent URL. The client redirects the browser to it.
integrationsRouter.get('/google/connect', authMiddleware, async (req: any, res: Response) => {
  const actor = await getActor(req);
  if (!canOwnWorkflows(actor)) return res.status(403).json({ success: false, message: 'Owner access required' });
  const oauth = googleOAuthClient();
  if (!oauth || !process.env.JWT_SECRET) {
    return res.status(503).json({ success: false, message: 'Google Calendar is not configured on this server.' });
  }
  // The callback arrives as a plain browser redirect with no Authorization header,
  // so the user id travels in a short-lived signed state that also blocks CSRF.
  const state = jwt.sign({ id: req.user.id, purpose: 'google_calendar' }, process.env.JWT_SECRET, { expiresIn: '10m' });
  const url = oauth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: CALENDAR_SCOPE,
    state
  });
  return res.json({ success: true, message: 'Success', data: { url } });
});

integrationsRouter.get('/google/callback', async (req: Request, res: Response) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3002';
  const back = (status: string) => res.redirect(`${clientUrl}/integrations?google=${status}`);
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  if (req.query.error || !code || !state) return back('denied');

  const oauth = googleOAuthClient();
  if (!oauth || !process.env.JWT_SECRET) return back('unconfigured');

  let userId: string;
  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET) as jwt.JwtPayload;
    if (decoded.purpose !== 'google_calendar' || typeof decoded.id !== 'string') return back('error');
    userId = decoded.id;
  } catch { return back('expired'); }

  try {
    const { tokens } = await oauth.getToken(code);
    // Without a refresh token the connection dies in an hour and cannot be renewed.
    if (!tokens.refresh_token) return back('no_refresh_token');
    // Google silently drops scopes that are not registered on the consent screen,
    // which would store a connection that looks fine but cannot touch the calendar.
    if (!tokens.scope?.includes('auth/calendar')) return back('missing_scope');
    const ticket = tokens.id_token
      ? await oauth.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID?.trim() })
      : null;
    const googleEmail = ticket?.getPayload()?.email || 'unknown';
    const data = {
      googleEmail,
      refreshToken: encrypt(tokens.refresh_token),
      accessToken: tokens.access_token ? encrypt(tokens.access_token) : null,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scope: tokens.scope || CALENDAR_SCOPE,
      deletedAt: null
    };
    await prisma.googleCalendarConnection.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    return back('connected');
  } catch {
    return back('error');
  }
});

integrationsRouter.get('/google/status', authMiddleware, async (req: any, res: Response) => {
  const connection = await prisma.googleCalendarConnection.findFirst({
    where: { userId: req.user.id, deletedAt: null },
    select: { googleEmail: true, createdAt: true }
  });
  // `permitted` mirrors the guard on /google/connect so the card can explain
  // a missing permission instead of blaming the server configuration.
  return res.json({ success: true, message: 'Success', data: {
    configured: Boolean(googleOAuthClient()),
    permitted: canOwnWorkflows(await getActor(req)),
    connected: Boolean(connection),
    googleEmail: connection?.googleEmail || null,
    connectedAt: connection?.createdAt || null
  } });
});

integrationsRouter.delete('/google', authMiddleware, async (req: any, res: Response) => {
  const connection = await prisma.googleCalendarConnection.findFirst({ where: { userId: req.user.id, deletedAt: null } });
  if (!connection) return res.status(404).json({ success: false, message: 'No Google Calendar connection found.' });
  // Revoke at Google too, otherwise the grant lingers in the user's account.
  const refreshToken = decrypt(connection.refreshToken);
  if (refreshToken) {
    try { await googleOAuthClient()?.revokeToken(refreshToken); } catch { /* revoked or already invalid */ }
  }
  await prisma.googleCalendarConnection.update({ where: { id: connection.id }, data: { deletedAt: new Date() } });
  return res.json({ success: true, message: 'Google Calendar disconnected.', data: null });
});

// Creates an event on the owner's primary calendar. `when` is either YYYY-MM-DD
// (all-day) or YYYY-MM-DDTHH:mm (a one-hour slot in APP_TIMEZONE). Returns false
// when there is nothing to do, so callers can stay quiet.
export async function createSubmissionEvent(
  userId: string,
  summary: string,
  description: string,
  when: string
): Promise<boolean> {
  const connection = await prisma.googleCalendarConnection.findFirst({ where: { userId, deletedAt: null } });
  const oauth = googleOAuthClient();
  if (!connection || !oauth) return false;

  const refreshToken = decrypt(connection.refreshToken);
  if (!refreshToken) return false;
  oauth.setCredentials({ refresh_token: refreshToken });

  let accessToken: string | null | undefined;
  try {
    accessToken = (await oauth.getAccessToken()).token;
  } catch (error: any) {
    // A revoked or expired grant (Testing-mode tokens die after 7 days) can only be
    // fixed by reconnecting, so drop it and let the UI ask for a new one.
    if (error?.response?.data?.error === 'invalid_grant' || error?.message?.includes('invalid_grant')) {
      await prisma.googleCalendarConnection.update({ where: { id: connection.id }, data: { deletedAt: new Date() } });
    }
    throw error;
  }
  if (!accessToken) return false;

  let start: Record<string, string>;
  let end: Record<string, string>;
  if (when.includes('T')) {
    // No offset is sent: Google resolves the wall-clock time against timeZone.
    const timeZone = process.env.APP_TIMEZONE || 'Asia/Jakarta';
    const slotEnd = new Date(`${when}:00.000Z`);
    slotEnd.setUTCMinutes(slotEnd.getUTCMinutes() + Number(process.env.APPOINTMENT_MINUTES || 60));
    start = { dateTime: `${when}:00`, timeZone };
    end = { dateTime: `${slotEnd.toISOString().slice(0, 16)}:00`, timeZone };
  } else {
    // The end date of an all-day event is exclusive, so it is the day after the start.
    const next = new Date(`${when}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    start = { date: when };
    end = { date: next.toISOString().slice(0, 10) };
  }

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary, description, start, end })
  });
  if (!response.ok) throw new Error(`Calendar API ${response.status}: ${await response.text()}`);
  return true;
}
