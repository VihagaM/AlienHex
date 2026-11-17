// Keeps recently received statuses (status@broadcast) in memory so that
// .showstatus can find the real media when someone replies to a
// "This group was mentioned" message.

const TTL = 24 * 60 * 60 * 1000; // WhatsApp statuses expire after 24h
const MAX_ITEMS = 1000;

const statuses = new Map(); // status message id -> { msg, savedAt }

const prune = () => {
  const now = Date.now();

  for (const [id, entry] of statuses) {
    if (statuses.size > MAX_ITEMS || now - entry.savedAt > TTL) {
      statuses.delete(id);
    } else {
      break; // Map keeps insertion order, so the rest are newer
    }
  }
};

export const cacheStatusMessage = (msg) => {
  const id = msg?.key?.id;
  if (!id || !msg.message) return;

  statuses.set(id, { msg, savedAt: Date.now() });
  prune();
};

export const getCachedStatus = (id) => {
  const entry = statuses.get(id);
  if (!entry) return undefined;

  if (Date.now() - entry.savedAt > TTL) {
    statuses.delete(id);
    return undefined;
  }

  return entry;
};