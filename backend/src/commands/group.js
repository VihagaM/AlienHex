import { jidToNumber, numberToJid } from '../utils/helpers.js';

const STATUS_TEXT = {
  200: 'Done',
  401: 'Not allowed / blocked',
  403: 'Privacy settings prevent this (invite needed)',
  404: 'User not found',
  408: 'Recently left the group',
  409: 'Already in the group',
  500: 'WhatsApp error',
};

/** Targets from @mentions, a replied-to message, or raw phone numbers. */
function resolveTargets(ctx) {
  const info = ctx.quotedInfo;
  const targets = new Set(info?.mentionedJid ?? []);
  if (!targets.size && info?.participant) targets.add(info.participant);
  if (!targets.size) {
    for (const arg of ctx.args) {
      const digits = arg.replace(/\D/g, '');
      if (digits.length >= 7) targets.add(numberToJid(digits));
    }
  }
  return [...targets].filter((jid) => jidToNumber(jid) !== jidToNumber(ctx.botJid));
}

async function participantAction(ctx, action, title) {
  const targets = resolveTargets(ctx);
  if (!targets.length) {
    return void (await ctx.reply(
      `⚠️ Mention a user, reply to their message${action === 'add' ? ', or type their number' : ''}.\nExample: *${ctx.prefix}${ctx.command} ${action === 'add' ? '94771234567' : '@user'}*`,
    ));
  }

  const results = await ctx.sock.groupParticipantsUpdate(ctx.jid, targets, action);
  const lines = results.map((r) => {
    const ok = String(r.status) === '200';
    return `${ok ? '✅' : '❌'} @${jidToNumber(r.jid)} — ${STATUS_TEXT[r.status] ?? `Status ${r.status}`}`;
  });
  await ctx.reply(`*${title}*\n\n${lines.join('\n')}`, { mentions: results.map((r) => r.jid) });
}

const adminCommand = { category: 'group', groupOnly: true, adminOnly: true, botAdminRequired: true };

export default [
  // {
  //   ...adminCommand,
  //   name: 'kick',
  //   aliases: ['remove'],
  //   description: 'Remove a member',
  //   usage: '.kick @user',
  //   execute: (ctx) => participantAction(ctx, 'remove', '🚪 Remove Member'),
  // },
  {
    ...adminCommand,
    name: 'add',
    description: 'Add a member',
    usage: '.add @user',
    execute: (ctx) => participantAction(ctx, 'add', '➕ Add Member'),
  },
  // {
  //   ...adminCommand,
  //   name: 'promote',
  //   description: 'Promote a member to admin',
  //   usage: '.promote @user',
  //   execute: (ctx) => participantAction(ctx, 'promote', '⬆️ Promote Member'),
  // },
  // {
  //   ...adminCommand,
  //   name: 'demote',
  //   description: 'Demote an admin to member',
  //   usage: '.demote @user',
  //   execute: (ctx) => participantAction(ctx, 'demote', '⬇️ Demote Admin'),
  // },
  // {
  //   ...adminCommand,
  //   name: 'mute',
  //   description: 'Only admins can send messages',
  //   usage: '.mute',
  //   async execute(ctx) {
  //     await ctx.sock.groupSettingUpdate(ctx.jid, 'announcement');
  //     await ctx.reply('🔇 Group muted — only admins can send messages now.');
  //   },
  // },
  // {
  //   ...adminCommand,
  //   name: 'unmute',
  //   description: 'Let everyone send messages',
  //   usage: '.unmute',
  //   async execute(ctx) {
  //     await ctx.sock.groupSettingUpdate(ctx.jid, 'not_announcement');
  //     await ctx.reply('🔊 Group unmuted — everyone can send messages.');
  //   },
  // },
  // {
  //   category: 'group',
  //   groupOnly: true,
  //   adminOnly: true,
  //   name: 'tagall',
  //   aliases: ['everyone'],
  //   description: 'Mention every member',
  //   usage: '.tagall [message]',
  //   async execute(ctx) {
  //     const { participants, subject } = await ctx.getGroupMetadata();
  //     const lines = participants.map((p) => `◈ @${jidToNumber(p.id)}`);
  //     const text = [`📢 *Attention — ${subject}*`, ctx.text ? `\n💬 ${ctx.text}` : '', '', ...lines].join('\n');
  //     await ctx.reply(text, { mentions: participants.map((p) => p.id) });
  //   },
  // },
];
