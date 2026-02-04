import { Command } from 'commander';
import { AnytypeClient } from '../../api/client.js';
import { config } from '../../config/index.js';
import { ConfigError, ValidationError, handleError } from '../../utils/errors.js';
import { formatAsJson, formatObjectsAsMarkdown } from '../output.js';

/**
 * Create the `list` command
 */
export function createListCommand(): Command {
  const command = new Command('list')
    .arguments('<type>')
    .description('List objects of a given type')
    .option('--linked-to <name>', 'Filter by linked object name')
    .option('--since <date>', 'Filter by date (ISO format or "today")')
    .option('--limit <n>', 'Limit number of results', '100')
    .option('--fields <list>', 'Select specific fields (comma-separated)')
    .option('--orphan', 'Show only orphan objects (no links)')
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

interface ListOptions {
  linkedTo?: string;
  since?: string;
  limit?: string;
  fields?: string;
  orphan?: boolean;
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
    objects = objects.filter((obj) => {
      if (!obj.updated_at) return false;
      return new Date(obj.updated_at) >= sinceDate;
    });
  }

  if (options.linkedTo) {
    // Find the target object by name
    const searchResults = await client.search(options.linkedTo, { limit: 10 });

    // Find exact or best match
    const targetResult = searchResults.find(
      (r) => r.name.toLowerCase() === options.linkedTo!.toLowerCase()
    ) || searchResults[0];

    if (!targetResult) {
      throw new ValidationError(`No object found matching "${options.linkedTo}"`);
    }

    const targetId = targetResult.id;

    // Get IDs from backlinks on the target object (objects that link TO the target)
    const targetBacklinks = new Set<string>();
    const backlinksProperty = targetResult.properties?.find(
      (p: { key: string }) => p.key === 'backlinks'
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
      const linksProperty = obj.properties?.find(
        (p: { key: string }) => p.key === 'links'
      );
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
      const linksProperty = obj.properties?.find(
        (p: { key: string }) => p.key === 'links'
      );
      const backlinksProperty = obj.properties?.find(
        (p: { key: string }) => p.key === 'backlinks'
      );
      const hasLinks = (linksProperty?.objects?.length || 0) > 0;
      const hasBacklinks = (backlinksProperty?.objects?.length || 0) > 0;
      return !hasLinks && !hasBacklinks;
    });
  }

  // Parse fields
  const fields = options.fields ? options.fields.split(',').map((f) => f.trim()) : undefined;

  // Output results
  if (options.json) {
    console.log(formatAsJson(objects));
  } else {
    console.log(formatObjectsAsMarkdown(objects, fields));
  }
}

/**
 * Parse date filter (e.g., "2025-01-01", "today", "7d ago")
 */
function parseDateFilter(dateStr: string): Date {
  if (dateStr === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  // Try ISO format
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }

  throw new ValidationError(`Invalid date format: ${dateStr}. Use ISO format (YYYY-MM-DD) or "today".`);
}
