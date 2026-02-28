import { Command } from 'commander';
import { AnytypeClient } from '../../api/client.js';
import { config } from '../../config/index.js';
import { ConfigError, handleError } from '../../utils/errors.js';
import { formatAsJson, formatTypesAsMarkdown, formatTypeDetailAsMarkdown } from '../output.js';

/**
 * Create the `types` command
 */
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

interface TypesOptions {
  json?: boolean;
  verbose?: boolean;
}

/**
 * List all types in the space
 */
async function typesAction(options: TypesOptions): Promise<void> {
  // Get API key
  const apiKey = config.getApiKey();
  if (!apiKey) {
    throw new ConfigError('API key not configured. Run `anytype init` first.');
  }

  // Get default space
  const spaceId = config.getDefaultSpace();
  if (!spaceId) {
    throw new ConfigError('No default space configured. Run `anytype init` first.');
  }

  // Fetch types
  const client = new AnytypeClient(config.getBaseURL(), apiKey);
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
  const apiKey = config.getApiKey();
  if (!apiKey) {
    throw new ConfigError('API key not configured. Run `anytype init` first.');
  }

  const spaceId = config.getDefaultSpace();
  if (!spaceId) {
    throw new ConfigError('No default space configured. Run `anytype init` first.');
  }

  const client = new AnytypeClient(config.getBaseURL(), apiKey);

  // Resolve alias (e.g., "1on1" -> "ot-meetingNote")
  const typeKey = config.resolveAlias(typeArg);

  const type = await client.resolveType(spaceId, typeKey);

  if (options.json) {
    console.log(formatAsJson(type));
  } else {
    console.log(formatTypeDetailAsMarkdown(type));
  }
}
