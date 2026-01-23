import { Command } from 'commander';
import { AnytypeClient } from '../../api/client.js';
import { config } from '../../config/index.js';
import { ConfigError, NotFoundError, handleError } from '../../utils/errors.js';
import { formatAsJson, formatObjectAsText } from '../output.js';

/**
 * Create the `get` command
 */
export function createGetCommand(): Command {
  const command = new Command('get')
    .arguments('<type> <identifier>')
    .description('Get full details of a single object by ID or name')
    .option('--json', 'Output as JSON instead of markdown')
    .option('--verbose', 'Show detailed output')
    .action(async (type: string, identifier: string, options) => {
      try {
        await getAction(type, identifier, options);
      } catch (error) {
        handleError(error, options.verbose);
      }
    });

  return command;
}

interface GetOptions {
  json?: boolean;
  verbose?: boolean;
}

/**
 * Get a single object by ID or name
 */
async function getAction(typeInput: string, identifier: string, options: GetOptions): Promise<void> {
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

  // Resolve type alias
  const typeKey = config.resolveAlias(typeInput);

  // Fetch object
  const client = new AnytypeClient(config.getBaseURL(), apiKey);

  // Try to fetch by ID first
  let object;
  try {
    object = await client.getObject(spaceId, identifier);
  } catch {
    // If not found by ID, try to find by name
    const objects = await client.getObjects(spaceId, {
      type_key: typeKey,
      limit: 100,
    });

    object = objects.find((obj) => obj.name === identifier);
    if (!object) {
      throw new NotFoundError(
        `Object "${identifier}" not found (type: ${typeInput})`
      );
    }
  }

  // Output results
  if (options.json) {
    console.log(formatAsJson(object));
  } else {
    console.log(formatObjectAsText(object));
  }
}
