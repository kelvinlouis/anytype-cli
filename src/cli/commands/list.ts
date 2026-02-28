import { Command } from 'commander';
import { AnytypeClient } from '../../api/client.js';
import { config } from '../../config/index.js';
import { ConfigError, ValidationError, handleError } from '../../utils/errors.js';
import { parseDateFilter } from '../../utils/date.js';
import {
  formatAsJson,
  formatObjectsAsMarkdown,
  resolveFieldValue,
  resolveRawFieldValue,
} from '../output.js';

/**
 * Create the `list` command
 */
export function createListCommand(): Command {
  const command = new Command('list')
    .arguments('<type>')
    .description('List objects of a given type')
    .option('--linked-to <name>', 'Filter by linked object name')
    .option('--since <date>', 'Filter by date (ISO, "today", or relative: 7d, 2w, 1m)')
    .option('--limit <n>', 'Limit number of results', '100')
    .option(
      '--fields <list>',
      'Select specific fields (comma-separated, includes link_count, backlink_count)',
    )
    .option('--orphan', 'Show only orphan objects (no links)')
    .option('--sort <field:order>', 'Sort by field (e.g. published_at:desc)')
    .option('--where <condition>', 'Filter by field value (repeatable, e.g. "tag=AI")', collect, [])
    .option('--json', 'Output as JSON instead of markdown')
    .option('--verbose', 'Show detailed output')
    .action(async (type: string, options) => {
      try {
        await listAction(type, options);
      } catch (error) {
        handleError(error, options.verbose);
      }
    });

  return command;
}

/**
 * Collect repeatable option values into an array.
 */
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

interface ListOptions {
  linkedTo?: string;
  since?: string;
  limit?: string;
  fields?: string;
  orphan?: boolean;
  sort?: string;
  where?: string[];
  json?: boolean;
  verbose?: boolean;
}

/**
 * List objects of a given type
 */
async function listAction(typeInput: string, options: ListOptions): Promise<void> {
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

  // Fetch objects
  const client = new AnytypeClient(config.getBaseURL(), apiKey);
  const limit = Math.min(parseInt(options.limit || '100', 10), 1000);

  let objects = await client.getObjects(spaceId, {
    type_key: typeKey,
    limit,
  });

  // Apply filters
  if (options.since) {
    const sinceDate = parseDateFilter(options.since);
    const dateFields = ['updated_at', 'updated_date', 'created_at', 'created_date'];
    objects = objects.filter((obj) => {
      for (const field of dateFields) {
        const val = resolveRawFieldValue(obj, field);
        if (val instanceof Date) {
          return val >= sinceDate;
        }
      }
      return false;
    });
  }

  if (options.linkedTo) {
    // Find the target object by name
    const searchResults = await client.search(options.linkedTo, { limit: 10 });

    // Find exact or best match
    const targetResult =
      searchResults.find((r) => r.name.toLowerCase() === options.linkedTo!.toLowerCase()) ||
      searchResults[0];

    if (!targetResult) {
      throw new ValidationError(`No object found matching "${options.linkedTo}"`);
    }

    const targetId = targetResult.id;

    // Get IDs from backlinks on the target object (objects that link TO the target)
    const targetBacklinks = new Set<string>();
    const backlinksProperty = targetResult.properties?.find(
      (p: { key: string }) => p.key === 'backlinks',
    );
    if (backlinksProperty?.objects) {
      for (const id of backlinksProperty.objects) {
        targetBacklinks.add(id);
      }
    }

    // Also search for objects that mention the target name in their content
    const mentionResults = await client.searchInSpace(spaceId, options.linkedTo, {
      type_key: typeKey,
      limit,
    });
    const mentionIds = new Set(mentionResults.map((r) => r.id));

    // Filter objects that are linked to/from the target OR mention the target name
    objects = objects.filter((obj) => {
      // Check if this object mentions the target name in content
      if (mentionIds.has(obj.id)) {
        return true;
      }

      // Check if this object is in the target's backlinks
      // (meaning this object links TO the target)
      if (targetBacklinks.has(obj.id)) {
        return true;
      }

      // Check if this object has a 'links' property that includes the target
      const linksProperty = obj.properties?.find((p: { key: string }) => p.key === 'links');
      if (linksProperty?.objects?.includes(targetId)) {
        return true;
      }

      return false;
    });

    if (options.verbose) {
      console.error(`[DEBUG] Objects after filter: ${objects.length}`);
    }
  }

  if (options.orphan) {
    // Filter for orphan objects (no links and no backlinks)
    objects = objects.filter((obj) => {
      const linksProperty = obj.properties?.find((p: { key: string }) => p.key === 'links');
      const backlinksProperty = obj.properties?.find((p: { key: string }) => p.key === 'backlinks');
      const hasLinks = (linksProperty?.objects?.length || 0) > 0;
      const hasBacklinks = (backlinksProperty?.objects?.length || 0) > 0;
      return !hasLinks && !hasBacklinks;
    });
  }

  // Apply --where filters
  if (options.where && options.where.length > 0) {
    // Resolve object names for --where fields that reference objects-format properties
    // (e.g., team_member_rel=Sacha needs to resolve the object ID to "Sacha")
    const whereObjectNames = new Map<string, string>();
    const whereFields = new Set<string>();
    for (const condition of options.where) {
      const match = condition.match(/^(.+?)(?:!=|=)/);
      if (match) whereFields.add(match[1].toLowerCase());
    }

    if (whereFields.size > 0) {
      const objectIds = new Set<string>();
      for (const obj of objects) {
        if (!obj.properties) continue;
        for (const prop of obj.properties) {
          if (prop.format !== 'objects' || !prop.objects?.length) continue;
          const matchesField =
            whereFields.has(prop.key?.toLowerCase() ?? '') ||
            whereFields.has(prop.name?.toLowerCase() ?? '');
          if (matchesField) {
            for (const id of prop.objects) {
              objectIds.add(id);
            }
          }
        }
      }

      if (objectIds.size > 0) {
        await Promise.all(
          [...objectIds].map(async (id) => {
            try {
              const resolved = await client.getObject(spaceId, id);
              whereObjectNames.set(id, resolved.name);
            } catch {
              // Keep ID as fallback if object can't be resolved
            }
          }),
        );
      }
    }

    for (const condition of options.where) {
      const notEmpty = condition.match(/^(.+)!=$/);
      const empty = condition.match(/^(.+)=$/);
      const equals = condition.match(/^(.+?)=(.+)$/);

      if (notEmpty) {
        const field = notEmpty[1];
        objects = objects.filter((obj) => resolveFieldValue(obj, field, whereObjectNames) !== '-');
      } else if (empty) {
        const field = empty[1];
        objects = objects.filter((obj) => resolveFieldValue(obj, field, whereObjectNames) === '-');
      } else if (equals) {
        const field = equals[1];
        const value = equals[2].toLowerCase();
        objects = objects.filter((obj) => {
          const resolved = resolveFieldValue(obj, field, whereObjectNames).toLowerCase();
          return resolved !== '-' && resolved.includes(value);
        });
      } else {
        throw new ValidationError(
          `Invalid --where condition: "${condition}". Use field=value, field=, or field!=`,
        );
      }
    }
  }

  // Apply --sort
  if (options.sort) {
    const parts = options.sort.split(':');
    const sortField = parts[0];
    const sortOrder = parts[1]?.toLowerCase() === 'desc' ? -1 : 1;

    objects.sort((a, b) => {
      const aVal = resolveRawFieldValue(a, sortField);
      const bVal = resolveRawFieldValue(b, sortField);

      // Nulls always sort last
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      let cmp: number;
      if (aVal instanceof Date && bVal instanceof Date) {
        cmp = aVal.getTime() - bVal.getTime();
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }

      return cmp * sortOrder;
    });
  }

  // Parse fields: --fields flag > type config > global defaults
  const fields = options.fields
    ? options.fields.split(',').map((f) => f.trim())
    : config.getTypeFields(typeKey);

  // Resolve object names for display (e.g., team_member → actual name)
  const objectNames = new Map<string, string>();
  if (!options.json) {
    const displayFields = fields || ['name', 'id', 'created_at', 'updated_at'];
    const objectIds = new Set<string>();

    for (const obj of objects) {
      if (!obj.properties) continue;
      for (const prop of obj.properties) {
        if (prop.format !== 'objects' || !prop.objects?.length) continue;
        const matchesField = displayFields.some(
          (f) =>
            f.toLowerCase() === prop.key?.toLowerCase() ||
            f.toLowerCase() === prop.name?.toLowerCase(),
        );
        if (matchesField) {
          for (const id of prop.objects) {
            objectIds.add(id);
          }
        }
      }
    }

    if (objectIds.size > 0) {
      await Promise.all(
        [...objectIds].map(async (id) => {
          try {
            const resolved = await client.getObject(spaceId, id);
            objectNames.set(id, resolved.name);
          } catch {
            // Keep ID as fallback if object can't be resolved
          }
        }),
      );
    }
  }

  // Output results
  if (options.json) {
    console.log(formatAsJson(objects));
  } else {
    console.log(formatObjectsAsMarkdown(objects, fields, objectNames));
  }
}
