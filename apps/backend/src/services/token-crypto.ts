import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../env.js';

/**
 * At-rest encryption for integration tokens (P10). AES-256-GCM with a key
 * derived from `BETTER_AUTH_SECRET` (which production already must override),
 * so no extra key management is needed — rotating the secret invalidates the
 * stored tokens, which is the safe failure (devices simply re-push on the next
 * connect). Ciphertext format: `base64(iv).base64(authTag).base64(data)`.
 */

const key = createHash('sha256').update(`${env.BETTER_AUTH_SECRET}|integration-tokens`).digest();

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

/** Decrypt a stored token blob, or null when it can't be decrypted (e.g. the
 *  secret rotated) — callers treat that as "no token stored". */
export function decryptToken(ciphertext: string): string | null {
  try {
    const [iv, tag, data] = ciphertext.split('.').map((part) => Buffer.from(part, 'base64'));
    if (!iv || !tag || !data) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
