import fs from 'node:fs';
import path from 'node:path';
import { jidNormalizedUser } from '@whiskeysockets/baileys';
import config from '../config.js';

const PAIRED_OWNER_FILE = path.join(config.authDir, 'paired-owners.json');
const pairedOwners = new Set();

export const loadPairedOwners = () => {
  if (!fs.existsSync(PAIRED_OWNER_FILE)) return;

  try {
    const entries = JSON.parse(fs.readFileSync(PAIRED_OWNER_FILE, 'utf8'));
    if (!Array.isArray(entries)) return;

    for (const jid of entries) {
      if (typeof jid === 'string' && jid) pairedOwners.add(jidNormalizedUser(jid));
    }
  } catch {
    // Keep bot operation safe if the pairing file is missing or malformed.
  }
};

const savePairedOwners = () => {
  fs.mkdirSync(config.authDir, { recursive: true });
  fs.writeFileSync(PAIRED_OWNER_FILE, JSON.stringify([...pairedOwners], null, 2));
};

export const pairOwnerJid = (jid) => {
  const normalized = jidNormalizedUser(jid);
  pairedOwners.add(normalized);
  savePairedOwners();
  return normalized;
};

export const unpairOwnerJid = (jid) => {
  const normalized = jidNormalizedUser(jid);
  const removed = pairedOwners.delete(normalized);
  if (removed) savePairedOwners();
  return removed;
};

export const isPairedOwnerJid = (jid) => pairedOwners.has(jidNormalizedUser(jid));

loadPairedOwners();
