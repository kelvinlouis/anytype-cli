import { Command } from 'commander';
import { config } from '../../config/index.js';
import { NAME_LOOKUP_LIMIT } from '../../constants.js';
import { NotFoundError, handleError } from '../../utils/errors.js';
import { formatAsJson, formatObjectAsText } from '../output.js';
import { createAuthenticatedClient, resolveObjectNames } from './shared.js';

interface GetOptions {
  json?: boolean;
  verbose?: boolean;
}

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

async function getAction(
  typeInput: string,
  identifier: string,
  options: GetOptions,
): Promise<void> {
  const { client, spaceId } = createAuthenticatedClient();

  // Resolve type alias
  const typeKey = config.resolveAlias(typeInput);

  // Try to fetch by ID first (with markdown format to include body)
  let object;
  try {
    object = await client.getObject(spaceId, identifier, { format: 'markdown' });
  } catch {
    // If not found by ID, try to find by name
    const objects = await client.getObjects(spaceId, {
      type_key: typeKey,
      limit: NAME_LOOKUP_LIMIT,
    });

    const found = objects.find((obj) => obj.name === identifier);
    if (!found) {
      throw new NotFoundError(`Object "${identifier}" not found (type: ${typeInput})`);
    }

    // Re-fetch with body content
    object = await client.getObject(spaceId, found.id, { format: 'markdown' });
  }

  // Resolve object names for object-type properties (e.g., team_member_rel → actual name)
  let objectNames = new Map<string, string>();
  if (!options.json && object.properties) {
    const objectIds = new Set<string>();
    for (const prop of object.properties) {
      if (prop.format === 'objects' && prop.objects?.length) {
        for (const id of prop.objects) {
          objectIds.add(id);
        }
      }
    }
    objectNames = await resolveObjectNames(client, spaceId, objectIds);
  }

  // Output results
  if (options.json) {
    console.log(formatAsJson(object));
  } else {
    console.log(formatObjectAsText(object, objectNames));
  }
}
