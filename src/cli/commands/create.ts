import { Command } from 'commander';
import { readFileSync } from 'fs';
import { AnytypeClient } from '../../api/client.js';
import { config } from '../../config/index.js';
import { ConfigError, ValidationError, handleError } from '../../utils/errors.js';
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
 * Create the `create` command
 */
export function createCreateCommand(): Command {
  const command = new Command('create')
    .arguments('<type> [name]')
    .description('Create a new object')
    .option('--body <md>', 'Markdown body content (use "-" to read from stdin)')
    .option('--body-file <path>', 'Read body from file')
    .option(
      '--property <key=value>',
      'Set property (repeatable, use key:type=value for explicit type)',
      collectProperty,
      [],
    )
    .option('--template [id_or_name]', 'Use a template (omit value for default)')
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
  template?: boolean | string;
  property: ParsedProperty[];
  linkTo?: string;
  dryRun?: boolean;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Create a new object
 */
async function createAction(
  typeInput: string,
  name: string | undefined,
  options: CreateOptions,
): Promise<void> {
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

  const client = new AnytypeClient(config.getBaseURL(), apiKey);

  // Look up the type schema so we can serialize properties with the correct format,
  // resolve tag names for select/multi_select properties, and resolve templates
  let propertySchema: Map<string, string> | undefined;
  let typeProperties: import('../../api/types.js').TypeProperty[] | undefined;
  let typeDef: import('../../api/types.js').ObjectType | undefined;
  if (options.property.length > 0 || options.template) {
    try {
      typeDef = await client.resolveType(spaceId, typeKey);
      if (typeDef.properties) {
        typeProperties = typeDef.properties;
        propertySchema = new Map(typeDef.properties.map((p) => [p.key, p.format]));
      }
    } catch {
      // If we can't fetch the type schema, fall back to auto-detection
    }
  }

  // Resolve template if requested
  let templateId: string | undefined;
  if (options.template) {
    if (!typeDef) {
      throw new ValidationError(`Could not resolve type "${typeInput}" to look up templates.`);
    }
    const templates = await client.getTemplates(spaceId, typeDef.id);
    if (templates.length === 0) {
      throw new ValidationError(`No templates available for type "${typeDef.name}".`);
    }
    if (options.template === true) {
      // Bare --template flag: use the first (default) template
      templateId = templates[0].id;
    } else {
      // Match by ID first, then by name (case-insensitive)
      const value = options.template;
      const match =
        templates.find((t) => t.id === value) ||
        templates.find((t) => t.name.toLowerCase() === value.toLowerCase());
      if (!match) {
        const available = templates.map((t) => `"${t.name}" (${t.id})`).join(', ');
        throw new ValidationError(`Template "${value}" not found. Available: ${available}`);
      }
      templateId = match.id;
    }
  }

  // Build properties array for API
  let properties = toPropertyPayloads(options.property, propertySchema);

  // Resolve tag names to IDs for select/multi_select properties
  if (typeProperties) {
    properties = await resolveTagProperties(properties, typeProperties, client, spaceId);
  }

  // Build data object
  const data = {
    name: name || `New ${typeInput}`,
    type_key: typeKey,
    body,
    template_id: templateId,
    properties: properties.length > 0 ? properties : undefined,
  };

  // Dry run - just show what would be created
  if (options.dryRun) {
    console.log('Would create object with:');
    console.log(JSON.stringify(data, null, 2));
    return;
  }
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
