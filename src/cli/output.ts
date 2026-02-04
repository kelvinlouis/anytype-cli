import type { AnyObject, ObjectType, SearchResult } from '../api/types.js';

/**
 * Format data as JSON string
 */
export function formatAsJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Format an icon for display
 */
function formatIcon(icon: unknown): string {
  if (typeof icon === 'string') {
    return icon;
  }
  if (typeof icon === 'object' && icon !== null) {
    const iconObj = icon as Record<string, unknown>;
    // Handle different icon formats
    if (iconObj.emoji) {
      return iconObj.emoji as string;
    }
    if (iconObj.file) {
      return iconObj.file as string;
    }
    if (iconObj.url) {
      return iconObj.url as string;
    }
    if (iconObj.name) {
      return iconObj.name as string;
    }
  }
  return '-';
}

/**
 * Format an Anytype property value based on its format type.
 * Returns an object with the property name and formatted value.
 */
function formatPropertyValue(prop: Record<string, unknown>): { name: string; value: string } | null {
  if (prop.object !== 'property' || !prop.format || !prop.name) {
    return null;
  }

  const name = prop.name as string;
  const format = prop.format as string;

  switch (format) {
    case 'date':
      if (prop.date) {
        const date = new Date(prop.date as string);
        return { name, value: date.toLocaleDateString() };
      }
      return { name, value: '-' };

    case 'number':
      if (prop.number !== undefined && prop.number !== null) {
        return { name, value: String(prop.number) };
      }
      return { name, value: '-' };

    case 'text':
      if (prop.text) {
        return { name, value: prop.text as string };
      }
      return { name, value: '-' };

    case 'select':
      if (prop.select && typeof prop.select === 'object') {
        const select = prop.select as Record<string, unknown>;
        return { name, value: (select.name as string) || (select.key as string) || '-' };
      }
      return { name, value: '-' };

    case 'multi_select':
      if (Array.isArray(prop.multi_select) && prop.multi_select.length > 0) {
        const tags = prop.multi_select.map((tag: Record<string, unknown>) =>
          (tag.name as string) || (tag.key as string)
        );
        return { name, value: tags.join(', ') };
      }
      return { name, value: '-' };

    case 'objects':
      if (Array.isArray(prop.objects) && prop.objects.length > 0) {
        const count = prop.objects.length;
        return { name, value: `${count} object${count > 1 ? 's' : ''}` };
      }
      return { name, value: '-' };

    case 'checkbox':
      return { name, value: prop.checkbox ? 'Yes' : 'No' };

    case 'url':
      if (prop.url) {
        return { name, value: prop.url as string };
      }
      return { name, value: '-' };

    case 'email':
      if (prop.email) {
        return { name, value: prop.email as string };
      }
      return { name, value: '-' };

    case 'phone':
      if (prop.phone) {
        return { name, value: prop.phone as string };
      }
      return { name, value: '-' };

    default:
      // Unknown format, try to extract something useful
      return { name, value: '-' };
  }
}

/**
 * Format a value for human-readable text output
 */
function formatValue(value: unknown, indent = 0): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    // For simple arrays of primitives, join them
    if (value.every((v) => typeof v !== 'object' || v === null)) {
      return value.map((v) => formatValue(v)).join(', ');
    }
    // For arrays of objects, format each on a new line
    const prefix = '  '.repeat(indent + 1);
    return (
      '\n' +
      value.map((v, i) => `${prefix}${i + 1}. ${formatValue(v, indent + 1)}`).join('\n')
    );
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return '{}';
    }
    // For objects with just a few keys, show inline
    if (keys.length <= 3) {
      const parts = keys
        .filter((k) => obj[k] !== undefined && obj[k] !== null)
        .map((k) => `${k}: ${formatValue(obj[k], indent + 1)}`);
      return parts.join(', ');
    }
    // For larger objects, use JSON but compact
    return JSON.stringify(obj);
  }
  return String(value);
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
      const formatted = formatValue(value);
      // Truncate for table display and remove newlines
      const singleLine = formatted.replace(/\n/g, ' ').trim();
      return singleLine.length > 30 ? singleLine.substring(0, 27) + '...' : singleLine;
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
  lines.push(`**Type:** ${obj.type?.key || obj.type_key}`);

  if (obj.icon) {
    lines.push(`**Icon:** ${formatIcon(obj.icon)}`);
  }

  if (obj.created_at) {
    lines.push(`**Created:** ${new Date(obj.created_at).toLocaleDateString()}`);
  }

  if (obj.updated_at) {
    lines.push(
      `**Updated:** ${new Date(obj.updated_at).toLocaleDateString()}`
    );
  }

  if (obj.properties && obj.properties.length > 0) {
    lines.push('');
    lines.push('## Properties');
    for (const prop of obj.properties) {
      const formatted = formatPropertyValue(prop as unknown as Record<string, unknown>);
      if (formatted) {
        lines.push(`- **${formatted.name}:** ${formatted.value}`);
      }
    }
  }

  if (obj.markdown && obj.markdown.trim()) {
    lines.push('');
    lines.push('## Content');
    lines.push('');
    lines.push(obj.markdown);
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
