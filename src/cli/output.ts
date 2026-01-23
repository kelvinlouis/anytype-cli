import type { AnyObject, ObjectType, SearchResult } from '../api/types.js';

/**
 * Format data as JSON string
 */
export function formatAsJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Format types as markdown table
 */
export function formatTypesAsMarkdown(types: ObjectType[]): string {
  if (types.length === 0) {
    return 'No types found.';
  }

  const lines: string[] = [];
  lines.push('| Type Name | Type Key | Property Count |');
  lines.push('|-----------|----------|----------------|');

  for (const type of types) {
    const propCount = Object.keys(type.properties || {}).length;
    lines.push(`| ${type.name} | \`${type.key}\` | ${propCount} |`);
  }

  return lines.join('\n');
}

/**
 * Format objects as markdown table
 */
export function formatObjectsAsMarkdown(
  objects: AnyObject[],
  fields?: string[]
): string {
  if (objects.length === 0) {
    return 'No objects found.';
  }

  // Default fields if not specified
  const displayFields = fields || ['name', 'id', 'updated_at'];

  // Build header
  const headers = displayFields.map((f) => {
    // Capitalize field name
    return f
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  });

  const lines: string[] = [];
  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`|${headers.map(() => '---------').join('|')}|`);

  // Add rows
  for (const obj of objects) {
    const row = displayFields.map((field) => {
      const value = (obj as Record<string, unknown>)[field];
      if (value === undefined || value === null) {
        return '-';
      }
      if (typeof value === 'string') {
        return value.length > 30 ? value.substring(0, 27) + '...' : value;
      }
      return String(value);
    });
    lines.push(`| ${row.join(' | ')} |`);
  }

  return lines.join('\n');
}

/**
 * Format single object as detailed text
 */
export function formatObjectAsText(obj: AnyObject): string {
  const lines: string[] = [];

  lines.push(`# ${obj.name}`);
  lines.push('');
  lines.push(`**ID:** \`${obj.id}\``);
  lines.push(`**Type:** ${obj.type_key}`);

  if (obj.icon) {
    lines.push(`**Icon:** ${obj.icon}`);
  }

  if (obj.created_at) {
    lines.push(`**Created:** ${new Date(obj.created_at).toLocaleDateString()}`);
  }

  if (obj.updated_at) {
    lines.push(
      `**Updated:** ${new Date(obj.updated_at).toLocaleDateString()}`
    );
  }

  if (obj.properties && Object.keys(obj.properties).length > 0) {
    lines.push('');
    lines.push('## Properties');
    for (const [key, value] of Object.entries(obj.properties)) {
      if (value !== null && value !== undefined) {
        lines.push(`- **${key}:** ${String(value)}`);
      }
    }
  }

  if (obj.body && obj.body.trim()) {
    lines.push('');
    lines.push('## Body');
    lines.push('');
    lines.push(obj.body);
  }

  return lines.join('\n');
}

/**
 * Format search results as markdown list
 */
export function formatSearchResultsAsMarkdown(
  results: SearchResult[]
): string {
  if (results.length === 0) {
    return 'No results found.';
  }

  const lines: string[] = [];

  for (const result of results) {
    lines.push(`- **${result.name}** (\`${result.id}\`)`);
    if (result.snippet) {
      lines.push(`  > ${result.snippet.substring(0, 80)}...`);
    }
    if (result.type_key) {
      lines.push(`  *Type: ${result.type_key}*`);
    }
  }

  return lines.join('\n');
}
