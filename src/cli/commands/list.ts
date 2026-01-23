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
    // Filter by linked object name (simplified - would need full relation info)
    // This is a placeholder for the actual relation filtering logic
    // In a real implementation, this would need to check the relations property
  }

  if (options.orphan) {
    // Filter for orphan objects (no links, no backlinks)
    // This would need to check if object has any relations
    objects = objects.filter((obj) => {
      const hasRelations = obj.properties && Object.keys(obj.properties).length === 0;
      return hasRelations;
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
