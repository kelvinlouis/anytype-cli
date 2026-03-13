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

import { DEFAULT_TAG_COLOR } from '../constants.js';
import { ValidationError } from './errors.js';
import type { AnytypeClient } from '../api/client.js';
import type { TypeProperty } from '../api/types.js';
import type { PropertyPayload, ParsedProperty } from './properties.types.js';

export type { PropertyPayload, ParsedProperty } from './properties.types.js';

const URL_RE = /^https?:\/\//i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/;
const CHECKBOX_TRUTHY = new Set(['true', 'yes', '1']);
const CHECKBOX_AUTO_DETECT = new Set(['true', 'false', 'yes', 'no']);

function splitCommaSeparated(value: string): string[] {
  return value.split(',').map((s) => s.trim());
}

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
  if (CHECKBOX_AUTO_DETECT.has(value.toLowerCase())) return 'checkbox';
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
      return { key, checkbox: CHECKBOX_TRUTHY.has(value.toLowerCase()) };
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
      return { key, multi_select: splitCommaSeparated(value) };
    case 'objects':
      return { key, objects: splitCommaSeparated(value) };
    case 'files':
      return { key, files: splitCommaSeparated(value) };
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
  const payloads = parsed.map((p) => {
    // If the user gave an explicit type hint, always use it
    if (p.type) return buildPropertyPayload(p);

    // If we have a schema format for this key, use it instead of auto-detection
    if (schema && schema.has(p.key)) {
      return buildPropertyPayload({ ...p, type: schema.get(p.key)! });
    }

    // Fall back to auto-detection
    return buildPropertyPayload(p);
  });

  // Merge repeated same-key multi_select entries (e.g. --property tag=a --property tag=b)
  const merged: PropertyPayload[] = [];
  for (const p of payloads) {
    const existing = merged.find((m) => m.key === p.key);
    if (existing && 'multi_select' in existing && 'multi_select' in p) {
      existing.multi_select = [
        ...(existing.multi_select as string[]),
        ...(p.multi_select as string[]),
      ];
    } else {
      merged.push(p);
    }
  }
  return merged;
}

/**
 * Resolve tag names to IDs for select/multi_select properties.
 *
 * For each select/multi_select property in the payloads, looks up existing tags
 * by name (case-insensitive). For multi_select, creates missing tags automatically.
 * For select, fails with available options when no match is found.
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

    const tagContext = { client, spaceId, propertyId: typeProp.id };

    if (typeProp.format === 'select') {
      const tagName = payload.select as string;
      const tagId = findExistingTag(tagName, existingTags);
      if (!tagId) {
        const available = existingTags.map((t) => t.name).join(', ');
        throw new ValidationError(
          `Invalid value "${tagName}" for select property "${typeProp.name}". ` +
            `Available options: ${available || '(none)'}`,
        );
      }
      result.push({ key: payload.key, select: tagId });
    } else {
      const tagNames = payload.multi_select as string[];
      const tagIds: string[] = [];
      for (const tagName of tagNames) {
        const tagId = await resolveOrCreateTag(tagName, existingTags, tagContext);
        tagIds.push(tagId);
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
 * Find an existing tag by ID, key, or name (case-insensitive).
 * Returns the tag ID if found, undefined otherwise.
 */
function findExistingTag(
  nameOrId: string,
  existingTags: Array<{ id: string; key?: string; name: string }>,
): string | undefined {
  const byId = existingTags.find((t) => t.id === nameOrId || t.key === nameOrId);
  if (byId) return byId.id;

  const byName = existingTags.find((t) => t.name.toLowerCase() === nameOrId.toLowerCase());
  if (byName) return byName.id;

  return undefined;
}

interface TagContext {
  client: AnytypeClient;
  spaceId: string;
  propertyId: string;
}

async function resolveOrCreateTag(
  nameOrId: string,
  existingTags: Array<{ id: string; key?: string; name: string }>,
  ctx: TagContext,
): Promise<string> {
  const existing = findExistingTag(nameOrId, existingTags);
  if (existing) return existing;

  const newTag = await ctx.client.createTag(ctx.spaceId, ctx.propertyId, {
    name: nameOrId,
    color: DEFAULT_TAG_COLOR,
  });
  return newTag.id;
}
