import general from './general.js';
import music from './music.js';
import group from './group.js';
import utility from './utility.js';

/**
 * Each command looks like:
 * {
 *   name, aliases?, category, description, usage,
 *   groupOnly?, adminOnly?, botAdminRequired?, ownerOnly?,
 *   execute(ctx)
 * }
 */
export const commands = [...general, ...music, ...group, ...utility];

const registry = new Map();
for (const command of commands) {
  registry.set(command.name, command);
  for (const alias of command.aliases ?? []) registry.set(alias, command);
}

export default registry;
