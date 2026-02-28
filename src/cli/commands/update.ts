import { Command } from 'commander';
import { readFileSync } from 'fs';
import { AnytypeClient } from '../../api/client.js';
import { config } from '../../config/index.js';
import { ConfigError, NotFoundError, handleError } from '../../utils/errors.js';
import {
  collectProperty,
  toPropertyPayloads,
  resolveTagProperties,
  type ParsedProperty,
} from '../../utils/properties.js';
import { formatAsJson } from '../output.js';

/**
 * Read from stdin if available
 */
async function readStdinIfAvailable(): Promise<string> {
  return new Promise((resolve) => {
    // If stdin is a TTY (terminal), there's no piped data
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }

    let data = '';
    process.stdin.setEncoding('utf-8');

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      resolve(data);
    });

    process.stdin.on('error', () => {
      resolve('');
    });
  });
}

/**
 * Create the `update` command
 */
export function createUpdateCommand(): Command {
  const command = new Command('update')
    .arguments('<identifier>')
    .description('Update an existing object')
    .option('--name <name>', 'Rename object')
    .option('--body <md>', 'Replace body content (use "-" to read from stdin)')
    .option('--append <md>', 'Append to body content')
    .option('--body-file <path>', 'Read body from file')
    .option(
      '--property <key=value>',
      'Update property (repeatable, use key:type=value for explicit type)',
      collectProperty,
      [],
    )
    .option('--link-to <id>', 'Link to another object by ID')
    .option('--unlink-from <id>', 'Remove link to object')
    .option('--dry-run', 'Preview without updating')
    .option('--json', 'Output as JSON instead of markdown')
    .option('--verbose', 'Show detailed output')
    .action(async (identifier: string, options) => {
      try {
        await updateAction(identifier, options);
      } catch (error) {
        handleError(error, options.verbose);
      }
    });

  return command;
}

interface UpdateOptions {
  name?: string;
  body?: string;
  append?: string;
  bodyFile?: string;
  property: ParsedProperty[];
  linkTo?: string;
  unlinkFrom?: string;
  dryRun?: boolean;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Update an object
 */
async function updateAction(identifier: string, options: UpdateOptions): Promise<void> {
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

  // Fetch object to get current state
  const client = new AnytypeClient(config.getBaseURL(), apiKey);
  let object;
  try {
    object = await client.getObject(spaceId, identifier);
  } catch {
    throw new NotFoundError(`Object "${identifier}" not found`);
  }

  // Build update data
  const updateData: Record<string, unknown> = {};

  if (options.name) {
    updateData.name = options.name;
  }

  // Handle body: check for stdin first, then file, then direct value
  if (options.body) {
    if (options.body === '-') {
      // Read from stdin
      updateData.body = await readStdinIfAvailable();
    } else {
      updateData.body = options.body;
    }
  } else if (options.append) {
    updateData.body = (object.body || '') + '\n' + options.append;
  } else if (options.bodyFile) {
    updateData.body = readFileSync(options.bodyFile, 'utf-8');
  }

  // Build properties array for API, using the type schema for correct formats
  if (options.property.length > 0) {
    let propertySchema: Map<string, string> | undefined;
    let typeProperties: import('../../api/types.js').TypeProperty[] | undefined;
    const typeKey = object.type?.key || object.type_key;
    if (typeKey) {
      try {
        const typeDef = await client.resolveType(spaceId, typeKey);
        if (typeDef.properties) {
          typeProperties = typeDef.properties;
          propertySchema = new Map(typeDef.properties.map((p) => [p.key, p.format]));
        }
      } catch {
        // Fall back to auto-detection
      }
    }
    let properties = toPropertyPayloads(options.property, propertySchema);
    if (typeProperties) {
      properties = await resolveTagProperties(properties, typeProperties, client, spaceId);
    }
    updateData.properties = properties;
  }

  // Dry run
  if (options.dryRun) {
    console.log('Would update object with:');
    console.log(JSON.stringify(updateData, null, 2));
    if (options.linkTo) {
      console.log(`\nWould also link to: ${options.linkTo}`);
    }
    if (options.unlinkFrom) {
      console.log(`\nWould also unlink from: ${options.unlinkFrom}`);
    }
    return;
  }

  // Update object
  if (Object.keys(updateData).length > 0) {
    const updated = await client.updateObject(
      spaceId,
      object.id,
      updateData as Parameters<typeof client.updateObject>[2],
    );

    if (options.json) {
      console.log(formatAsJson(updated));
    } else {
      console.log(`✓ Updated object: ${updated.id}`);
      if (options.name) console.log(`  Name: ${updated.name}`);
      if (options.body || options.append || options.bodyFile) console.log(`  Body updated`);
      if (options.property.length > 0) console.log(`  Properties updated`);
    }
  } else {
    console.log(`No changes to apply`);
  }
}
