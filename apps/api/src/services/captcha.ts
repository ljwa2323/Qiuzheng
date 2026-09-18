import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

const CAPTCHA_TTL_SEC = 5 * 60;
const CODE_LENGTH = 4;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const memoryStore = new Map<string, { hash: string; expiresAt: number }>();

function pruneMemory() {
  const now = Date.now();
  for (const [id, row] of memoryStore) {
    if (row.expiresAt <= now) memoryStore.delete(id);
  }
}

function hashCode(code: string): string {
  return createHash('sha256').update(code.toUpperCase()).digest('hex');
}

function randomCode(length = CODE_LENGTH): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function buildCaptchaSvg(code: string): string {
  const width = 140;
  const height = 44;
  const noise: string[] = [];
  for (let i = 0; i < 18; i += 1) {
    const x1 = randomInt(0, width);
    const y1 = randomInt(0, height);
    const x2 = randomInt(0, width);
    const y2 = randomInt(0, height);
    noise.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#9eb1ac" stroke-width="1" opacity="0.55"/>`,
    );
  }
  for (let i = 0; i < 28; i += 1) {
    noise.push(
      `<circle cx="${randomInt(0, width)}" cy="${randomInt(0, height)}" r="1" fill="#7fa49d" opacity="0.45"/>`,
    );
  }
  const chars = [...code].map((ch, index) => {
    const x = 18 + index * 30 + randomInt(-2, 3);
    const y = 28 + randomInt(-4, 5);
    const rotate = randomInt(-18, 19);
    return `<text x="${x}" y="${y}" fill="#173f3b" font-size="22" font-family="Segoe UI, Arial, sans-serif" font-weight="700" transform="rotate(${rotate} ${x} ${y})">${escapeXml(ch)}</text>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" rx="8" fill="#f4f7f6"/>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="7" fill="none" stroke="#d5e0dc"/>
  ${noise.join('')}
  ${chars.join('')}
</svg>`;
}

function hashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function createCaptcha() {
  pruneMemory();
  const captchaId = randomUUID();
  const code = randomCode();
  memoryStore.set(captchaId, {
    hash: hashCode(code),
    expiresAt: Date.now() + CAPTCHA_TTL_SEC * 1000,
  });
  const svg = buildCaptchaSvg(code);
  const image = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
  return { captchaId, image, expiresInSec: CAPTCHA_TTL_SEC };
}

export async function consumeCaptcha(captchaId: string, code: string): Promise<boolean> {
  pruneMemory();
  const id = String(captchaId || '').trim();
  const typed = String(code || '').trim();
  if (!id || !typed) return false;
  const row = memoryStore.get(id);
  memoryStore.delete(id);
  if (!row || row.expiresAt <= Date.now()) return false;
  return hashesEqual(row.hash, hashCode(typed));
}

/** Test helper: create captcha and return plaintext code. */
export async function createCaptchaWithCodeForTest() {
  pruneMemory();
  const captchaId = randomUUID();
  const code = randomCode();
  memoryStore.set(captchaId, {
    hash: hashCode(code),
    expiresAt: Date.now() + CAPTCHA_TTL_SEC * 1000,
  });
  return { captchaId, code };
}
