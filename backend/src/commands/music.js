import yts from 'yt-search';
import { chunkText, fetchJson, truncate } from '../utils/helpers.js';

export default [
  {
    name: 'song',
    aliases: ['play'],
    category: 'music',
    description: 'Search a song and get its details',
    usage: '.song <query>',
    async execute(ctx) {
      if (!ctx.text) return void (await ctx.reply(`🎵 Usage: *${ctx.prefix}song <song name>*`));

      const result = await yts(ctx.text);
      const videos = result.videos?.slice(0, 4) ?? [];
      if (!videos.length) return void (await ctx.reply(`❌ No results found for "${ctx.text}".`));

      const [top, ...others] = videos;
      const caption = [
        `🎵 *${top.title}*`,
        '',
        `👤 *Channel:* ${top.author?.name ?? 'Unknown'}`,
        `⏱️ *Duration:* ${top.timestamp}`,
        `👁️ *Views:* ${top.views?.toLocaleString() ?? 'n/a'}`,
        `📅 *Uploaded:* ${top.ago ?? 'n/a'}`,
        `🔗 ${top.url}`,
        others.length ? `\n🔎 *More results:*\n${others.map((v, i) => `${i + 1}. ${truncate(v.title, 60)} — ${v.url}`).join('\n')}` : '',
      ].join('\n');

      try {
        await ctx.sock.sendMessage(ctx.jid, { image: { url: top.thumbnail }, caption }, { quoted: ctx.msg });
      } catch {
        await ctx.reply(caption);
      }
    },
  },

  {
    name: 'lyrics',
    category: 'music',
    description: 'Fetch lyrics for a song',
    usage: '.lyrics <song name>',
    async execute(ctx) {
      if (!ctx.text) return void (await ctx.reply(`🎤 Usage: *${ctx.prefix}lyrics <song name>*`));

      const results = await fetchJson(`https://lrclib.net/api/search?q=${encodeURIComponent(ctx.text)}`);
      const hit = Array.isArray(results) ? results.find((r) => r.plainLyrics) : null;
      if (!hit) return void (await ctx.reply(`❌ No lyrics found for "${ctx.text}". Try "artist - title".`));

      const [first, ...rest] = chunkText(hit.plainLyrics.trim());
      await ctx.reply(`🎤 *${hit.trackName}* — ${hit.artistName}\n\n${first}`);
      for (const part of rest.slice(0, 2)) await ctx.sock.sendMessage(ctx.jid, { text: part });
      if (rest.length > 2) await ctx.sock.sendMessage(ctx.jid, { text: '…(lyrics truncated)' });
    },
  },
];
