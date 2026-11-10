// Fail fast on a misconfigured production deploy instead of failing on the first request.
const isProd = () => process.env.NODE_ENV === 'production';

export const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export function corsOrigins(): string[] | '*' {
  const explicit = list(process.env.CORS_ORIGIN);
  if (explicit.length) return explicit;
  if (isProd() && process.env.APP_URL) return [new URL(process.env.APP_URL).origin];
  return '*';
}

export function validateConfig() {
  const errors: string[] = [];
  const warnings: string[] = [];
  const env = process.env;
  if (isProd()) {
    if (!env.DATABASE_URL) errors.push('DATABASE_URL is required.');
    if ((env.AUTH_MODE ?? 'dev') !== 'supabase' && env.ALLOW_DEV_AUTH !== 'true')
      errors.push('AUTH_MODE must be "supabase" in production (dev sign-in lets anyone pick any user).');
    if (env.AUTH_MODE === 'supabase' && !env.SUPABASE_URL && !env.SUPABASE_JWT_SECRET)
      errors.push('Set SUPABASE_URL (and optionally SUPABASE_JWT_SECRET) so sign-in tokens can be verified.');
    if (!env.APP_URL) errors.push('APP_URL is required (used in emails and foreman links).');
    else if (!env.APP_URL.startsWith('https://')) warnings.push('APP_URL is not https.');
    if (!env.SMTP_HOST) warnings.push('SMTP_HOST is not set: escalation and foreman emails will only be logged, not sent.');
    if (!env.CRON_SECRET) warnings.push('CRON_SECRET is not set: the /api/cron/escalations backup trigger is disabled.');
    if (!list(env.PROJECT_CREATOR_EMAILS).length) warnings.push('PROJECT_CREATOR_EMAILS is not set: any signed-in user can create a project.');
  }
  for (const w of warnings) console.warn(`[config] ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`[config] ${e}`);
    throw new Error('Invalid configuration — see messages above.');
  }
}
