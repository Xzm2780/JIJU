import { createDemoApp } from './app.js';

const app = createDemoApp();
const port = Number(process.env.PORT ?? 3000);
const baseUrl = await app.listen(port);

console.log(`JIJU publish demo: ${baseUrl}`);

async function shutdown() {
  await app.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
