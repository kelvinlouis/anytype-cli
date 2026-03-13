import type { TypeProperty } from '../api/types.js';
import { RESERVED_OBJECT_PROPERTIES } from '../constants.js';
import { ValidationError } from './errors.js';

export function getSettableLinkProperties(properties: TypeProperty[]): TypeProperty[] {
  return properties.filter((p) => p.format === 'objects' && !RESERVED_OBJECT_PROPERTIES.has(p.key));
}

export function resolveLinkProperty(
  properties: TypeProperty[],
  explicitKey?: string,
): TypeProperty {
  const candidates = getSettableLinkProperties(properties);

  if (explicitKey) {
    const match = candidates.find((p) => p.key === explicitKey);
    if (!match) {
      const available = candidates.map((p) => `${p.key} ("${p.name}")`).join(', ');
      throw new ValidationError(
        available
          ? `Property "${explicitKey}" is not a settable object property. Available: ${available}`
          : `Property "${explicitKey}" is not a settable object property. This type has no settable object properties.`,
      );
    }
    return match;
  }

  if (candidates.length === 0) {
    throw new ValidationError('This type has no settable object properties. Cannot use --link-to.');
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  const available = candidates.map((p) => `${p.key} ("${p.name}")`).join(', ');
  throw new ValidationError(
    `Multiple object properties available: ${available}. Use --link-property <key> to specify which one.`,
  );
}
