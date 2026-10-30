// Ponto de entrada do servidor AnkoraOne (self-hosted).
import { config } from './config.js';
import { migrate, pool } from './db.js';
import { Router, createServer } from './http.js';
import { loadSchemas } from './entities/schemas.js';
import { authenticate, registerAuthRoutes, ensureBootstrapAdmin } from './auth/routes.js';
import { registerApiRoutes } from './routes.js';
import { registerAgentRoutes } from './agents.js';
import { registerConnectorRoutes } from './connectors.js';
import { registerWorkflowRoutes, startWorkflows } from './workflows/engine.js';
import { loadFunctions } from './functions/runtime.js';

async function main() {
  console.log(`[server] a iniciar (base44: ${config.base44Dir}, armazenamento: ${config.storage.driver})`);
  await migrate();
  const schemas = loadSchemas();
  console.log(`[server] ${schemas.size} entidades carregadas`);
  await ensureBootstrapAdmin();
  await loadFunctions();

  const router = new Router();
  registerAuthRoutes(router);
  registerApiRoutes(router);
  registerAgentRoutes(router);
  registerConnectorRoutes(router);
  registerWorkflowRoutes(router);
  startWorkflows();

  const server = createServer(router, { authenticate });
  server.requestTimeout = 0; // necessário para SSE e uploads longos
  server.headersTimeout = 65000;
  server.listen(config.port, config.host, () => {
    console.log(`[server] a ouvir em http://${config.host}:${config.port} (URL pública: ${config.publicUrl})`);
  });

  const shutdown = (signal) => {
    console.log(`[server] ${signal} recebido, a terminar…`);
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[server] falha no arranque:', err);
  process.exit(1);
});
