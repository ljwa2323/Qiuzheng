import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { loadEnv } from '../config/env.js';

export function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function newId(): string {
  return randomUUID();
}

export function encryptSecret(plain: string): { cipher: string; iv: string; tag: string } {
  const key = Buffer.from(loadEnv().CREDENTIALS_MASTER_KEY, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    cipher: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decryptSecret(cipher: string, iv: string, tag: string): string {
  const key = Buffer.from(loadEnv().CREDENTIALS_MASTER_KEY, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipher, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function last4(value: string): string {
  const trimmed = value.trim();
  return trimmed.slice(-4);
}
