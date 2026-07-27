import { config } from './config.js';
import { createApp } from './app.js';
import { startExpiredOrderCleanup } from './jobs/cleanupExpiredOrders.js';

const app = createApp();

// Start background jobs
startExpiredOrderCleanup();

app.listen(config.port, () => {
  console.log(`[LastBite Backend] Running on http://localhost:${config.port}`);
});
