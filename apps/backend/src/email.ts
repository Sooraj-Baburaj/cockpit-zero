import { env } from './env.js';

/**
 * Outbound email (verification + password reset). With RESEND_API_KEY set,
 * sends via Resend's HTTP API (plain fetch — no SDK needed for one endpoint);
 * without it, logs the link to the server console so the flow is exercisable
 * in dev with zero setup.
 */
export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(`[email → ${to}] ${subject}\n${text}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text }),
  });
  if (!res.ok) {
    // Deliverability failures shouldn't 500 the auth flow — log and move on;
    // the user can request another email.
    console.error(`[email] Resend failed (${res.status}): ${await res.text()}`);
  }
}
