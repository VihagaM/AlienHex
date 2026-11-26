import {
  normalizeMessageContent,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import {
  formatDuration,
  jidToNumber,
  getContextInfo,
  participantMatches,
} from '../utils/helpers.js';
import { getCachedStatus } from '../utils/statusStore.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATEGORY_META = [
  ['general', '📌', 'GENERAL'],
  ['music', '🎵', 'MUSIC'],
  ['group', '👥', 'GROUP'],
  ['utility', '🛠️', 'UTILITY'],
];

// Helpers for the fake .systemclean command
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const progressBar = (percent) => {
  const filled = Math.round(percent / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
};

const randomBetween = (min, max) =>
  (Math.random() * (max - min) + min).toFixed(1);

// Helper for the .dp command:
// converts a @lid JID to the real phone JID (so profilePictureUrl works)
const resolvePhoneJid = async (ctx, jid) => {
  if (!String(jid).endsWith('@lid') || !ctx.isGroup) return jid;

  try {
    const meta = await ctx.getGroupMetadata();
    const participant = meta.participants.find((p) =>
      participantMatches(p, jid)
    );

    const phoneJid = [participant?.phoneNumber, participant?.jid, participant?.id]
      .find((value) => value && String(value).endsWith('@s.whatsapp.net'));

    return phoneJid || jid;
  } catch {
    return jid;
  }
};

// Helpers for the .showstatus command
const MEDIA_KEYS = ['imageMessage', 'videoMessage', 'audioMessage'];

const getMediaType = (content) => MEDIA_KEYS.find((key) => content?.[key]);

// FutureProofMessage wrappers keep the real message in `.message`
const futureContent = (wrapper) => normalizeMessageContent(wrapper?.message);

// Finds the real status content that a quoted message points to
const resolveStatus = (quoted) => {
  // 1. The media is embedded inside the wrapper itself
  const embedded = [
    quoted.statusMentionMessage?.quotedStatus,
    quoted.groupStatusMessageV2,
    quoted.groupStatusMessage,
  ]
    .map(futureContent)
    .find(
      (content) =>
        content &&
        (getMediaType(content) ||
          content.extendedTextMessage ||
          content.conversation)
    );

  if (embedded) return { content: embedded };

  // 2. "This group was mentioned" only carries a pointer to the status,
  //    so look the real status up in the cache
  const protocol = futureContent(quoted.groupStatusMentionMessage)
    ?.protocolMessage;
  const statusId = protocol?.key?.id;
  const cached = statusId ? getCachedStatus(statusId) : undefined;

  if (cached) {
    return {
      content: normalizeMessageContent(cached.msg.message),
      key: cached.msg.key,
    };
  }

  return null;
};

export default [
  {
    name: 'botmenu',
    aliases: ['help', 'commands'],
    category: 'general',
    description: 'Show this menu',
    usage: '.botmenu',

    async execute(ctx) {
      const { config, commands, service } = ctx;

      const uptime = formatDuration(
        Date.now() - service.startedAt
      );

      // Path to the menu image
      const mediaPath = path.join(
        __dirname,
        '../assets/menu.png'
      );

      // Menu header
      const header = [
        '╭━━━ 🤖 BOT MENU ━━━⬣',
        `┃ 👋 Hello, @${ctx.senderNumber}`,
        `┃ ⏱️ Uptime  : ${uptime}`,
        `┃ 📚 Commands: ${commands.length}`,
        '╰━━━━━━━━━━━━━━━⬣',
      ].join('\n');

      // Generate command categories
      const sections = CATEGORY_META.map(
        ([category, emoji, title]) => {
          const categoryCommands = commands.filter(
            (command) => command.category === category
          );

          const lines = categoryCommands.map((command) => {
            const usageArguments = command.usage?.includes(' ')
              ? ` ${command.usage.split(' ').slice(1).join(' ')}`
              : '';

            return [
              `┃ ◈ *${config.prefix}${command.name}*${usageArguments}`,
              `┃    ↳ ${command.description}`,
            ].join('\n');
          });

          return [
            `╭━━━〔 ${emoji} *${title}* 〕━━━⬣`,
            ...lines,
            '╰━━━━━━━━━━━━━━━⬣',
          ].join('\n');
        }
      );

      // Menu footer
      const footer = '_Tip: group commands need admin rights._';

      // Combine the menu text
      const caption = [
        header,
        ...sections,
        footer,
      ].join('\n\n');

      // Fallback: send text if the image is unavailable
      const sendTextMenu = async () => {
        await ctx.reply(caption, {
          mentions: [ctx.sender],
        });
      };

      try {
        if (!fs.existsSync(mediaPath)) {
          console.error(
            '[MENU] Image not found:',
            mediaPath
          );

          await sendTextMenu();
          return;
        }

        // Read the image file
        const image = fs.readFileSync(mediaPath);

        // Send image with caption
        await ctx.sock.sendMessage(
          ctx.jid,
          {
            image,
            caption,
            mentions: [ctx.sender],
          },
          {
            quoted: ctx.msg,
          }
        );
      } catch (error) {
        console.error('[MENU] Failed to send image:', error);

        // Send the text menu if image sending fails
        try {
          await sendTextMenu();
        } catch (fallbackError) {
          console.error(
            '[MENU] Failed to send text menu:',
            fallbackError
          );
        }
      }
    },
  },

  {
    name: 'ping',
    category: 'general',
    description: 'Check response speed',
    usage: '.ping',

    async execute(ctx) {
      const start = Date.now();

      const sent = await ctx.reply('🏓 Pinging…');

      const latency = Date.now() - start;

      const text = [
        '🏓 *Pong!*',
        `⚡ Latency: *${latency} ms*`,
      ].join('\n');

      try {
        await ctx.sock.sendMessage(
          ctx.jid,
          {
            text,
            edit: sent.key,
          }
        );
      } catch {
        await ctx.reply(text);
      }
    },
  },

  {
    name: 'info',
    category: 'general',
    description: 'Group information',
    usage: '.info',
    groupOnly: true,

    async execute(ctx) {
      const meta = await ctx.getGroupMetadata();

      const admins = meta.participants.filter(
        (participant) => participant.admin
      );

      const created = meta.creation
        ? new Date(meta.creation * 1000).toLocaleDateString('en-GB')
        : 'Unknown';

      const lines = [
        '👥 *Group Info*',
        '',
        `📛 *Name:* ${meta.subject}`,
        `🆔 *ID:* ${meta.id}`,
        `📅 *Created:* ${created}`,
        meta.owner
          ? `👑 *Owner:* @${jidToNumber(meta.owner)}`
          : null,
        `👤 *Members:* ${meta.participants.length}`,
        `🛡️ *Admins:* ${admins.length}`,
        `🔇 *Messages:* ${meta.announce ? 'Admins only' : 'Everyone'}`,
        meta.desc
          ? `\n📝 *Description:*\n${meta.desc.slice(0, 500)}`
          : null,
      ].filter(Boolean);

      await ctx.reply(lines.join('\n'), {
        mentions: meta.owner ? [meta.owner] : [],
      });
    },
  },

  {
    name: 'owner',
    category: 'general',
    description: 'Show owner information',
    usage: '.owner',

    async execute(ctx) {
      const { ownerName, ownerNumber, botName } = ctx.config;

      if (!ownerNumber) {
        await ctx.reply(
          'ℹ️ The owner has not been configured yet.'
        );
        return;
      }

      const vcard = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${ownerName}`,
        `ORG:${botName} Owner;`,
        `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}`,
        'END:VCARD',
      ].join('\n');

      await ctx.reply(
        [
          '👑 *Bot Owner*',
          '',
          `📛 Name: ${ownerName}`,
          `📞 Number: +94${ownerNumber}`,
          `💻 Profession: Software Engineer & Cyber Security Engineer`,
          `🔗 https://wa.me/${ownerNumber}`,
        ].join('\n')
      );

      
    },
  },

  {
    name: 'alive',
    category: 'general',
    description: 'Check if the bot is running',
    usage: '.alive',

    async execute(ctx) {
      const { botName, prefix } = ctx.config;

      await ctx.reply(
        [
          `✅ *${botName} is alive and running!*`,
          '',
          `⏱️ Uptime: ${formatDuration(Date.now() - ctx.service.startedAt)}`,
          `⚡ Prefix: ${prefix}`,
          `📖 Type *${prefix}menu* to see all commands.`,
        ].join('\n')
      );
    },
  },

  {
    name: 'id',
    category: 'general',
    description: 'Get the current chat ID',
    usage: '.id',

    async execute(ctx) {
      const lines = [
        `🆔 *Chat ID:*\n${ctx.jid}`,
      ];

      if (ctx.isGroup) {
        lines.push(`\n👤 *Your ID:*\n${ctx.sender}`);
      }

      await ctx.reply(lines.join('\n'));
    },
  },

  {
    name: 'runtime',
    aliases: ['uptime'],
    category: 'general',
    description: 'Show bot uptime',
    usage: '.runtime',

    async execute(ctx) {
      await ctx.reply(
        [
          '⏱️ *Runtime*',
          `The bot has been running for *${formatDuration(Date.now() - ctx.service.startedAt)}*.`,
        ].join('\n')
      );
    },
  },

  {
    name: 'systemclean',
    aliases: ['sysclean'],
    category: 'utility',
    description: 'Run a system cleanup',
    usage: '.systemclean',

    async execute(ctx) {
      // Fake numbers - nothing is actually deleted
      const cache = randomBetween(120, 480);
      const temp = randomBetween(40, 220);
      const logs = randomBetween(10, 90);
      const junk = randomBetween(5, 60);
      const total = (
        Number(cache) + Number(temp) + Number(logs) + Number(junk)
      ).toFixed(1);

      const steps = [
        { percent: 15, label: 'Scanning system files…' },
        { percent: 35, label: `Clearing cache… (${cache} MB)` },
        { percent: 55, label: `Removing temp files… (${temp} MB)` },
        { percent: 75, label: `Deleting old logs… (${logs} MB)` },
        { percent: 90, label: `Removing junk data… (${junk} MB)` },
        { percent: 100, label: 'Optimizing memory…' },
      ];

      const render = (percent, label) =>
        [
          '🧹 *System Cleaner*',
          '',
          `[${progressBar(percent)}] ${percent}%`,
          `⚙️ ${label}`,
        ].join('\n');

      const finalText = [
        '✅ *System Clean Complete!*',
        '',
        `🗂️ Cache     : ${cache} MB`,
        `📁 Temp files: ${temp} MB`,
        `📜 Old logs  : ${logs} MB`,
        `🗑️ Junk data : ${junk} MB`,
        '',
        `💾 *Total freed: ${total} MB*`,
        '🚀 Your system is running smoothly.',
      ].join('\n');

      const sent = await ctx.reply(render(0, 'Starting cleanup…'));
      let canEdit = Boolean(sent?.key);

      for (const step of steps) {
        await sleep(1500);
        if (!canEdit) continue;

        try {
          await ctx.sock.sendMessage(ctx.jid, {
            text: render(step.percent, step.label),
            edit: sent.key,
          });
        } catch {
          canEdit = false;
        }
      }

      await sleep(1200);

      if (canEdit) {
        try {
          await ctx.sock.sendMessage(ctx.jid, {
            text: finalText,
            edit: sent.key,
          });
          return;
        } catch {
          // fall through to a normal reply
        }
      }

      await ctx.reply(finalText);
    },
  },

  {
    name: 'dp',
    aliases: ['pp', 'profilepic'],
    category: 'utility',
    description: 'Get the profile picture of a mentioned or replied user',
    usage: '.dp @user',

    async execute(ctx) {
      const content = normalizeMessageContent(ctx.msg?.message);
      const contextInfo = getContextInfo(content);

      // Priority: mentioned user > replied user > the sender themself
      let target = contextInfo?.mentionedJid?.[0];

      if (!target && contextInfo?.quotedMessage) {
        target =
          contextInfo.participant || (!ctx.isGroup ? ctx.jid : undefined);
      }

      if (!target) {
        target = ctx.sender;
      }

      target = await resolvePhoneJid(ctx, target);
      const number = jidToNumber(target);

      try {
        const url = await ctx.sock.profilePictureUrl(target, 'image');

        await ctx.sock.sendMessage(
          ctx.jid,
          {
            image: { url },
            caption: `🖼️ *Profile Picture*\n👤 @${number}`,
            mentions: [target],
          },
          { quoted: ctx.msg }
        );
      } catch (error) {
        console.error('[DP] Failed to fetch profile picture:', error);

        await ctx.reply(
          `❌ Couldn't get the profile picture of @${number}.\n` +
            'They may have no picture, or their privacy settings hide it.',
          { mentions: [target] }
        );
      }
    },
  },

  {
    name: 'showstatus',
    aliases: ['getstatus'],
    category: 'utility',
    description: 'Reply to a status mention to get the status',
    usage: '.showstatus',

    async execute(ctx) {
      const content = normalizeMessageContent(ctx.msg?.message);
      const contextInfo = getContextInfo(content);

      if (!contextInfo?.quotedMessage) {
        await ctx.reply(
          '↩️ Reply to a *"status mention"* message with *.showstatus*.'
        );
        return;
      }

      const quoted = normalizeMessageContent(contextInfo.quotedMessage);
      const status = resolveStatus(quoted);

      if (!status) {
        await ctx.reply(
          [
            "❌ I couldn't find that status.",
            '',
            'The mention message only points to the status. I can show it ' +
              'only if the bot received it while it was online, which ' +
              'usually needs the poster to share their status with the ' +
              "bot's number.",
          ].join('\n')
        );
        return;
      }

      const posterJid = status.key?.participant || contextInfo.participant;
      const poster = posterJid ? await resolvePhoneJid(ctx, posterJid) : null;
      const mentions = poster ? [poster] : [];
      const header = poster
        ? `📸 *Status* of @${jidToNumber(poster)}`
        : '📸 *Status*';

      try {
        const type = getMediaType(status.content);

        // Text-only status
        if (!type) {
          const text =
            status.content.conversation ||
            status.content.extendedTextMessage?.text;

          if (!text) {
            await ctx.reply('❌ This status type is not supported.');
            return;
          }

          await ctx.reply(`${header}\n\n${text}`, { mentions });
          return;
        }

        // Image / video / audio status
        const buffer = await downloadMediaMessage(
          {
            key: status.key ?? ctx.msg.key,
            message: status.content,
          },
          'buffer',
          {},
          {
            logger: ctx.sock.logger,
            reuploadRequest: ctx.sock.updateMediaMessage,
          }
        );

        const media = status.content[type];
        const caption = [header, media.caption].filter(Boolean).join('\n\n');

        let payload;

        if (type === 'imageMessage') {
          payload = { image: buffer, caption, mentions };
        } else if (type === 'videoMessage') {
          payload = {
            video: buffer,
            caption,
            gifPlayback: Boolean(media.gifPlayback),
            mentions,
          };
        } else {
          await ctx.reply(header, { mentions });
          payload = {
            audio: buffer,
            mimetype: media.mimetype || 'audio/mp4',
            ptt: Boolean(media.ptt),
          };
        }

        await ctx.sock.sendMessage(ctx.jid, payload, { quoted: ctx.msg });
      } catch (error) {
        console.error('[SHOWSTATUS] Failed to get status:', error);

        await ctx.reply(
          '❌ Failed to download the status. It may have expired.'
        );
      }
    },
  },
];