#!/usr/bin/env node
// Post-deploy smoke test. No dependencies.
//   API_URL=https://lookahead-api.onrender.com APP_URL=https://lookahead.vercel.app \
//   SUPABASE_URL=https://xyz.supabase.co SUPABASE_ANON_KEY=... npm run smoke
const api = process.env.API_URL?.replace(/\/$/, '');
const app = process.env.APP_URL?.replace(/\/$/, '');
const sbUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const sbKey = process.env.SUPABASE_ANON_KEY;
if (!api) {
  console.error('Set API_URL (and ideally APP_URL, SUPABASE_URL, SUPABASE_ANON_KEY).');
  process.exit(2);
}

let failed = 0;
const check = async (name, fn) => {
  try {
    const detail = await fn();
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name} — ${e.message}`);
  }
};
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

console.log(`API ${api}`);
await check('health (API + database)', async () => {
  const r = await fetch(`${api}/api/health`);
  expect(r.ok, `status ${r.status}: ${await r.text()}`);
});
await check('real sign-in is on (AUTH_MODE=supabase)', async () => {
  const c = await (await fetch(`${api}/api/config`)).json();
  expect(c.authMode === 'supabase', `authMode is "${c.authMode}"`);
});
await check('dev sign-in is not exposed', async () => {
  const r = await fetch(`${api}/api/dev/users`);
  expect(r.status !== 200, 'GET /api/dev/users returned 200 — anyone could act as any user');
});
await check('API rejects requests without a token', async () => {
  const r = await fetch(`${api}/api/me`);
  expect(r.status === 401, `expected 401, got ${r.status}`);
});
await check('CSV templates download', async () => {
  const r = await fetch(`${api}/api/csv-templates/activities`);
  expect(r.ok && (await r.text()).startsWith('id,name'), `status ${r.status}`);
});
if (app) {
  await check('CORS allows the web app', async () => {
    const r = await fetch(`${api}/api/health`, { headers: { Origin: app } });
    const allowed = r.headers.get('access-control-allow-origin');
    expect(allowed === app || allowed === '*', `allow-origin is "${allowed}"`);
    return allowed === '*' ? 'any origin allowed — set CORS_ORIGIN or NODE_ENV=production' : undefined;
  });
  await check('CORS blocks other sites', async () => {
    const r = await fetch(`${api}/api/health`, { headers: { Origin: 'https://evil.example' } });
    expect(r.headers.get('access-control-allow-origin') !== 'https://evil.example', 'other origins are allowed');
  });
  console.log(`App ${app}`);
  await check('web app loads', async () => {
    const r = await fetch(app);
    expect(r.ok && (await r.text()).includes('<div id="root">'), `status ${r.status}`);
  });
  await check('deep links work (SPA rewrite)', async () => {
    const r = await fetch(`${app}/f/some-token`);
    expect(r.ok, `status ${r.status} — check vercel.json rewrites`);
  });
}
if (sbUrl && sbKey) {
  console.log(`Supabase ${sbUrl}`);
  await check('tables are not readable through the public Supabase API', async () => {
    const r = await fetch(`${sbUrl}/rest/v1/users?select=email&limit=1`, { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } });
    const body = await r.text();
    expect(!(r.ok && body.includes('@')), `anon key can read users: ${body.slice(0, 120)}`);
  });
}
console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
