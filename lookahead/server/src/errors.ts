import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const bad = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const forbidden = (msg = 'You do not have permission to do that.') => new HttpError(403, msg);
export const notFound = (what = 'Not found.') => new HttpError(404, what);

export const h =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({ error: `${first.path.join('.') || 'input'}: ${first.message}`, details: err.issues });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
  if (err?.code === '23505') return res.status(409).json({ error: 'That already exists.' });
  if (err?.code === '23514') return res.status(400).json({ error: 'That change breaks a data rule.', details: err.constraint });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'File is too large.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
}
