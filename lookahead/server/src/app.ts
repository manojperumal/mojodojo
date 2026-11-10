import cors from 'cors';
import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { authMode, requireAuth } from './auth';
import { corsOrigins } from './config';
import { runEscalations } from './jobs/escalate';
import { pool, q } from './db';
import { errorHandler } from './errors';
import { constraints } from './routes/constraints';
import { imports, importsPublic } from './routes/imports';
import { plan } from './routes/plan';
import { projects } from './routes/projects';
import { foremanPublic, weekly } from './routes/weekly';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(cors({ origin: corsOrigins() }));
  app.use(express.json({ limit: '30mb' })); // P6 exports can be large

  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('select 1');
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false, error: 'database unreachable' });
    }
  });

  // Backup trigger for escalations (e.g. an external cron), in case the in-process scheduler is asleep.
  app.post('/api/cron/escalations', async (req, res, next) => {
    const secret = process.env.CRON_SECRET;
    const given = req.header('x-cron-secret') ?? '';
    if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) return res.status(401).json({ error: 'Unauthorized' });
    try {
      res.json(await runEscalations({ respectHour: true }));
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/config', (_req, res) => res.json({ authMode: authMode() }));

  // Local development only: pick a seeded user instead of signing in.
  if (authMode() === 'dev') {
    app.get('/api/dev/users', async (_req, res, next) => {
      try {
        res.json(
          await q(
            pool,
            `select u.id, u.name, u.email, string_agg(distinct pm.role, ', ') as roles from users u
             left join project_members pm on pm.user_id = u.id group by u.id order by min(case pm.role when 'super' then 0 when 'pm' then 1 when 'field_engineer' then 2 when 'foreman' then 3 when 'cxa' then 4 else 5 end), u.name`,
          ),
        );
      } catch (e) {
        next(e);
      }
    });
  }

  // Foreman confirm links: no account (FR-08). The token is the credential.
  app.use('/api', foremanPublic, importsPublic);

  app.use('/api', requireAuth, projects, plan, constraints, weekly, imports);
  app.use(errorHandler);
  return app;
}
