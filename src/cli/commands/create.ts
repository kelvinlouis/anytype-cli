import { Command } from 'commander';
import { readFileSync } from 'fs';
import { config } from '../../config/index.js';
import { ValidationError, handleError } from '../../utils/errors.js';
import { resolveLinkProperty } from '../../utils/links.js';
import {
  collectProperty,
  toPropertyPayloads,
  resolveTagProperties,
} from '../../utils/properties.js';
import type { ParsedProperty } from '../../utils/properties.types.js';
import { readStdinIfAvailable } from '../../utils/stdin.js';
import { formatAsJson } from '../output.js';
import { createAuthenticatedClient } from './shared.js';

interface CreateOptions {
  body?: string;
  bodyFile?: string;
  template?: boolean | string;
  property: ParsedProperty[];
  linkTo?: string;
  linkProperty?: string;
  dryRun?: boolean;
  json?: boolean;
  verbose?: boolean;
}

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
    .option(
      '--link-property <key>',
      'Property key for linking (required when type has multiple object properties)',
    )
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

async function createAction(
  typeInput: string,
  name: string | undefined,
  options: CreateOptions,
): Promise<void> {
  const { client, spaceId } = createAuthenticatedClient();

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

  // Look up the type schema so we can serialize properties with the correct format,
  // resolve tag names for select/multi_select properties, and resolve templates
  let propertySchema: Map<string, string> | undefined;
  let typeProperties: import('../../api/types.js').TypeProperty[] | undefined;
  let typeDef: import('../../api/types.js').ObjectType | undefined;
  if (options.property.length > 0 || options.template || options.linkTo) {
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

  // Link to another object after creation
  if (options.linkTo) {
    if (!typeDef?.properties) {
      throw new ValidationError(
        `Could not resolve type "${typeInput}" to determine link property.`,
      );
    }
    const linkProp = resolveLinkProperty(typeDef.properties, options.linkProperty);
    await client.updateObject(spaceId, createdObject.id, {
      properties: [{ key: linkProp.key, format: 'objects', objects: [options.linkTo] }],
    });
  }

  // Output result
  if (options.json) {
    console.log(formatAsJson(createdObject));
  } else {
    console.log(`✓ Created object: ${createdObject.id}`);
    console.log(`  Name: ${createdObject.name}`);
    console.log(`  Type: ${createdObject.type_key}`);
    if (options.linkTo) {
      console.log(`  Linked to: ${options.linkTo}`);
    }
  }
}
