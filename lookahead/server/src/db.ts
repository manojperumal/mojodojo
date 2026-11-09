import pg from 'pg';

// Return DATE columns as 'YYYY-MM-DD' strings, not JS Dates (avoids time-zone drift).
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/lookahead',
  max: 10,
});

export type Db = pg.Pool | pg.PoolClient;

const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

export function camelize<T = any>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[camel(k)] = v instanceof Date ? v.toISOString() : v;
  return out as T;
}

export async function q<T = any>(db: Db, text: string, params: unknown[] = []): Promise<T[]> {
  const res = await db.query(text, params);
  return res.rows.map((r) => camelize<T>(r));
}

export async function one<T = any>(db: Db, text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(db, text, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
}

const snake = (s: string) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());

/** Build "col1 = $1, col2 = $2" from a camelCase patch. Only keys in `allowed` are used. */
export function setClause(patch: Record<string, unknown>, allowed: string[], offset = 1) {
  const keys = Object.keys(patch).filter((k) => allowed.includes(k) && patch[k] !== undefined);
  return {
    sql: keys.map((k, i) => `${snake(k)} = $${i + offset}`).join(', '),
    values: keys.map((k) => patch[k]),
    keys,
  };
}
