import nodemailer from 'nodemailer';

let transport: nodemailer.Transporter | null = null;

function getTransport() {
  if (transport) return transport;
  if (process.env.SMTP_HOST) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  } else {
    transport = nodemailer.createTransport({ jsonTransport: true });
  }
  return transport;
}

export const sentLog: { to: string; subject: string }[] = [];

export async function sendEmail(to: string, subject: string, text: string) {
  sentLog.push({ to, subject });
  try {
    await getTransport().sendMail({ from: process.env.EMAIL_FROM ?? 'Lookahead <no-reply@example.com>', to, subject, text });
    if (!process.env.SMTP_HOST && process.env.NODE_ENV !== 'test') console.log(`[email] to=${to} subject="${subject}"`);
    return true;
  } catch (e) {
    console.error('[email] failed', e);
    return false;
  }
}

export const appUrl = () => process.env.APP_URL ?? 'http://localhost:5173';
