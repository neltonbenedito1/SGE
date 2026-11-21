/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Processo Independente de Worker Assíncrono (SGE — Fase 5)
 * Permite separar o processamento pesado em fila (notificações em massa, SMTP,
 * Stripe webhooks, relatórios, PDFs e tarefas de IA) do servidor HTTP API principal.
 *
 * Execução dedicada:
 *   ENABLE_EMBEDDED_WORKER=false npm run start
 *   npm run worker
 */

import 'dotenv/config';
import http from 'http';
import { GoogleGenAI } from '@google/genai';
import { registerAllAsyncJobHandlers } from '../services/asyncJobHandlers';
import {
  startAsyncWorkerLoop,
  stopAsyncWorkerLoop,
  getAsyncWorkerStats,
} from '../services/asyncJobQueue';
import { getCircuitBreakersSnapshot } from '../services/circuitBreaker';
import { logSecurityEvent } from '../security/logger';

const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'sysedu-worker' } },
  });
}

registerAllAsyncJobHandlers({
  getGeminiClient: () => aiClient,
});

const pollMs = Math.max(1500, Number(process.env.WORKER_POLL_INTERVAL_MS || 3500));
startAsyncWorkerLoop(pollMs);

logSecurityEvent('INFO', 'standalone_worker_started', {
  pollIntervalMs: pollMs,
  worker: getAsyncWorkerStats(),
});

// Servidor HTTP leve opcional para probes de k8s/Cloud Run do serviço de worker
const healthPort = Number(process.env.WORKER_HEALTH_PORT || 0);
let healthServer: http.Server | null = null;
let isShuttingDown = false;

if (healthPort > 0) {
  healthServer = http.createServer((req, res) => {
    if (req.url === '/ready') {
      const stats = getAsyncWorkerStats();
      const ready = !isShuttingDown && stats.running;
      res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ready, worker: stats, circuitBreakers: getCircuitBreakersSnapshot() }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'sysedu-async-worker',
        uptimeSeconds: Math.floor(process.uptime()),
        worker: getAsyncWorkerStats(),
      })
    );
  });
  healthServer.listen(healthPort, '0.0.0.0', () => {
    logSecurityEvent('INFO', 'worker_health_probe_listening', { port: healthPort });
  });
}

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logSecurityEvent('INFO', 'standalone_worker_shutdown', { signal });
  await stopAsyncWorkerLoop();
  if (healthServer) {
    healthServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  } else {
    process.exit(0);
  }
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
