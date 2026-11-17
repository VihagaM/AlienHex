import fs from 'node:fs/promises';
import pino from 'pino';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  normalizeMessageContent,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import config from './config.js';
import { log } from './logger.js';
import { handleMessage } from './commandHandler.js';
import { isParticipantAdmin } from './utils/helpers.js';

const baileysLogger = pino({ level: config.baileysLogLevel });
const MAX_MESSAGE_LENGTH = 2500;
const GROUP_LINK_FILTER_JID = '120363422465751631@g.us';
const LINK_PATTERN =
  /(?:https?|ftp):\/\/|www\.|chat\.whatsapp\.com|(?<![@\w.-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d{2,5})?(?:[/?#]\S*)?/i;
const CONTROL_CHARACTERS = /[\p{Cc}\p{Cf}]/gu;
const UNEXPECTED_CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u;
const DIRECTIONAL_OVERRIDE_CHARACTERS = /[\u202D\u202E\u206A-\u206F]/u;
const REPEATED_INVISIBLE_CHARACTERS = /([\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF])\1{7,}/u;

const extractMessageText = (message) => {
  const content = normalizeMessageContent(message);
  return (
    content?.conversation ||
    content?.extendedTextMessage?.text ||
    content?.imageMessage?.caption ||
    content?.videoMessage?.caption ||
    content?.documentMessage?.caption ||
    ''
  );
};

const inspectMessage = (text) => {
  const controls = text.match(CONTROL_CHARACTERS) || [];
  const hiddenControlCount = controls.filter((character) => !/[\t\n\r\u200D]/u.test(character)).length;
  const reasons = [];

  if (text.length > MAX_MESSAGE_LENGTH) reasons.push(`length=${text.length}`);
  if (UNEXPECTED_CONTROL_CHARACTERS.test(text)) reasons.push('unexpected control characters');
  if (DIRECTIONAL_OVERRIDE_CHARACTERS.test(text)) reasons.push('directional override characters');
  if (
    hiddenControlCount >= 8 &&
    (hiddenControlCount > 20 || hiddenControlCount / Math.max(text.length, 1) >= 0.05)
  ) {
    reasons.push(`hidden controls=${hiddenControlCount}`);
  }
  if (REPEATED_INVISIBLE_CHARACTERS.test(text)) reasons.push('repeated invisible characters');

  return reasons;
};

const revokeMessage = async (sock, msg, service, reason) => {
  const jid = msg.key.remoteJid;
  const messageId = msg.key.id || '(unknown id)';
  log.warn(`Deleting ${reason} message ${messageId} from ${jid}`);
  try {
    await sock.sendMessage(jid, { delete: msg.key });
  } catch (err) {
    service.recordError();
    log.warn(`Could not revoke message ${messageId} from ${jid}: ${err.message}`);
  }
};

/**
 * Status values streamed to the dashboard:
 *  disconnected | connecting | qr | connected | disconnecting
 */
export class WhatsAppService {
  constructor(io) {
    this.io = io;
    this.sock = null;
    this.starting = false;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.statsTimer = null;

    this.startedAt = Date.now();
    this.state = { status: 'disconnected', qr: null, user: null, reason: null };
    this.stats = { messagesReceived: 0, commandsExecuted: 0, errors: 0, commandUsage: {} };
  }

  /* ───────────── Public state helpers ───────────── */

  snapshot() {
    return { ...this.state, startedAt: this.startedAt };
  }

  statsSnapshot() {
    const topCommands = Object.entries(this.stats.commandUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    return {
      messagesReceived: this.stats.messagesReceived,
      commandsExecuted: this.stats.commandsExecuted,
      errors: this.stats.errors,
      topCommands,
      startedAt: this.startedAt,
    };
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    this.io.emit('state', this.snapshot());
  }

  scheduleStatsEmit() {
    if (this.statsTimer) return;
    this.statsTimer = setTimeout(() => {
      this.statsTimer = null;
      this.io.emit('stats', this.statsSnapshot());
    }, 500);
  }

  recordCommand(name) {
    this.stats.commandsExecuted++;
    this.stats.commandUsage[name] = (this.stats.commandUsage[name] || 0) + 1;
    this.scheduleStatsEmit();
  }

  recordError() {
    this.stats.errors++;
    this.scheduleStatsEmit();
  }

  /* ───────────── Lifecycle ───────────── */

  async start() {
    if (this.starting || this.sock) return;
    this.starting = true;
    clearTimeout(this.reconnectTimer);

    try {
      this.setState({ status: 'connecting', qr: null, reason: null });
      log.info('Starting WhatsApp connection…');

      const { state, saveCreds } = await useMultiFileAuthState(config.authDir);

      let version;
      try {
        ({ version } = await fetchLatestBaileysVersion());
        log.info(`Using WhatsApp Web version ${version.join('.')}`);
      } catch {
        log.warn('Could not fetch latest WhatsApp Web version, using library default');
      }

      const sock = makeWASocket({
        version,
        logger: baileysLogger,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
        },
        browser: Browsers.ubuntu('Chrome'),
        markOnlineOnConnect: false,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
      });
      this.sock = sock;

      sock.ev.on('creds.update', saveCreds);
      sock.ev.on('connection.update', (update) => this.onConnectionUpdate(sock, update));
      sock.ev.on('messages.upsert', (payload) => this.onMessages(sock, payload));
    } catch (err) {
      this.sock = null;
      log.error(`Failed to start WhatsApp: ${err.message}`);
      this.recordError();
      this.setState({ status: 'disconnected', reason: err.message });
    } finally {
      this.starting = false;
    }
  }

  async onConnectionUpdate(sock, update) {
    if (sock !== this.sock) return; // event from a stale socket
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.setState({ status: 'qr', qr });
      log.info('QR code ready — scan it from WhatsApp › Linked devices');
    }

    if (connection === 'open') {
      this.reconnectAttempts = 0;
      this.setState({ status: 'connected', qr: null, user: sock.user ?? null, reason: null });
      log.success(`Connected as ${sock.user?.name || sock.user?.id || 'unknown'}`);
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const message = lastDisconnect?.error?.message || 'Connection closed';
      this.sock = null;

      if (code === DisconnectReason.loggedOut) {
        log.warn('Session logged out from the phone — clearing saved session');
        await this.clearAuth();
        this.setState({ status: 'disconnected', qr: null, user: null, reason: 'Logged out from WhatsApp' });
        return;
      }

      this.setState({ status: 'disconnected', qr: null, user: null, reason: message });

      if (code === DisconnectReason.restartRequired) {
        log.info('WhatsApp requested a restart — reconnecting…');
        this.start();
        return;
      }

      if (code === DisconnectReason.connectionReplaced) {
        log.warn('Session replaced by another login. Not reconnecting automatically.');
        return;
      }

      this.scheduleReconnect(message);
    }
  }

  scheduleReconnect(reason) {
    this.reconnectAttempts++;
    const delay = Math.min(30000, 2000 * 2 ** (this.reconnectAttempts - 1));
    log.warn(`Disconnected (${reason}). Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts})`);
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.start(), delay);
  }

  async stop({ logout = false } = {}) {
    clearTimeout(this.reconnectTimer);
    const sock = this.sock;
    this.sock = null; // detach first so stale events are ignored
    this.setState({ status: 'disconnecting', qr: null });

    if (sock) {
      if (logout) {
        try {
          await sock.logout();
        } catch (err) {
          log.warn(`Logout call failed (${err.message}); clearing local session anyway`);
        }
      }
      try {
        sock.end(undefined);
      } catch {
        /* socket already closed */
      }
    }

    if (logout) await this.clearAuth();
    this.setState({ status: 'disconnected', user: null, reason: logout ? 'Logged out' : null });
  }

  async restart() {
    log.info('Restarting bot…');
    await this.stop();
    this.reconnectAttempts = 0;
    await this.start();
  }

  async logout() {
    log.info('Logging out and removing saved session…');
    await this.stop({ logout: true });
    log.success('Logged out. Press “Connect” to pair a new device.');
  }

  async clearAuth() {
    await fs.rm(config.authDir, { recursive: true, force: true });
  }

  /* ───────────── Incoming messages ───────────── */

  async onMessages(sock, { messages, type }) {
    if (sock !== this.sock || type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message) continue;
      if (msg.key.remoteJid === 'status@broadcast') continue;

      const timestamp = Number(msg.messageTimestamp?.low ?? msg.messageTimestamp ?? 0);
      if (timestamp && Date.now() / 1000 - timestamp > config.maxMessageAgeSeconds) continue;

      this.stats.messagesReceived++;
      this.scheduleStatsEmit();

      const text = extractMessageText(msg.message);
      const suspiciousReasons = inspectMessage(text);
      if (suspiciousReasons.length) {
        await revokeMessage(sock, msg, this, `suspicious (${suspiciousReasons.join(', ')})`);
        continue;
      }

      const jid = msg.key.remoteJid;
      if (jid === GROUP_LINK_FILTER_JID && !msg.key.fromMe && LINK_PATTERN.test(text)) {
        try {
          const metadata = await sock.groupMetadata(jid);
          if (msg.key.participant && isParticipantAdmin(metadata.participants, msg.key.participant)) continue;
        } catch (err) {
          this.recordError();
          log.warn(`Could not verify admin status for linked message ${msg.key.id || '(unknown id)'}: ${err.message}`);
          continue;
        }
        await revokeMessage(sock, msg, this, 'non-admin link');
        continue;
      }

      try {
        await handleMessage({ sock, msg, service: this });
      } catch (err) {
        this.recordError();
        log.error(`Message handler error: ${err.message}`);
      }
    }
  }
}
