import { Command } from 'commander';
import { config } from '../../config/index.js';
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  LINKED_SEARCH_LIMIT,
  DEFAULT_DISPLAY_FIELDS,
  DATE_FIELDS,
  EMPTY_CELL,
} from '../../constants.js';
import { ValidationError, handleError } from '../../utils/errors.js';
import { parseDateFilter } from '../../utils/date.js';
import type { AnyObject } from '../../api/types.js';
import type { AnytypeClient } from '../../api/client.js';
import {
  formatAsJson,
  formatObjectsAsMarkdown,
  resolveFieldValue,
  resolveRawFieldValue,
} from '../output.js';
import { createAuthenticatedClient, resolveObjectNames } from './shared.js';

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
    .option(
      '--where <condition>',
      'Filter by field value (repeatable, e.g. "tag=AI")',
      collectWhereConditions,
      [],
    )
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

function collectWhereConditions(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

function filterBySinceDate(objects: AnyObject[], since: string): AnyObject[] {
  const sinceDate = parseDateFilter(since);
  return objects.filter((obj) => {
    for (const field of DATE_FIELDS) {
      const val = resolveRawFieldValue(obj, field);
      if (val instanceof Date) return val >= sinceDate;
    }
    return false;
  });
}

async function filterByLinkedObject(
  client: AnytypeClient,
  spaceId: string,
  linkedTo: string,
  typeKey: string,
  limit: number,
  objects: AnyObject[],
): Promise<AnyObject[]> {
  const searchResults = await client.search(linkedTo, { limit: LINKED_SEARCH_LIMIT });

  const targetResult =
    searchResults.find((r) => r.name.toLowerCase() === linkedTo.toLowerCase()) || searchResults[0];

  if (!targetResult) {
    throw new ValidationError(`No object found matching "${linkedTo}"`);
  }

  const targetId = targetResult.id;

  const targetBacklinks = new Set<string>();
  const backlinksProperty = targetResult.properties?.find(
    (p: { key: string }) => p.key === 'backlinks',
  );
  if (backlinksProperty?.objects) {
    for (const id of backlinksProperty.objects) {
      targetBacklinks.add(id);
    }
  }

  const mentionResults = await client.searchInSpace(spaceId, linkedTo, {
    type_key: typeKey,
    limit,
  });
  const mentionIds = new Set(mentionResults.map((r) => r.id));

  return objects.filter((obj) => {
    if (mentionIds.has(obj.id)) return true;
    if (targetBacklinks.has(obj.id)) return true;
    const linksProperty = obj.properties?.find((p: { key: string }) => p.key === 'links');
    if (linksProperty?.objects?.includes(targetId)) return true;
    return false;
  });
}

function filterOrphanObjects(objects: AnyObject[]): AnyObject[] {
  return objects.filter((obj) => {
    const linksProperty = obj.properties?.find((p: { key: string }) => p.key === 'links');
    const backlinksProperty = obj.properties?.find((p: { key: string }) => p.key === 'backlinks');
    const hasLinks = (linksProperty?.objects?.length || 0) > 0;
    const hasBacklinks = (backlinksProperty?.objects?.length || 0) > 0;
    return !hasLinks && !hasBacklinks;
  });
}

const CHECKBOX_TRUE_ALIASES = new Set(['true', '1']);
const CHECKBOX_FALSE_ALIASES = new Set(['false', '0']);

function normalizeCheckboxAlias(value: string): string {
  if (CHECKBOX_TRUE_ALIASES.has(value)) return 'yes';
  if (CHECKBOX_FALSE_ALIASES.has(value)) return 'no';
  return value;
}

async function applyWhereFilters(
  objects: AnyObject[],
  conditions: string[],
  client: AnytypeClient,
  spaceId: string,
): Promise<AnyObject[]> {
  const whereFields = new Set<string>();
  for (const condition of conditions) {
    const match = condition.match(/^(.+?)(?:!=|=)/);
    if (match) whereFields.add(match[1].toLowerCase());
  }

  const whereObjectIds = new Set<string>();
  if (whereFields.size > 0) {
    for (const obj of objects) {
      if (!obj.properties) continue;
      for (const prop of obj.properties) {
        if (prop.format !== 'objects' || !prop.objects?.length) continue;
        const matchesField =
          whereFields.has(prop.key?.toLowerCase() ?? '') ||
          whereFields.has(prop.name?.toLowerCase() ?? '');
        if (matchesField) {
          for (const id of prop.objects) {
            whereObjectIds.add(id);
          }
        }
      }
    }
  }

  const whereObjectNames = await resolveObjectNames(client, spaceId, whereObjectIds);

  let filtered = objects;
  for (const condition of conditions) {
    const notEmpty = condition.match(/^(.+)!=$/);
    const empty = condition.match(/^(.+)=$/);
    const equals = condition.match(/^(.+?)=(.+)$/);

    if (notEmpty) {
      const field = notEmpty[1];
      filtered = filtered.filter(
        (obj) => resolveFieldValue(obj, field, whereObjectNames) !== EMPTY_CELL,
      );
    } else if (empty) {
      const field = empty[1];
      filtered = filtered.filter(
        (obj) => resolveFieldValue(obj, field, whereObjectNames) === EMPTY_CELL,
      );
    } else if (equals) {
      const field = equals[1];
      const value = normalizeCheckboxAlias(equals[2].toLowerCase());
      filtered = filtered.filter((obj) => {
        const resolved = resolveFieldValue(obj, field, whereObjectNames).toLowerCase();
        return resolved !== EMPTY_CELL && resolved.includes(value);
      });
    } else {
      throw new ValidationError(
        `Invalid --where condition: "${condition}". Use field=value, field=, or field!=`,
      );
    }
  }

  return filtered;
}

function applySorting(objects: AnyObject[], sortSpec: string): void {
  const parts = sortSpec.split(':');
  const sortField = parts[0];
  const sortOrder = parts[1]?.toLowerCase() === 'desc' ? -1 : 1;

  objects.sort((a, b) => {
    const aVal = resolveRawFieldValue(a, sortField);
    const bVal = resolveRawFieldValue(b, sortField);

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

async function listAction(typeInput: string, options: ListOptions): Promise<void> {
  const { client, spaceId } = createAuthenticatedClient();
  const typeKey = config.resolveAlias(typeInput);
  const limit = Math.min(parseInt(options.limit || String(DEFAULT_LIST_LIMIT), 10), MAX_LIST_LIMIT);

  let objects = await client.getObjects(spaceId, { type_key: typeKey, limit });

  if (options.since) {
    objects = filterBySinceDate(objects, options.since);
  }

  if (options.linkedTo) {
    objects = await filterByLinkedObject(
      client,
      spaceId,
      options.linkedTo,
      typeKey,
      limit,
      objects,
    );
    if (options.verbose) {
      console.error(`[DEBUG] Objects after filter: ${objects.length}`);
    }
  }

  if (options.orphan) {
    objects = filterOrphanObjects(objects);
  }

  if (options.where && options.where.length > 0) {
    objects = await applyWhereFilters(objects, options.where, client, spaceId);
  }

  if (options.sort) {
    applySorting(objects, options.sort);
  }

  const fields = options.fields
    ? options.fields.split(',').map((f) => f.trim())
    : config.getTypeFields(typeKey);

  let objectNames = new Map<string, string>();
  if (!options.json) {
    const displayFields = fields || DEFAULT_DISPLAY_FIELDS;
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

    objectNames = await resolveObjectNames(client, spaceId, objectIds);
  }

  if (options.json) {
    console.log(formatAsJson(objects));
  } else {
    console.log(formatObjectsAsMarkdown(objects, fields, objectNames));
  }
}
