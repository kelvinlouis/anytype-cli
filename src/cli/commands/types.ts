import { Command } from 'commander';
import { config } from '../../config/index.js';
import { handleError } from '../../utils/errors.js';
import { formatAsJson, formatTypesAsMarkdown, formatTypeDetailAsMarkdown } from '../output.js';
import { createAuthenticatedClient } from './shared.js';

interface TypesOptions {
  json?: boolean;
  verbose?: boolean;
}

export function createTypesCommand(): Command {
  const command = new Command('types')
    .description('List all object types, or show detail for a specific type')
    .argument('[type]', 'Type key or alias to show details for')
    .option('--json', 'Output as JSON instead of markdown')
    .action(async (type, options) => {
      try {
        if (type) {
          await typeDetailAction(type, options);
        } else {
          await typesAction(options);
        }
      } catch (error) {
        handleError(error, options.verbose);
      }
    });

  return command;
}

async function typesAction(options: TypesOptions): Promise<void> {
  const { client, spaceId } = createAuthenticatedClient();
  const types = await client.getTypes(spaceId);

  // Output results
  if (options.json) {
    console.log(formatAsJson(types));
  } else {
    console.log(formatTypesAsMarkdown(types));
  }
}

/**
 * Show detail for a specific type including its properties
 */
async function typeDetailAction(typeArg: string, options: TypesOptions): Promise<void> {
  const { client, spaceId } = createAuthenticatedClient();

  // Resolve alias (e.g., "1on1" -> "ot-meetingNote")
  const typeKey = config.resolveAlias(typeArg);

  const type = await client.resolveType(spaceId, typeKey);

  if (options.json) {
    console.log(formatAsJson(type));
  } else {
    console.log(formatTypeDetailAsMarkdown(type));
  }
}
