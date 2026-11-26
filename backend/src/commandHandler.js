import { jidNormalizedUser, normalizeMessageContent } from '@whiskeysockets/baileys';
import config from './config.js';
import { log } from './logger.js';
import registry, { commands } from './commands/index.js';
import { getContextInfo, isParticipantAdmin, jidToNumber } from './utils/helpers.js';
import { isPairedOwnerJid } from './utils/pairedOwners.js';

const ADDITIONAL_OWNER_JIDS = new Set(['262736504189099@lid']);

const extractText = (content) =>
  content?.conversation ||
  content?.extendedTextMessage?.text ||
  content?.imageMessage?.caption ||
  content?.videoMessage?.caption ||
  content?.documentMessage?.caption ||
  '';

/**
 * Parses an incoming message, checks permissions and routes it to a command.
 * NOTE: bot replies must never start with the prefix, otherwise the bot
 * would react to its own messages (the linked account receives them as fromMe).
 */
export async function handleMessage({ sock, msg, service }) {
  const jid = msg.key.remoteJid;
  if (!jid || jid.endsWith('@broadcast') || jid.endsWith('@newsletter')) return;

  const content = normalizeMessageContent(msg.message);
  if (!content) return;

  const isGroup = jid.endsWith('@g.us');
  const fromMe = Boolean(msg.key.fromMe);
  const botJid = jidNormalizedUser(sock.user.id);
  const sender = fromMe ? botJid : jidNormalizedUser(msg.key.participant || jid);
  const senderNumber = jidToNumber(sender);
  const pushName = msg.pushName || senderNumber;

  // Log metadata only (never message bodies) to keep chats private.
  if (!fromMe) log.message(`${isGroup ? 'Group' : 'Private'} message from ${pushName}`);

  const body = extractText(content).trim();
  if (!body.startsWith(config.prefix)) return;

  const [rawName, ...args] = body.slice(config.prefix.length).trim().split(/\s+/);
  const command = registry.get((rawName || '').toLowerCase());
  if (!command) return; // unknown commands are ignored silently

  const isOwner =
    fromMe ||
    ADDITIONAL_OWNER_JIDS.has(sender) ||
    isPairedOwnerJid(sender) ||
    (config.ownerNumber !== '' && senderNumber === config.ownerNumber);
  if (!isOwner) return;

  let metadataPromise;
  const ctx = {
    sock,
    msg,
    content,
    jid,
    sender,
    senderNumber,
    pushName,
    botJid,
    isGroup,
    isOwner,
    fromMe,
    args,
    text: args.join(' '),
    command: command.name,
    prefix: config.prefix,
    config,
    service,
    commands,
    quotedInfo: getContextInfo(content),
    reply: (text, extra = {}) => sock.sendMessage(jid, { text, ...extra }, { quoted: msg }),
    getGroupMetadata: () => {
      metadataPromise ??= sock.groupMetadata(jid);
      return metadataPromise;
    },
  };

  try {
    if (command.ownerOnly && !isOwner) {
      return void (await ctx.reply('⛔ This command is for the bot owner only.'));
    }
    if (command.groupOnly && !isGroup) {
      return void (await ctx.reply('⚠️ This command can only be used inside a group.'));
    }
    if (isGroup && (command.adminOnly || command.botAdminRequired)) {
      const metadata = await ctx.getGroupMetadata();
      if (command.adminOnly && !isOwner && !isParticipantAdmin(metadata.participants, sender)) {
        return void (await ctx.reply('⛔ Only group admins can use this command.'));
      }
      if (command.botAdminRequired && !isParticipantAdmin(metadata.participants, botJid)) {
        return void (await ctx.reply('⚠️ I need to be a group admin to do that.'));
      }
    }

    log.command(`${pushName} ran ${config.prefix}${command.name}${isGroup ? ' in a group' : ''}`);
    service.recordCommand(command.name);
    await command.execute(ctx);
  } catch (err) {
    service.recordError();
    log.error(`${config.prefix}${command.name} failed: ${err.message}`);
    await ctx.reply('❌ Something went wrong while running that command.').catch(() => {});
  }
}
