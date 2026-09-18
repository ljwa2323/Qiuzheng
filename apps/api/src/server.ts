import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';

async function main() {
  const env = loadEnv();
  const app = await buildApp();
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  console.log(`Qiuzheng API listening on :${env.API_PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
