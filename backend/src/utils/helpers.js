import { getContentType } from '@whiskeysockets/baileys';

export const formatDuration = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  parts.push(`${h}h`, `${m}m`, `${s}s`);
  return parts.join(' ');
};

/** "94771234567:12@s.whatsapp.net" -> "94771234567" */
export const jidToNumber = (jid = '') => String(jid).split('@')[0].split(':')[0];

export const numberToJid = (number) => `${String(number).replace(/\D/g, '')}@s.whatsapp.net`;

export const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];

export async function fetchJson(url, { timeout = 10000, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'wa-bot-dashboard/1.0', Accept: 'application/json', ...headers },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Returns the contextInfo (mentions, quoted message, ...) of a normalized message content. */
export const getContextInfo = (content) => {
  const type = getContentType(content);
  return type ? content[type]?.contextInfo : undefined;
};

/** Works with both classic (id = phone JID) and LID-style participant objects. */
export const participantMatches = (participant, jid) => {
  const number = jidToNumber(jid);
  return [participant.id, participant.lid, participant.jid, participant.phoneNumber]
    .filter(Boolean)
    .some((candidate) => jidToNumber(candidate) === number);
};

export const isParticipantAdmin = (participants = [], jid) =>
  participants.some((p) => participantMatches(p, jid) && (p.admin === 'admin' || p.admin === 'superadmin'));

export const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export const chunkText = (text, size = 3500) => {
  const chunks = [];
  let rest = text;
  while (rest.length > size) {
    let cut = rest.lastIndexOf('\n', size);
    if (cut < size * 0.5) cut = size;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
};