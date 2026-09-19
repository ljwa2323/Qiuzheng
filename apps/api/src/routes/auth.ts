import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, sendError } from '../lib/errors.js';
import { sha256 } from '../lib/crypto.js';
import {
  refreshTtlMs,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../lib/jwt.js';
import { randomUUID } from 'node:crypto';
import { consumeCaptcha, createCaptcha } from '../services/captcha.js';

const captchaFields = {
  captchaId: z.string().uuid(),
  captchaCode: z.string().trim().min(4).max(8),
};

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
  ...captchaFields,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  ...captchaFields,
});

async function assertCaptcha(captchaId: string, captchaCode: string) {
  const ok = await consumeCaptcha(captchaId, captchaCode);
  if (!ok) throw new AppError(400, 'invalid_captcha', '验证码错误或已过期，请刷新后重试');
}

function refreshCookiePath() {
  const prefix = (process.env.PUBLIC_API_PREFIX || '').replace(/\/$/, '');
  return `${prefix}/api/auth`;
}

function setRefreshCookie(reply: { setCookie: Function }, token: string) {
  reply.setCookie('refreshToken', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: refreshCookiePath(),
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(refreshTtlMs() / 1000),
  });
}

function clearRefreshCookie(reply: { clearCookie: Function }) {
  reply.clearCookie('refreshToken', { path: refreshCookiePath() });
}

async function issueTokens(user: { id: string; email: string; name: string }) {
  const tokenId = randomUUID();
  const refreshToken = signRefreshToken(user.id, tokenId);
  await prisma.refreshToken.create({
    data: {
      id: tokenId,
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + refreshTtlMs()),
    },
  });
  const accessToken = signAccessToken({ sub: user.id, email: user.email, name: user.name });
  return { accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name } };
}

export async function authRoutes(app: FastifyInstance) {
  app.get('/api/auth/captcha', async (_request, reply) => {
    try {
      const captcha = await createCaptcha();
      return captcha;
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/api/auth/register', async (request, reply) => {
    try {
      const body = registerSchema.parse(request.body);
      await assertCaptcha(body.captchaId, body.captchaCode);
      const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
      if (existing) throw new AppError(409, 'email_taken', 'Email already registered');
      const passwordHash = await bcrypt.hash(body.password, 12);
      const user = await prisma.user.create({
        data: {
          email: body.email.toLowerCase(),
          name: body.name,
          passwordHash,
        },
      });
      const team = await prisma.team.create({
        data: {
          name: `${body.name}'s Team`,
          members: { create: { userId: user.id, role: 'owner' } },
        },
      });
      const tokens = await issueTokens(user);
      setRefreshCookie(reply, tokens.refreshToken);
      return {
        accessToken: tokens.accessToken,
        user: tokens.user,
        defaultTeamId: team.id,
      };
    } catch (err) {
      if (err instanceof z.ZodError) {
        const needsCaptcha = err.issues.some((issue) =>
          issue.path.includes('captchaId') || issue.path.includes('captchaCode'),
        );
        return sendError(
          reply,
          new AppError(400, 'validation', needsCaptcha ? '请填写验证码' : err.message),
        );
      }
      return sendError(reply, err);
    }
  });

  app.post('/api/auth/login', async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);
      await assertCaptcha(body.captchaId, body.captchaCode);
      const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
      if (!user) throw new AppError(401, 'invalid_credentials', 'Invalid email or password');
      const ok = await bcrypt.compare(body.password, user.passwordHash);
      if (!ok) throw new AppError(401, 'invalid_credentials', 'Invalid email or password');
      const tokens = await issueTokens(user);
      setRefreshCookie(reply, tokens.refreshToken);
      return { accessToken: tokens.accessToken, user: tokens.user };
    } catch (err) {
      if (err instanceof z.ZodError) {
        const needsCaptcha = err.issues.some((issue) =>
          issue.path.includes('captchaId') || issue.path.includes('captchaCode'),
        );
        return sendError(
          reply,
          new AppError(400, 'validation', needsCaptcha ? '请填写验证码' : err.message),
        );
      }
      return sendError(reply, err);
    }
  });

  app.post('/api/auth/refresh', async (request, reply) => {
    try {
      const cookieToken = (request.cookies as { refreshToken?: string })?.refreshToken;
      const bodyToken = (request.body as { refreshToken?: string } | null)?.refreshToken;
      const refreshToken = cookieToken || bodyToken;
      if (!refreshToken) throw new AppError(401, 'unauthorized', 'Missing refresh token');
      const claims = verifyRefreshToken(refreshToken);
      const stored = await prisma.refreshToken.findUnique({ where: { id: claims.jti } });
      if (!stored || stored.userId !== claims.sub) {
        throw new AppError(401, 'unauthorized', 'Invalid refresh token');
      }
      if (stored.revokedAt) {
        await prisma.refreshToken.updateMany({
          where: { userId: claims.sub, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        throw new AppError(401, 'token_reuse', 'Refresh token reuse detected');
      }
      if (stored.expiresAt.getTime() < Date.now()) {
        throw new AppError(401, 'unauthorized', 'Refresh token expired');
      }
      if (stored.tokenHash !== sha256(refreshToken)) {
        throw new AppError(401, 'unauthorized', 'Invalid refresh token');
      }
      const user = await prisma.user.findUnique({ where: { id: claims.sub } });
      if (!user) throw new AppError(401, 'unauthorized', 'User not found');

      await prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      const tokens = await issueTokens(user);
      await prisma.refreshToken.update({
        where: { id: stored.id },
        data: { replacedBy: tokens.refreshToken.slice(0, 8) },
      });
      setRefreshCookie(reply, tokens.refreshToken);
      return { accessToken: tokens.accessToken, user: tokens.user };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/api/auth/logout', async (request, reply) => {
    try {
      const cookieToken = (request.cookies as { refreshToken?: string })?.refreshToken;
      if (cookieToken) {
        try {
          const claims = verifyRefreshToken(cookieToken);
          await prisma.refreshToken.updateMany({
            where: { id: claims.jti, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        } catch {
          // ignore
        }
      }
      clearRefreshCookie(reply);
      return { ok: true };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/api/auth/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: request.user!.id },
        select: { id: true, email: true, name: true, createdAt: true },
      });
      return { user };
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
