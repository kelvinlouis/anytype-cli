import { Command } from 'commander';
import { AnytypeClient } from '../../api/client.js';
import { config } from '../../config/index.js';
import { ConfigError, handleError } from '../../utils/errors.js';
import { formatAsJson, formatTypesAsMarkdown } from '../output.js';

/**
 * Create the `types` command
 */
export function createTypesCommand(): Command {
  const command = new Command('types')
    .description('List all object types in the default space')
    .option('--json', 'Output as JSON instead of markdown')
    .action(async (options) => {
      try {
        await typesAction(options);
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
    throw new ConfigError(
      'API key not configured. Run `anytype init` first.'
    );
  }

  // Get default space
  const spaceId = config.getDefaultSpace();
  if (!spaceId) {
    throw new ConfigError(
      'No default space configured. Run `anytype init` first.'
    );
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
