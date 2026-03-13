import {
  EMPTY_CELL,
  DEFAULT_DISPLAY_FIELDS,
  INLINE_OBJECT_KEY_THRESHOLD,
  MAX_CELL_LENGTH,
  MAX_SNIPPET_LENGTH,
} from '../constants.js';
import type { AnyObject, ObjectType, SearchResult, TypeProperty } from '../api/types.js';

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
  return EMPTY_CELL;
}

/**
 * Format an Anytype property value based on its format type.
 * Returns an object with the property name and formatted value.
 */
function formatPropertyValue(
  prop: Record<string, unknown>,
  objectNames?: Map<string, string>,
): { name: string; value: string } | null {
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
      return { name, value: EMPTY_CELL };

    case 'number':
      if (prop.number !== undefined && prop.number !== null) {
        return { name, value: String(prop.number) };
      }
      return { name, value: EMPTY_CELL };

    case 'text':
      if (prop.text) {
        return { name, value: prop.text as string };
      }
      return { name, value: EMPTY_CELL };

    case 'select':
      if (prop.select && typeof prop.select === 'object') {
        const select = prop.select as Record<string, unknown>;
        return { name, value: (select.name as string) || (select.key as string) || EMPTY_CELL };
      }
      return { name, value: EMPTY_CELL };

    case 'multi_select':
      if (Array.isArray(prop.multi_select) && prop.multi_select.length > 0) {
        const tags = prop.multi_select.map(
          (tag: Record<string, unknown>) => (tag.name as string) || (tag.key as string),
        );
        return { name, value: tags.join(', ') };
      }
      return { name, value: EMPTY_CELL };

    case 'objects':
      if (Array.isArray(prop.objects) && prop.objects.length > 0) {
        if (objectNames && objectNames.size > 0) {
          const names = (prop.objects as string[])
            .map((id) => objectNames.get(id) || id)
            .join(', ');
          return { name, value: names };
        }
        const count = prop.objects.length;
        return { name, value: `${count} object${count > 1 ? 's' : ''}` };
      }
      return { name, value: EMPTY_CELL };

    case 'checkbox':
      return { name, value: prop.checkbox ? 'Yes' : 'No' };

    case 'url':
      if (prop.url) {
        return { name, value: prop.url as string };
      }
      return { name, value: EMPTY_CELL };

    case 'email':
      if (prop.email) {
        return { name, value: prop.email as string };
      }
      return { name, value: EMPTY_CELL };

    case 'phone':
      if (prop.phone) {
        return { name, value: prop.phone as string };
      }
      return { name, value: EMPTY_CELL };

    default:
      return { name, value: EMPTY_CELL };
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
      '\n' + value.map((v, i) => `${prefix}${i + 1}. ${formatValue(v, indent + 1)}`).join('\n')
    );
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return '{}';
    }
    // For objects with just a few keys, show inline
    if (keys.length <= INLINE_OBJECT_KEY_THRESHOLD) {
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
    const props = type.properties;
    const propCount = Array.isArray(props) ? props.length : Object.keys(props || {}).length;
    lines.push(`| ${type.name} | \`${type.key}\` | ${propCount} |`);
  }

  return lines.join('\n');
}

/**
 * Map of computed fields that derive values from the properties array.
 */
const COMPUTED_FIELDS: Record<string, (obj: AnyObject) => number> = {
  link_count: (obj) => {
    const prop = obj.properties?.find((p) => p.key === 'links');
    return prop?.objects?.length ?? 0;
  },
  backlink_count: (obj) => {
    const prop = obj.properties?.find((p) => p.key === 'backlinks');
    return prop?.objects?.length ?? 0;
  },
};

/**
 * Truncate a cell value for markdown table display.
 * Collapses newlines, escapes pipe chars, and truncates to maxLength.
 */
export function truncateCell(value: string, maxLength = MAX_CELL_LENGTH): string {
  // Collapse newlines into spaces
  let result = value.replace(/\n/g, ' ').trim();
  // Escape pipe chars to prevent breaking markdown tables
  result = result.replace(/\|/g, '\\|');
  if (result.length > maxLength) {
    result = result.substring(0, maxLength - 3) + '...';
  }
  return result;
}

/**
 * Find a property in an object's properties array by key or name (case-insensitive).
 */
function findPropertyByField(
  properties: AnyObject['properties'],
  field: string,
): (typeof properties extends Array<infer T> ? T : never) | undefined {
  if (!properties) return undefined;
  const fieldLower = field.toLowerCase();
  return properties.find(
    (p) => p.key?.toLowerCase() === fieldLower || p.name?.toLowerCase() === fieldLower,
  );
}

/**
 * Resolve a field value from an object, checking computed fields first,
 * then top-level keys, then falling back to the properties array (matched by key or name).
 */
export function resolveFieldValue(
  obj: AnyObject,
  field: string,
  objectNames?: Map<string, string>,
): string {
  if (field in COMPUTED_FIELDS) {
    return String(COMPUTED_FIELDS[field](obj));
  }

  const topLevel = (obj as Record<string, unknown>)[field];
  if (topLevel !== undefined && topLevel !== null) {
    const formatted = formatValue(topLevel);
    const singleLine = formatted.replace(/\n/g, ' ').trim();
    if (field === 'id') {
      return `\`${singleLine}\``;
    }
    return singleLine;
  }

  const prop = findPropertyByField(obj.properties, field);
  if (prop) {
    const formatted = formatPropertyValue(prop as unknown as Record<string, unknown>, objectNames);
    if (formatted) return formatted.value;
  }

  return EMPTY_CELL;
}

/**
 * Resolve a raw field value from an object for sorting purposes.
 * Returns Date for date fields, number for number fields, string for text, null for empty.
 */
export function resolveRawFieldValue(obj: AnyObject, field: string): Date | number | string | null {
  if (field in COMPUTED_FIELDS) {
    return COMPUTED_FIELDS[field](obj);
  }

  // Check top-level date fields
  if (field === 'created_at' || field === 'updated_at') {
    const val = (obj as unknown as Record<string, unknown>)[field];
    if (val && typeof val === 'string') {
      const date = new Date(val);
      if (!isNaN(date.getTime())) return date;
    }
    return null;
  }

  const topLevel = (obj as unknown as Record<string, unknown>)[field];
  if (topLevel !== undefined && topLevel !== null) {
    if (typeof topLevel === 'number') return topLevel;
    if (typeof topLevel === 'string') return topLevel || null;
    return String(topLevel);
  }

  const prop = findPropertyByField(obj.properties, field);
  if (prop) {
    const format = prop.format;
    switch (format) {
      case 'date':
        if (prop.date) {
          const date = new Date(prop.date);
          if (!isNaN(date.getTime())) return date;
        }
        return null;
      case 'number':
        if (prop.number !== undefined && prop.number !== null) return prop.number;
        return null;
      case 'text':
        return prop.text || null;
      case 'select':
        if (prop.select && typeof prop.select === 'object') {
          return ((prop.select as Record<string, unknown>).name as string) || null;
        }
        return null;
      case 'multi_select':
        if (Array.isArray(prop.multi_select) && prop.multi_select.length > 0) {
          return prop.multi_select.map((t: Record<string, unknown>) => t.name as string).join(', ');
        }
        return null;
      case 'checkbox':
        return (prop as unknown as Record<string, unknown>).checkbox ? 1 : 0;
      default: {
        const formatted = formatPropertyValue(prop as unknown as Record<string, unknown>);
        if (formatted && formatted.value !== EMPTY_CELL) return formatted.value;
        return null;
      }
    }
  }

  return null;
}

/**
 * Format objects as markdown table
 */
export function formatObjectsAsMarkdown(
  objects: AnyObject[],
  fields?: string[],
  objectNames?: Map<string, string>,
): string {
  if (objects.length === 0) {
    return 'No objects found.';
  }

  // Default fields if not specified
  const displayFields = fields || DEFAULT_DISPLAY_FIELDS;

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
    const row = displayFields.map((field) =>
      truncateCell(resolveFieldValue(obj, field, objectNames)),
    );
    lines.push(`| ${row.join(' | ')} |`);
  }

  return lines.join('\n');
}

/**
 * Format single object as detailed text
 */
export function formatObjectAsText(obj: AnyObject, objectNames?: Map<string, string>): string {
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
    lines.push(`**Updated:** ${new Date(obj.updated_at).toLocaleDateString()}`);
  }

  if (obj.properties && obj.properties.length > 0) {
    lines.push('');
    lines.push('## Properties');
    for (const prop of obj.properties) {
      const formatted = formatPropertyValue(
        prop as unknown as Record<string, unknown>,
        objectNames,
      );
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
 * Format a single type's detail view with property table and usage examples
 */
export function formatTypeDetailAsMarkdown(type: ObjectType): string {
  const lines: string[] = [];

  lines.push(`# ${type.name}`);
  lines.push('');
  lines.push(`**Key:** \`${type.key}\``);
  if (type.layout) {
    lines.push(`**Layout:** ${type.layout}`);
  }

  const properties = type.properties || [];
  if (properties.length > 0) {
    lines.push('');
    lines.push(`## Properties (${properties.length})`);
    lines.push('');
    lines.push('| Property Name | Key | Format |');
    lines.push('|---------------|-----|--------|');
    for (const prop of properties) {
      lines.push(`| ${prop.name} | \`${prop.key}\` | ${prop.format} |`);
    }

    // Usage examples
    const exampleProps = properties.filter(
      (p) => !['links', 'backlinks', 'type', 'name'].includes(p.key),
    );
    if (exampleProps.length > 0) {
      lines.push('');
      lines.push('## Usage');
      lines.push('');

      const firstProp = exampleProps[0];
      lines.push(`  anytype create ${type.key} "Name" --property ${firstProp.key}="example value"`);

      lines.push(`  anytype list ${type.key} --where ${firstProp.key}=value`);

      const fieldKeys = exampleProps.slice(0, 5).map((p) => p.key);
      lines.push(`  anytype list ${type.key} --fields name,${fieldKeys.join(',')}`);
    }
  } else {
    lines.push('');
    lines.push('No properties found for this type.');
  }

  return lines.join('\n');
}

/**
 * Format templates as markdown table
 */
export function formatTemplatesAsMarkdown(templates: AnyObject[]): string {
  if (templates.length === 0) {
    return 'No templates found.';
  }

  const lines: string[] = [];
  lines.push('| Name | ID |');
  lines.push('|------|----|');

  for (const template of templates) {
    lines.push(`| ${template.name} | \`${template.id}\` |`);
  }

  return lines.join('\n');
}

/**
 * Format a single template's detail view
 */
export function formatTemplateDetailAsMarkdown(template: AnyObject): string {
  const lines: string[] = [];

  lines.push(`# ${template.name}`);
  lines.push('');
  lines.push(`**ID:** \`${template.id}\``);

  if (template.properties && template.properties.length > 0) {
    lines.push('');
    lines.push('## Properties');
    for (const prop of template.properties) {
      const formatted = formatPropertyValue(prop as unknown as Record<string, unknown>);
      if (formatted) {
        lines.push(`- **${formatted.name}:** ${formatted.value}`);
      }
    }
  }

  if (template.markdown && template.markdown.trim()) {
    lines.push('');
    lines.push('## Content');
    lines.push('');
    lines.push(template.markdown);
  }

  return lines.join('\n');
}

/**
 * Format search results as markdown list
 */
export function formatSearchResultsAsMarkdown(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'No results found.';
  }

  const lines: string[] = [];

  for (const result of results) {
    lines.push(`- **${result.name}** (\`${result.id}\`)`);
    if (result.snippet) {
      lines.push(`  > ${result.snippet.substring(0, MAX_SNIPPET_LENGTH)}...`);
    }
    if (result.type_key) {
      lines.push(`  *Type: ${result.type_key}*`);
    }
  }

  return lines.join('\n');
}
