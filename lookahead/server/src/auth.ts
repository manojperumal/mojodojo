import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { one, pool } from './db';
import { HttpError } from './errors';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authMode = () => (process.env.AUTH_MODE ?? 'dev') as 'dev' | 'supabase';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

async function verifySupabaseToken(token: string): Promise<JWTPayload> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  const base = process.env.SUPABASE_URL;
  const opts = base ? { issuer: new URL('/auth/v1', base).toString() } : {};
  if (secret) return (await jwtVerify(token, new TextEncoder().encode(secret), opts)).payload;
  if (!base) throw new HttpError(500, 'Server auth is not configured (SUPABASE_URL or SUPABASE_JWT_SECRET).');
  jwks ??= createRemoteJWKSet(new URL('/auth/v1/.well-known/jwks.json', base));
  return (await jwtVerify(token, jwks, opts)).payload;
}

/** Map a Supabase auth identity to a Lookahead user, linking by email on first sign-in. */
async function userForSupabase(sub: string, email: string, name?: string): Promise<AuthUser> {
  const byAuth = await one<AuthUser>(pool, 'select id, name, email from users where auth_user_id = $1', [sub]);
  if (byAuth) return byAuth;
  const linked = await one<AuthUser>(
    pool,
    'update users set auth_user_id = $1 where lower(email) = lower($2) and auth_user_id is null returning id, name, email',
    [sub, email],
  );
  if (linked) return linked;
  return (await one<AuthUser>(
    pool,
    'insert into users (email, name, auth_user_id) values ($1, $2, $3) returning id, name, email',
    [email.toLowerCase(), name || email.split('@')[0], sub],
  ))!;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    if (authMode() === 'dev') {
      const id = req.header('x-dev-user');
      if (!id) throw new HttpError(401, 'Sign in required.');
      const u = await one<AuthUser>(pool, 'select id, name, email from users where id = $1', [id]);
      if (!u) throw new HttpError(401, 'Unknown user.');
      req.user = u;
      return next();
    }
    const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) throw new HttpError(401, 'Sign in required.');
    let payload: JWTPayload;
    try {
      payload = await verifySupabaseToken(token);
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(401, 'Your session has expired. Please sign in again.');
    }
    const email = String(payload.email ?? '');
    if (!payload.sub || !email) throw new HttpError(401, 'Token has no email.');
    const meta = (payload.user_metadata ?? {}) as { full_name?: string; name?: string };
    req.user = await userForSupabase(payload.sub, email, meta.full_name ?? meta.name);
    next();
  } catch (e) {
    next(e);
  }
}
