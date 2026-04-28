import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';

import authRouter from './routes/auth';
import brandsRouter from './routes/brands';
import occasionsRouter from './routes/occasions';
import giftsRouter from './routes/gifts';
import recipientRouter from './routes/recipient';
import prisma from './lib/prisma';

const app = express();
const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth', authRouter);
app.use('/api/brands', brandsRouter);
app.use('/api/occasions', occasionsRouter);
app.use('/api/gifts', giftsRouter);
app.use('/api/r', recipientRouter);

// ─── 404 handler ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error('[Error]', err.message, err.stack);
    res.status(500).json({ error: 'Internal server error' });
  },
);

// ─── Server startup ───────────────────────────────────────────────────────────

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`[Pensive Post] Server running on port ${PORT}`);
  console.log(`[Pensive Post] Environment: ${process.env['NODE_ENV'] ?? 'development'}`);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Pensive Post] Received ${signal}. Shutting down gracefully...`);

  server.close(async (err) => {
    if (err) {
      console.error('[Pensive Post] Error closing HTTP server:', err);
      process.exit(1);
    }

    try {
      await prisma.$disconnect();
      console.log('[Pensive Post] Database connection closed.');
    } catch (disconnectErr) {
      console.error('[Pensive Post] Error disconnecting Prisma:', disconnectErr);
    }

    console.log('[Pensive Post] Shutdown complete.');
    process.exit(0);
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    console.error('[Pensive Post] Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });

export default app;
