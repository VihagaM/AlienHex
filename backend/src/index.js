import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import config from './config.js';
import { log, logHub } from './logger.js';
import { WhatsAppService } from './whatsapp.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: config.clientOrigins } });
logHub.attach(io);

const service = new WhatsAppService(io);

/* ───────────── Auth (optional shared token) ───────────── */
const digest = (value) => crypto.createHash('sha256').update(String(value)).digest();
const tokenValid = (token) =>
  !config.dashboardToken || crypto.timingSafeEqual(digest(token ?? ''), digest(config.dashboardToken));

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (tokenValid(token)) return next();
  res.status(401).json({ error: 'unauthorized' });
};

if (!config.dashboardToken) {
  log.warn('DASHBOARD_TOKEN is empty — the dashboard is unprotected. Do not expose this server publicly.');
}

/* ───────────── REST API ───────────── */
app.use(cors({ origin: config.clientOrigins }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.get('/api/auth-required', (_req, res) => res.json({ required: Boolean(config.dashboardToken) }));

app.get('/api/status', requireAuth, (_req, res) => res.json({ state: service.snapshot(), stats: service.statsSnapshot() }));

const action = (fn) => async (_req, res) => {
  try {
    await fn();
    res.json({ ok: true });
  } catch (err) {
    log.error(err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
};

app.post('/api/start', requireAuth, action(() => service.start()));
app.post('/api/restart', requireAuth, action(() => service.restart()));
app.post('/api/logout', requireAuth, action(() => service.logout()));

/* ───────────── Optional: serve the built dashboard ───────────── */
if (fs.existsSync(config.frontendDist)) {
  app.use(express.static(config.frontendDist));
  app.get('*', (req, res, next) =>
    req.path.startsWith('/api') ? next() : res.sendFile(path.join(config.frontendDist, 'index.html')),
  );
}

/* ───────────── Socket.io ───────────── */
io.use((socket, next) => (tokenValid(socket.handshake.auth?.token) ? next() : next(new Error('unauthorized'))));

io.on('connection', (socket) => {
  socket.emit('state', service.snapshot());
  socket.emit('stats', service.statsSnapshot());
  socket.emit('logs', logHub.history());
});

/* ───────────── Boot & shutdown ───────────── */
server.listen(config.port, () => {
  log.success(`Server listening on http://localhost:${config.port}`);
  if (config.autoStart) service.start();
  else log.info('AUTO_START is off — press “Connect” in the dashboard to start the bot.');
});

const shutdown = async (signal) => {
  log.info(`${signal} received — shutting down…`);
  await service.stop().catch(() => {});
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  service.recordError();
  log.error(`Unhandled rejection: ${reason?.message || reason}`);
});
process.on('uncaughtException', (err) => {
  service.recordError();
  log.error(`Uncaught exception: ${err.message}`);
});
