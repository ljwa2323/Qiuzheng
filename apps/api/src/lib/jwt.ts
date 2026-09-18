import jwt from 'jsonwebtoken';
import { loadEnv } from '../config/env.js';

export type AccessClaims = {
  sub: string;
  email: string;
  name: string;
};

export function signAccessToken(claims: AccessClaims): string {
  const env = loadEnv();
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessClaims {
  const env = loadEnv();
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessClaims;
}

export function signRefreshToken(userId: string, tokenId: string): string {
  const env = loadEnv();
  return jwt.sign({ sub: userId, jti: tokenId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
  } as jwt.SignOptions);
}

export function verifyRefreshToken(token: string): { sub: string; jti: string } {
  const env = loadEnv();
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string; jti: string };
}

export function refreshTtlMs(): number {
  const ttl = loadEnv().JWT_REFRESH_TTL;
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const n = Number(match[1]);
  const unit = match[2];
  const mult = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return n * mult;
}
