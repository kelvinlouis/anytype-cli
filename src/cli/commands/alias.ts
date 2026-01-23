import { Command } from 'commander';
import { config } from '../../config/index.js';
import { handleError } from '../../utils/errors.js';

/**
 * Create the `alias` command group
 */
export function createAliasCommand(): Command {
  const command = new Command('alias')
    .description('Manage type aliases');

  // Subcommands
  command
    .command('list')
    .description('List all configured aliases')
    .action(() => {
      listAliases();
    });

  command
    .command('set <alias> <type_key>')
    .description('Create or update an alias')
    .action((alias: string, typeKey: string) => {
      try {
        setAlias(alias, typeKey);
      } catch (error) {
        handleError(error, false);
      }
    });

  command
    .command('remove <alias>')
    .description('Remove an alias')
    .action((alias: string) => {
      try {
        removeAlias(alias);
      } catch (error) {
        handleError(error, false);
      }
    });

  return command;
}

/**
 * List all aliases
 */
function listAliases(): void {
  const aliases = config.getAliases();

  if (Object.keys(aliases).length === 0) {
    console.log('No aliases configured.');
    return;
  }

  console.log('Configured aliases:\n');
  const maxLen = Math.max(...Object.keys(aliases).map((k) => k.length));

  for (const [alias, typeKey] of Object.entries(aliases)) {
    console.log(`  ${alias.padEnd(maxLen)}  →  ${typeKey}`);
  }
}

/**
 * Set an alias
 */
function setAlias(alias: string, typeKey: string): void {
  config.addAlias(alias, typeKey);
  console.log(`✓ Alias set: ${alias} → ${typeKey}`);
}

/**
 * Remove an alias
 */
function removeAlias(alias: string): void {
  config.removeAlias(alias);
  console.log(`✓ Alias removed: ${alias}`);
}
