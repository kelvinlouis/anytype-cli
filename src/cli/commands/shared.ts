import { AnytypeClient } from '../../api/client.js';
import { config } from '../../config/index.js';
import { ConfigError } from '../../utils/errors.js';

/**
 * Validate config and return an authenticated API client with the active space ID.
 * Throws ConfigError if apiKey or defaultSpace is not configured.
 */
export function createAuthenticatedClient(): { client: AnytypeClient; spaceId: string } {
  const apiKey = config.getApiKey();
  if (!apiKey) {
    throw new ConfigError('API key not configured. Run `anytype init` first.');
  }

  const spaceId = config.getDefaultSpace();
  if (!spaceId) {
    throw new ConfigError('No default space configured. Run `anytype init` first.');
  }

  const client = new AnytypeClient(config.getBaseURL(), apiKey);
  return { client, spaceId };
}

/**
 * Resolve object IDs to human-readable names via parallel getObject() calls.
 * Returns a Map<objectId, name>. Unresolvable IDs are silently skipped.
 */
export async function resolveObjectNames(
  client: AnytypeClient,
  spaceId: string,
  objectIds: Set<string>,
): Promise<Map<string, string>> {
  const objectNames = new Map<string, string>();

  if (objectIds.size === 0) return objectNames;

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

  return objectNames;
}
