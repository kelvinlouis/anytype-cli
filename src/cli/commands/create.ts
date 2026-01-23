import { Command } from 'commander';
import { readFileSync } from 'fs';
import { AnytypeClient } from '../../api/client.js';
import { config } from '../../config/index.js';
import { ConfigError, ValidationError, handleError } from '../../utils/errors.js';
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
 * Create the `create` command
 */
export function createCreateCommand(): Command {
  const command = new Command('create')
    .arguments('<type> [name]')
    .description('Create a new object')
    .option('--body <md>', 'Markdown body content (use "-" to read from stdin)')
    .option('--body-file <path>', 'Read body from file')
    .option('--property <key=value>', 'Set object property (repeatable)', collect, [])
    .option('--link-to <id>', 'Link to another object by ID')
    .option('--dry-run', 'Preview without creating')
    .option('--json', 'Output as JSON instead of markdown')
    .option('--verbose', 'Show detailed output')
    .action(async (type: string, name: string | undefined, options) => {
      try {
        await createAction(type, name, options);
      } catch (error) {
        handleError(error, options.verbose);
      }
    });

  return command;
}

interface CreateOptions {
  body?: string;
  bodyFile?: string;
  property: Array<{ key: string; value: string }>;
  linkTo?: string;
  dryRun?: boolean;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Collect repeating options
 */
function collect(value: string, previous: Array<{ key: string; value: string }>) {
  const [key, val] = value.split('=');
  if (!key || !val) {
    throw new ValidationError('Properties must be in format key=value');
  }
  return previous.concat({ key, value: val });
}

/**
 * Create a new object
 */
async function createAction(
  typeInput: string,
  name: string | undefined,
  options: CreateOptions
): Promise<void> {
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

  // Get body
  let body = options.body;
  if (options.bodyFile) {
    body = readFileSync(options.bodyFile, 'utf-8');
  } else if (body === '-') {
    // Read from stdin
    body = await readStdinIfAvailable();
  } else if (!body && !options.bodyFile) {
    // Check for piped stdin if no body provided
    const stdinData = await readStdinIfAvailable();
    if (stdinData) {
      body = stdinData;
    }
  }

  // Build properties object
  const properties: Record<string, string> = {};
  for (const prop of options.property) {
    properties[prop.key] = prop.value;
  }

  // Build data object
  const data = {
    name: name || `New ${typeInput}`,
    type_key: typeKey,
    body,
    properties: Object.keys(properties).length > 0 ? properties : undefined,
  };

  // Dry run - just show what would be created
  if (options.dryRun) {
    console.log('Would create object with:');
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Create object
  const client = new AnytypeClient(config.getBaseURL(), apiKey);
  const createdObject = await client.createObject(spaceId, data);

  // Handle link-to option
  if (options.linkTo) {
    // This would require updating the object with relation info
    // For now, just note it was created
    console.log(`Created object: ${createdObject.id}`);
    console.log(`To link to ${options.linkTo}, use:`);
    console.log(`  anytype update ${createdObject.id} --link-to ${options.linkTo}`);
  } else {
    // Output result
    if (options.json) {
      console.log(formatAsJson(createdObject));
    } else {
      console.log(`✓ Created object: ${createdObject.id}`);
      console.log(`  Name: ${createdObject.name}`);
      console.log(`  Type: ${createdObject.type_key}`);
    }
  }
}
