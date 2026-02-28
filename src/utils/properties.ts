/**
 * Property parsing and serialization for the Anytype API.
 *
 * Supports the --property flag syntax:
 *   key=value          Auto-detect type from value
 *   key:type=value     Explicit type hint
 *
 * Supported types: text, number, checkbox, date, url, email, phone,
 *                  select, multi_select, objects
 */

import type { AnytypeClient } from '../api/client.js';
import type { TypeProperty } from '../api/types.js';

/** A single property entry ready for the API request body. */
export interface PropertyPayload {
  key: string;
  [field: string]: unknown;
}

/** Parsed result from the CLI --property flag. */
export interface ParsedProperty {
  key: string;
  type: string | undefined;
  value: string;
}

const URL_RE = /^https?:\/\//i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/;

/**
 * Parse a "key=value" or "key:type=value" string from the --property flag.
 */
export function parsePropertyFlag(input: string): ParsedProperty {
  // Match key:type=value or key=value
  const eqIdx = input.indexOf('=');
  if (eqIdx === -1) {
    throw new Error('Properties must be in format key=value or key:type=value');
  }

  const left = input.slice(0, eqIdx);
  const value = input.slice(eqIdx + 1);

  const colonIdx = left.indexOf(':');
  if (colonIdx !== -1) {
    const key = left.slice(0, colonIdx);
    const type = left.slice(colonIdx + 1);
    if (!key || !type) {
      throw new Error('Properties must be in format key=value or key:type=value');
    }
    return { key, type, value };
  }

  if (!left) {
    throw new Error('Properties must be in format key=value or key:type=value');
  }
  return { key: left, type: undefined, value };
}

/**
 * Detect the most likely property type from a raw string value.
 */
function detectType(value: string): string {
  if (value === 'true' || value === 'false') return 'checkbox';
  if (value !== '' && !isNaN(Number(value))) return 'number';
  if (URL_RE.test(value)) return 'url';
  if (EMAIL_RE.test(value)) return 'email';
  if (ISO_DATE_RE.test(value)) return 'date';
  return 'text';
}

/**
 * Build a PropertyLinkWithValue payload for the API from a parsed property.
 */
export function buildPropertyPayload(parsed: ParsedProperty): PropertyPayload {
  const type = parsed.type || detectType(parsed.value);
  const { key, value } = parsed;

  switch (type) {
    case 'text':
      return { key, text: value };
    case 'number':
      return { key, number: Number(value) };
    case 'checkbox':
      return { key, checkbox: value === 'true' || value === '1' };
    case 'date':
      return { key, date: value };
    case 'url':
      return { key, url: value };
    case 'email':
      return { key, email: value };
    case 'phone':
      return { key, phone: value };
    case 'select':
      return { key, select: value };
    case 'multi_select':
      return { key, multi_select: value.split(',').map((s) => s.trim()) };
    case 'objects':
      return { key, objects: value.split(',').map((s) => s.trim()) };
    case 'files':
      return { key, files: value.split(',').map((s) => s.trim()) };
    default:
      throw new Error(
        `Unknown property type "${type}". Supported: text, number, checkbox, date, url, email, phone, select, multi_select, objects, files`,
      );
  }
}

/**
 * Commander collect function for the --property flag.
 * Parses "key=value" or "key:type=value" strings.
 */
export function collectProperty(value: string, previous: ParsedProperty[]): ParsedProperty[] {
  return previous.concat(parsePropertyFlag(value));
}

/**
 * Convert an array of parsed properties to API payload format.
 *
 * When a schema map is provided (property key → format from the type definition),
 * properties without an explicit type hint will use the schema format instead of
 * auto-detection. This avoids mismatches like sending `text` for a `select` property.
 */
export function toPropertyPayloads(
  parsed: ParsedProperty[],
  schema?: Map<string, string>,
): PropertyPayload[] {
  return parsed.map((p) => {
    // If the user gave an explicit type hint, always use it
    if (p.type) return buildPropertyPayload(p);

    // If we have a schema format for this key, use it instead of auto-detection
    if (schema && schema.has(p.key)) {
      return buildPropertyPayload({ ...p, type: schema.get(p.key)! });
    }

    // Fall back to auto-detection
    return buildPropertyPayload(p);
  });
}

/**
 * Resolve tag names to IDs for select/multi_select properties.
 *
 * For each select/multi_select property in the payloads, looks up existing tags
 * by name (case-insensitive). If a tag doesn't exist, creates it automatically.
 * Replaces the tag names in the payload with the resolved tag IDs.
 */
export async function resolveTagProperties(
  payloads: PropertyPayload[],
  typeProperties: TypeProperty[],
  client: AnytypeClient,
  spaceId: string,
): Promise<PropertyPayload[]> {
  const result: PropertyPayload[] = [];

  for (const payload of payloads) {
    const typeProp = typeProperties.find((tp) => tp.key === payload.key);
    if (!typeProp || (typeProp.format !== 'select' && typeProp.format !== 'multi_select')) {
      result.push(payload);
      continue;
    }

    // Get existing tags for this property
    let existingTags: Array<{ id: string; key?: string; name: string }> = [];
    try {
      existingTags = await client.listTags(spaceId, typeProp.id);
    } catch {
      // If we can't list tags, pass through as-is
      result.push(payload);
      continue;
    }

    if (typeProp.format === 'select') {
      const tagName = payload.select as string;
      const tagId = await resolveOneTag(tagName, existingTags, client, spaceId, typeProp.id);
      result.push({ key: payload.key, select: tagId });
    } else {
      // multi_select
      const tagNames = payload.multi_select as string[];
      const tagIds: string[] = [];
      for (const tagName of tagNames) {
        const tagId = await resolveOneTag(tagName, existingTags, client, spaceId, typeProp.id);
        tagIds.push(tagId);
        // Add newly created tag to existingTags so subsequent lookups find it
        if (!existingTags.some((t) => t.id === tagId)) {
          existingTags.push({ id: tagId, name: tagName });
        }
      }
      result.push({ key: payload.key, multi_select: tagIds });
    }
  }

  return result;
}

/**
 * Resolve a single tag name to its ID. Creates the tag if it doesn't exist.
 */
async function resolveOneTag(
  nameOrId: string,
  existingTags: Array<{ id: string; key?: string; name: string }>,
  client: AnytypeClient,
  spaceId: string,
  propertyId: string,
): Promise<string> {
  // Try exact match by id or key first
  const byId = existingTags.find((t) => t.id === nameOrId || t.key === nameOrId);
  if (byId) return byId.id;

  // Try case-insensitive match by name
  const byName = existingTags.find((t) => t.name.toLowerCase() === nameOrId.toLowerCase());
  if (byName) return byName.id;

  // Tag doesn't exist — create it
  const newTag = await client.createTag(spaceId, propertyId, { name: nameOrId, color: 'grey' });
  return newTag.id;
}
