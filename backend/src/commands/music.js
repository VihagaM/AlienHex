import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import yts from 'yt-search';
import youtubedl from 'youtube-dl-exec';
import { chunkText, fetchJson, truncate } from '../utils/helpers.js';

const MAX_AUDIO_BYTES = 16 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 15 * 60;

function isYouTubeUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (hostname === 'youtu.be' ||
        hostname === 'youtube.com' ||
        hostname.endsWith('.youtube.com') ||
        hostname === 'youtube-nocookie.com' ||
        hostname.endsWith('.youtube-nocookie.com'))
    );
  } catch {
    return false;
  }
}

export default [
  {
    name: 'yttomp3',
    category: 'music',
    description: 'Convert a YouTube video to MP3 audio',
    usage: '.yttomp3 <YouTube URL>',
    async execute(ctx) {
      if (!ctx.text || !isYouTubeUrl(ctx.text)) {
        return void (await ctx.reply(`🎵 Usage: *${ctx.prefix}yttomp3 <YouTube URL>*`));
      }

      if (!ffmpegPath) throw new Error('FFmpeg is not available on this platform.');

      await ctx.reply('⏳ Downloading and converting to MP3. This may take a little while.');

      const workDir = await mkdtemp(path.join(os.tmpdir(), 'wa-yttomp3-'));
      try {
        await youtubedl.exec(
          ctx.text,
          {
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: 0,
            ffmpegLocation: ffmpegPath,
            maxFilesize: '16M',
            matchFilter: `duration <= ${MAX_VIDEO_SECONDS}`,
            noPlaylist: true,
            noProgress: true,
            output: path.join(workDir, '%(id)s.%(ext)s'),
            quiet: true,
          },
          { timeout: 180000, killSignal: 'SIGKILL' },
        );

        const mp3Name = (await readdir(workDir)).find((name) => name.endsWith('.mp3'));
        if (!mp3Name) {
          return void (await ctx.reply('❌ No MP3 was produced. Check that the video is public and no longer than 15 minutes.'));
        }

        const mp3Path = path.join(workDir, mp3Name);
        if ((await stat(mp3Path)).size > MAX_AUDIO_BYTES) {
          return void (await ctx.reply('❌ The MP3 is larger than WhatsApp’s 16 MB audio limit.'));
        }

        await ctx.sock.sendMessage(
          ctx.jid,
          { audio: await readFile(mp3Path), mimetype: 'audio/mpeg', ptt: false },
          { quoted: ctx.msg },
        );
      } finally {
        await rm(workDir, { recursive: true, force: true });
      }
    },
  },

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
