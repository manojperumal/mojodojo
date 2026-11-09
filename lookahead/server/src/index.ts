import 'dotenv/config';
import { createApp } from './app';
import { startEscalationScheduler } from './jobs/escalate';
import { migrate } from './migrate';

const port = Number(process.env.PORT ?? 4000);

await migrate(false);
createApp().listen(port, () => {
  console.log(`Lookahead API on http://localhost:${port} (auth: ${process.env.AUTH_MODE ?? 'dev'})`);
});
startEscalationScheduler();
