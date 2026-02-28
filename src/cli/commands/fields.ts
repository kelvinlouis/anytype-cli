import { Command } from 'commander';
import { config } from '../../config/index.js';
import { handleError } from '../../utils/errors.js';

/**
 * Create the `fields` command group for managing default list fields per type
 */
export function createFieldsCommand(): Command {
  const command = new Command('fields').description('Manage default list fields per type');

  command
    .command('list')
    .description('List all configured type field defaults')
    .action(() => {
      listTypeFields();
    });

  command
    .command('set <type> <fields>')
    .description('Set default fields for a type (comma-separated). Accepts type key or alias.')
    .action((type: string, fieldsList: string) => {
      try {
        const typeKey = config.resolveAlias(type);
        const fields = fieldsList.split(',').map((f) => f.trim());
        config.setTypeFields(typeKey, fields);
        console.log(`✓ Default fields for "${type}" (${typeKey}): ${fields.join(', ')}`);
      } catch (error) {
        handleError(error, false);
      }
    });

  command
    .command('remove <type>')
    .description('Remove default fields for a type (reverts to global defaults)')
    .action((type: string) => {
      try {
        const typeKey = config.resolveAlias(type);
        config.removeTypeFields(typeKey);
        console.log(`✓ Removed default fields for "${type}" (${typeKey})`);
      } catch (error) {
        handleError(error, false);
      }
    });

  return command;
}

/**
 * List all type field configurations
 */
function listTypeFields(): void {
  const typeFields = config.getAllTypeFields();
  const aliases = config.getAliases();

  // Build reverse alias map for display
  const reverseAliases: Record<string, string[]> = {};
  for (const [alias, typeKey] of Object.entries(aliases)) {
    if (!reverseAliases[typeKey]) {
      reverseAliases[typeKey] = [];
    }
    reverseAliases[typeKey].push(alias);
  }

  if (Object.keys(typeFields).length === 0) {
    console.log('No type field defaults configured.');
    return;
  }

  console.log('Configured type field defaults:\n');

  for (const [typeKey, fields] of Object.entries(typeFields)) {
    const aliasNames = reverseAliases[typeKey];
    const label = aliasNames ? `${aliasNames.join(', ')} (${typeKey})` : typeKey;
    console.log(`  ${label}`);
    console.log(`    fields: ${fields.join(', ')}`);
  }
}
