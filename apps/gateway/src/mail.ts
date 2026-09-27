import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';

// True when a driver can actually deliver. Callers gate optional mail on this
// instead of catching the throw, so "email is off" stays quiet in the logs.
export function mailEnabled() {
  const driver = process.env.MAIL_DRIVER || 'smtp';
  if (driver === 'file') return process.env.NODE_ENV !== 'production';
  return driver === 'smtp' && Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendMail(to: string, subject: string, text: string) {
  const driver = process.env.MAIL_DRIVER || 'smtp';
  if (driver === 'file' && process.env.NODE_ENV !== 'production') {
    const directory = resolve(process.env.DEV_MAIL_DIR || '.dev-mail');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(resolve(directory, `${Date.now()}-${randomUUID()}.json`), JSON.stringify({ to, subject, text }, null, 2), { mode: 0o600 });
    return;
  }
  if (driver !== 'smtp' || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('Email is not configured');
  }
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  await transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
}

export async function sendPasswordReset(email: string, resetUrl: string) {
  await sendMail(email, 'Reset your Kavqen password',
    `Reset your Kavqen password using this link (valid for 30 minutes):\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`);
}

// Sent to the workflow owner when someone completes their form.
export async function sendSubmissionNotification(
  ownerEmail: string,
  workflowName: string,
  submittedBy: string,
  answers: { label: string; value: string }[]
) {
  const lines = answers.length
    ? answers.map(a => `- ${a.label}: ${a.value}`).join('\n')
    : '(no answers recorded)';
  await sendMail(ownerEmail, `New submission: ${workflowName}`,
    `${submittedBy} completed "${workflowName}".\n\n${lines}\n\nOpen Kavqen to see the full submission.`);
}
