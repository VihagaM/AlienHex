import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');

const bool = (value, fallback) =>
  value === undefined || value === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());

const config = {
  port: Number(process.env.PORT) || 3001,
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  dashboardToken: process.env.DASHBOARD_TOKEN || '',

  botName: process.env.BOT_NAME || 'AlienHex',
  prefix: process.env.PREFIX || '.',
  ownerNumber: (process.env.OWNER_NUMBER || '765516398').replace(/\D/g, ''),
  ownerName: process.env.OWNER_NAME || 'Vihaga Manodya',
  autoStart: bool(process.env.AUTO_START, true),
  maxMessageAgeSeconds: Number(process.env.MAX_MESSAGE_AGE_SECONDS) || 60,

  authDir: path.resolve(backendRoot, process.env.AUTH_DIR || 'auth_session'),
  baileysLogLevel: process.env.BAILEYS_LOG_LEVEL || 'silent',
  frontendDist: path.resolve(backendRoot, '../frontend/dist'),
};

export default config;
