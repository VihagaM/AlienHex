import { downloadContentFromMessage, getContentType, normalizeMessageContent } from '@whiskeysockets/baileys';
import { evaluateExpression } from '../utils/calculator.js';
import { fetchJson, getContextInfo, jidToNumber, numberToJid, pickRandom } from '../utils/helpers.js';
import { pairOwnerJid, unpairOwnerJid } from '../utils/pairedOwners.js';

/* WMO weather codes → [description, emoji] */
const WEATHER_CODES = {
  0: ['Clear sky', '☀️'], 1: ['Mainly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'], 48: ['Rime fog', '🌫️'],
  51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌧️'],
  56: ['Freezing drizzle', '🌧️'], 57: ['Freezing drizzle', '🌧️'],
  61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
  66: ['Freezing rain', '🌧️'], 67: ['Freezing rain', '🌧️'],
  71: ['Light snow', '🌨️'], 73: ['Snow', '❄️'], 75: ['Heavy snow', '❄️'], 77: ['Snow grains', '❄️'],
  80: ['Rain showers', '🌦️'], 81: ['Rain showers', '🌧️'], 82: ['Violent showers', '⛈️'],
  85: ['Snow showers', '🌨️'], 86: ['Heavy snow showers', '🌨️'],
  95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm with hail', '⛈️'], 99: ['Thunderstorm with hail', '⛈️'],
};

const FALLBACK_JOKES = [
  'Why do programmers prefer dark mode? Because light attracts bugs. 🐛',
  'There are 10 types of people: those who understand binary and those who don’t.',
  'I would tell you a UDP joke, but you might not get it.',
];
const FALLBACK_QUOTES = [
  ['The only way to do great work is to love what you do.', 'Steve Jobs'],
  ['It always seems impossible until it is done.', 'Nelson Mandela'],
  ['Well done is better than well said.', 'Benjamin Franklin'],
];

export default [
  {
    name: 'pair',
    category: 'utility',
    description: 'Grant bot owner access to another user',
    usage: '.pair @user',
    ownerOnly: true,
    async execute(ctx) {
      const content = normalizeMessageContent(ctx.msg?.message);
      const contextInfo = getContextInfo(content);
      let target = contextInfo?.mentionedJid?.[0];

      if (!target && contextInfo?.quotedMessage) {
        target = contextInfo.participant;
      }

      if (!target && ctx.args[0]) {
        const value = ctx.args[0].trim();
        if (/^\d{6,15}$/.test(value)) {
          target = numberToJid(value);
        } else if (/@(s\.whatsapp\.net|lid)$/i.test(value)) {
          target = value;
        }
      }

      if (!target) {
        await ctx.reply(`❌ Usage: *${ctx.prefix}pair @user*\nYou can also reply to the user or provide their phone number.`);
        return;
      }

      const pairedJid = pairOwnerJid(target);
      await ctx.reply(`✅ Owner access granted to @${jidToNumber(pairedJid)}.`, {
        mentions: [pairedJid],
      });
    },
  },
  {
    name: 'unpair',
    category: 'utility',
    description: 'Remove bot owner access from a paired user',
    usage: '.unpair @user',
    ownerOnly: true,
    async execute(ctx) {
      const content = normalizeMessageContent(ctx.msg?.message);
      const contextInfo = getContextInfo(content);
      let target = contextInfo?.mentionedJid?.[0] || (contextInfo?.quotedMessage ? contextInfo.participant : undefined);

      if (!target && ctx.args[0]) {
        const value = ctx.args[0].trim();
        if (/^\d{6,15}$/.test(value)) target = numberToJid(value);
        else if (/@(s\.whatsapp\.net|lid)$/i.test(value)) target = value;
      }

      if (!target) {
        await ctx.reply(`❌ Usage: *${ctx.prefix}unpair @user*\nYou can also reply to the user or provide their phone number.`);
        return;
      }

      const removed = unpairOwnerJid(target);
      await ctx.reply(
        removed
          ? `✅ Owner access removed from @${jidToNumber(target)}.`
          : `ℹ️ @${jidToNumber(target)} is not paired.`,
        { mentions: [target] },
      );
    },
  },
  {
    name: 'weather',
    category: 'utility',
    description: 'Current weather for a city',
    usage: '.weather <city>',
    async execute(ctx) {
      if (!ctx.text) return void (await ctx.reply(`🌍 Usage: *${ctx.prefix}weather <city>*`));

      const geo = await fetchJson(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ctx.text)}&count=1&language=en&format=json`,
      );
      const place = geo.results?.[0];
      if (!place) return void (await ctx.reply(`❌ Couldn't find a city named "${ctx.text}".`));

      const params = 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m';
      const data = await fetchJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=${params}&timezone=auto`,
      );
      const c = data.current;
      const [condition, emoji] = WEATHER_CODES[c.weather_code] ?? ['Unknown', '🌡️'];
      const where = [place.name, place.admin1, place.country].filter(Boolean).join(', ');

      await ctx.reply(
        [
          `${emoji} *Weather in ${where}*`,
          '',
          `🌡️ *Temperature:* ${c.temperature_2m}°C (feels like ${c.apparent_temperature}°C)`,
          `☁️ *Condition:* ${condition}`,
          `💧 *Humidity:* ${c.relative_humidity_2m}%`,
          `💨 *Wind:* ${c.wind_speed_10m} km/h`,
          `🌧️ *Precipitation:* ${c.precipitation} mm`,
        ].join('\n'),
      );
    },
  },

  {
    name: 'calc',
    aliases: ['calculate'],
    category: 'utility',
    description: 'Evaluate a math expression',
    usage: '.calc <expression>',
    async execute(ctx) {
      if (!ctx.text) return void (await ctx.reply(`🧮 Usage: *${ctx.prefix}calc 2*(3+4)^2*`));
      try {
        const result = evaluateExpression(ctx.text);
        await ctx.reply(`🧮 *Calculator*\n\n📝 ${ctx.text}\n✅ *= ${result}*`);
      } catch (err) {
        await ctx.reply(`❌ ${err.message}`);
      }
    },
  },

  {
    name: 'joke',
    category: 'utility',
    description: 'Send a random joke',
    usage: '.joke',
    async execute(ctx) {
      let joke;
      try {
        const data = await fetchJson(
          'https://v2.jokeapi.dev/joke/Any?safe-mode&blacklistFlags=nsfw,religious,political,racist,sexist,explicit',
        );
        joke = data.type === 'twopart' ? `${data.setup}\n\n👉 ${data.delivery}` : data.joke;
      } catch {
        joke = pickRandom(FALLBACK_JOKES);
      }
      await ctx.reply(`😂 *Joke*\n\n${joke}`);
    },
  },

  {
    name: 'quote',
    category: 'utility',
    description: 'Send an inspiring quote',
    usage: '.quote',
    async execute(ctx) {
      let text;
      let author;
      try {
        const data = await fetchJson('https://zenquotes.io/api/random');
        ({ q: text, a: author } = data[0]);
      } catch {
        [text, author] = pickRandom(FALLBACK_QUOTES);
      }
      await ctx.reply(`💬 *Quote of the moment*\n\n“${text}”\n\n— _${author}_`);
    },
  },

  {
    name: 'recover',
    aliases: ['deleted', 'antidelete'],
    category: 'utility',
    description: 'Recover the latest deleted message',
    usage: '.recover [message id]',
    ownerOnly: true,
    async execute(ctx) {
      const messageId = ctx.args[0];
      const deleted = ctx.service.getDeletedMessage(ctx.jid, messageId);

      if (!deleted) {
        await ctx.reply(
          messageId
            ? '❌ No cached deleted message found with that ID.'
            : '❌ No deleted message found in this chat. I can only recover messages received after the bot connected.'
        );
        return;
      }

      const content = normalizeMessageContent(deleted.msg.message);
      const type = getContentType(content);
      const text =
        content?.conversation ||
        content?.extendedTextMessage?.text ||
        content?.imageMessage?.caption ||
        content?.videoMessage?.caption ||
        content?.documentMessage?.caption ||
        '';
      const header = `♻️ *Recovered deleted message*\n🆔 ${deleted.msg.key.id}`;

      if (text) {
        await ctx.reply(`${header}\n\n${text}`);
        return;
      }

      const mediaType = {
        imageMessage: 'image',
        videoMessage: 'video',
        audioMessage: 'audio',
        documentMessage: 'document',
      }[type];

      if (!mediaType) {
        await ctx.reply('❌ This deleted message type cannot be recovered.');
        return;
      }

      try {
        const media = content[type];
        const stream = await downloadContentFromMessage(media, mediaType);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);

        if (mediaType === 'image') {
          await ctx.sock.sendMessage(ctx.jid, { image: buffer, caption: header }, { quoted: ctx.msg });
        } else if (mediaType === 'video') {
          await ctx.sock.sendMessage(ctx.jid, { video: buffer, caption: header }, { quoted: ctx.msg });
        } else if (mediaType === 'audio') {
          await ctx.sock.sendMessage(ctx.jid, {
            audio: buffer,
            mimetype: media.mimetype || 'audio/ogg; codecs=opus',
            ptt: Boolean(media.ptt),
          }, { quoted: ctx.msg });
        } else {
          await ctx.sock.sendMessage(ctx.jid, {
            document: buffer,
            mimetype: media.mimetype || 'application/octet-stream',
            fileName: media.fileName || 'recovered-file',
            caption: header,
          }, { quoted: ctx.msg });
        }
      } catch (err) {
        await ctx.reply(`❌ Couldn't download the deleted media: ${err.message}`);
      }
    },
  },

  {
    name: 'reveal',
    aliases: ['vv'],
    category: 'utility',
    description: 'Reveal a replied view-once media',
    usage: '.reveal',
    async execute(ctx) {
      const quoted = ctx.quotedInfo?.quotedMessage;
      if (!quoted) return void (await ctx.reply(`👁️ Reply to a view-once photo, video or voice note with *${ctx.prefix}reveal*.`));

      const inner = normalizeMessageContent(quoted);
      const type = getContentType(inner);
      const media = inner?.[type];
      const kind = { imageMessage: 'image', videoMessage: 'video', audioMessage: 'audio' }[type];

      if (!kind || !media?.mediaKey) {
        return void (await ctx.reply('❌ That message has no downloadable media (it may already have been opened or expired).'));
      }

      const stream = await downloadContentFromMessage(media, kind);
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);

      const caption = `👁️ Revealed by ${ctx.config.botName}${media.caption ? `\n\n${media.caption}` : ''}`;
      const payload =
        kind === 'image'
          ? { image: buffer, caption }
          : kind === 'video'
            ? { video: buffer, caption }
            : { audio: buffer, mimetype: media.mimetype || 'audio/ogg; codecs=opus', ptt: Boolean(media.ptt) };

      await ctx.sock.sendMessage(ctx.jid, payload, { quoted: ctx.msg });
    },
  },
];
