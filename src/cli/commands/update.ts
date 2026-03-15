import { Command } from 'commander';
import { readFileSync } from 'fs';
import { NotFoundError, ValidationError, handleError } from '../../utils/errors.js';
import { resolveLinkProperty } from '../../utils/links.js';
import {
  collectProperty,
  toPropertyPayloads,
  resolvePropertyIds,
  resolveTagProperties,
} from '../../utils/properties.js';
import type { ParsedProperty } from '../../utils/properties.types.js';
import { readStdinIfAvailable } from '../../utils/stdin.js';
import { formatAsJson } from '../output.js';
import { createAuthenticatedClient } from './shared.js';

interface UpdateOptions {
  name?: string;
  body?: string;
  append?: string;
  bodyFile?: string;
  property: ParsedProperty[];
  linkTo?: string;
  linkProperty?: string;
  unlinkFrom?: string;
  dryRun?: boolean;
  json?: boolean;
  verbose?: boolean;
}

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
    .option(
      '--link-property <key>',
      'Property key for linking (required when type has multiple object properties)',
    )
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

async function updateAction(identifier: string, options: UpdateOptions): Promise<void> {
  const { client, spaceId } = createAuthenticatedClient();
  let object;
  try {
    object = await client.getObject(
      spaceId,
      identifier,
      options.append ? { format: 'markdown' } : undefined,
    );
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
    let existingBody = object.body || object.markdown || '';
    // The API's markdown response includes the description property as the first line.
    // Strip it so we only send back actual body content, otherwise the API re-parses
    // the description as body and existing body content gets lost.
    const descProp = object.properties?.find((p) => p.key === 'description');
    if (descProp?.text && existingBody.startsWith(descProp.text)) {
      existingBody = existingBody.slice(descProp.text.length).replace(/^\s*\n?/, '');
    }
    updateData.body = existingBody
      ? existingBody.trimEnd() + '\n' + options.append
      : options.append;
  } else if (options.bodyFile) {
    updateData.body = readFileSync(options.bodyFile, 'utf-8');
  }

  // Resolve type schema when needed for properties or linking
  let propertySchema: Map<string, string> | undefined;
  let typeProperties: import('../../api/types.js').TypeProperty[] | undefined;
  if (options.property.length > 0 || options.linkTo || options.unlinkFrom) {
    const typeKey = object.type?.key || object.type_key;
    if (typeKey) {
      try {
        const typeDef = await client.resolveType(spaceId, typeKey);
        if (typeDef.properties) {
          typeProperties = typeDef.properties;
          propertySchema = new Map(typeDef.properties.map((p) => [p.key, p.format]));
        }
      } catch {
        // Fall back to auto-detection for properties
      }
    }
  }

  // Build properties array for API, using the type schema for correct formats
  if (options.property.length > 0) {
    let properties = toPropertyPayloads(options.property, propertySchema);
    if (typeProperties) {
      properties = await resolveTagProperties(properties, typeProperties, client, spaceId);
      properties = resolvePropertyIds(properties, typeProperties);
    }
    updateData.properties = properties;
  }

  // Handle link/unlink via the type's settable object property
  if (options.linkTo || options.unlinkFrom) {
    if (!typeProperties) {
      throw new ValidationError('Could not resolve type to determine link property.');
    }
    const linkProp = resolveLinkProperty(typeProperties, options.linkProperty);

    const existingObjects = object.properties?.find((p) => p.key === linkProp.key)?.objects ?? [];
    let updatedObjects = [...existingObjects];

    if (options.linkTo && !updatedObjects.includes(options.linkTo)) {
      updatedObjects.push(options.linkTo);
    }
    if (options.unlinkFrom) {
      updatedObjects = updatedObjects.filter((id) => id !== options.unlinkFrom);
    }

    const linkPayload = { key: linkProp.key, format: 'objects', objects: updatedObjects };
    const existing = (updateData.properties as Array<Record<string, unknown>>) ?? [];
    updateData.properties = [...existing, linkPayload];
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
      if (options.linkTo) console.log(`  Linked to: ${options.linkTo}`);
      if (options.unlinkFrom) console.log(`  Unlinked from: ${options.unlinkFrom}`);
    }
  } else {
    console.log(`No changes to apply`);
  }
}
