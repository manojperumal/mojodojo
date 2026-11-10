import 'dotenv/config';
import { createApp } from './app';
import { startEscalationScheduler } from './jobs/escalate';
import { validateConfig } from './config';
import { migrate } from './migrate';

const port = Number(process.env.PORT ?? 4000);

validateConfig();
await migrate(true);
createApp().listen(port, () => {
  console.log(`Lookahead API on http://localhost:${port} (auth: ${process.env.AUTH_MODE ?? 'dev'})`);
});
startEscalationScheduler();
