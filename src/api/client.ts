import { DEFAULT_BASE_URL } from '../constants.js';
import { ConnectionError, ValidationError } from '../utils/errors.js';
import type { Space, AnyObject, ObjectType, SearchResult, APIError, Tag } from './types.js';

/**
 * API response wrapper with pagination
 */
interface PaginatedResponse<T> {
  data: T[];
  pagination?: {
    total: number;
    offset: number;
    limit: number;
    has_more: boolean;
  };
}

/**
 * Build an endpoint path, appending query parameters if any exist.
 */
function buildEndpointWithParams(
  base: string,
  params: Record<string, string | number | undefined>,
): string {
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) queryParams.append(key, String(value));
  }
  return queryParams.size > 0 ? `${base}?${queryParams}` : base;
}

/**
 * Unwrap a response that may be either `{ [key]: T }` or `T` directly.
 * The Anytype API is inconsistent about wrapping single-resource responses.
 */
function unwrapResponse<T extends { id?: string; key?: string }>(
  response: Record<string, unknown>,
  key: string,
): T {
  if (key in response && response[key] && typeof response[key] === 'object') {
    const inner = response[key] as T;
    if (inner.id || inner.key) return inner;
  }
  return response as unknown as T;
}

/**
 * Typed API client for Anytype
 */
export class AnytypeClient {
  private baseURL: string;
  private apiKey: string;

  constructor(baseURL: string = DEFAULT_BASE_URL, apiKey: string) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
  }

  /**
   * Make an authenticated request to the Anytype API
   */
  private async request<T>(method: string, endpoint: string, body?: unknown): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        await this.handleHttpError(response, endpoint);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ValidationError) throw error;

      if (error instanceof TypeError) {
        throw new ConnectionError(
          `Failed to connect to Anytype. Ensure Anytype is running on ${DEFAULT_BASE_URL}`,
          error as Error,
        );
      }

      throw error;
    }
  }

  /**
   * Parse an error response and throw the appropriate error type.
   */
  private async handleHttpError(response: Response, endpoint: string): Promise<never> {
    const contentType = response.headers.get('content-type');
    let errorData: APIError | string = `HTTP ${response.status}`;

    if (contentType?.includes('application/json')) {
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }
    } else {
      errorData = await response.text();
    }

    if (response.status === 401) {
      throw new ValidationError('Invalid API key. Check your configuration.');
    }

    if (response.status === 404) {
      throw new ValidationError(`Not found: ${endpoint}`);
    }

    throw new ValidationError(
      `API error: ${typeof errorData === 'string' ? errorData : (errorData as APIError).message || JSON.stringify(errorData)}`,
    );
  }

  async getSpaces(): Promise<Space[]> {
    const response = await this.request<PaginatedResponse<Space>>('GET', '/v1/spaces');
    return response.data;
  }

  async getTypes(spaceId: string): Promise<ObjectType[]> {
    const response = await this.request<PaginatedResponse<ObjectType>>(
      'GET',
      `/v1/spaces/${spaceId}/types`,
    );
    return response.data;
  }

  async getTemplates(spaceId: string, typeId: string): Promise<AnyObject[]> {
    const response = await this.request<PaginatedResponse<AnyObject>>(
      'GET',
      `/v1/spaces/${spaceId}/types/${typeId}/templates`,
    );
    return response.data;
  }

  async getTemplate(spaceId: string, typeId: string, templateId: string): Promise<AnyObject> {
    const response = await this.request<Record<string, unknown>>(
      'GET',
      `/v1/spaces/${spaceId}/types/${typeId}/templates/${templateId}`,
    );
    return unwrapResponse<AnyObject>(response, 'template');
  }

  async getType(spaceId: string, typeId: string): Promise<ObjectType> {
    const response = await this.request<Record<string, unknown>>(
      'GET',
      `/v1/spaces/${spaceId}/types/${typeId}`,
    );
    return unwrapResponse<ObjectType>(response, 'type');
  }

  /**
   * Resolve a type by key or name, with fallback to listing all types.
   */
  async resolveType(spaceId: string, typeKey: string): Promise<ObjectType> {
    try {
      return await this.getType(spaceId, typeKey);
    } catch {
      // Fallback: list all types and match by key or name
    }

    const allTypes = await this.getTypes(spaceId);
    const keyLower = typeKey.toLowerCase();
    const match = allTypes.find(
      (t) => t.key.toLowerCase() === keyLower || t.name.toLowerCase() === keyLower,
    );

    if (!match) {
      throw new ValidationError(`Type "${typeKey}" not found.`);
    }

    try {
      return await this.getType(spaceId, match.id);
    } catch {
      return match;
    }
  }

  /**
   * Get objects in a space with optional filtering.
   * When filtering by type, uses the search endpoint as the objects
   * endpoint doesn't support type filtering via query params.
   */
  async getObjects(
    spaceId: string,
    filters?: {
      type_key?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<AnyObject[]> {
    if (filters?.type_key) {
      const endpoint = buildEndpointWithParams(`/v1/spaces/${spaceId}/search`, {
        limit: filters.limit,
        offset: filters.offset,
      });
      const body = { query: '', types: [filters.type_key] };
      const response = await this.request<PaginatedResponse<AnyObject>>('POST', endpoint, body);
      return response.data;
    }

    const endpoint = buildEndpointWithParams(`/v1/spaces/${spaceId}/objects`, {
      limit: filters?.limit,
      offset: filters?.offset,
    });
    const response = await this.request<PaginatedResponse<AnyObject>>('GET', endpoint);
    return response.data;
  }

  async getObject(
    spaceId: string,
    objectId: string,
    options?: { format?: 'markdown' },
  ): Promise<AnyObject> {
    const endpoint = buildEndpointWithParams(`/v1/spaces/${spaceId}/objects/${objectId}`, {
      format: options?.format,
    });
    const response = await this.request<{ object: AnyObject }>('GET', endpoint);
    return response.object;
  }

  async createObject(
    spaceId: string,
    data: {
      name: string;
      type_key: string;
      body?: string;
      template_id?: string;
      properties?: Array<{ key: string; [field: string]: unknown }>;
    },
  ): Promise<AnyObject> {
    const response = await this.request<Record<string, unknown>>(
      'POST',
      `/v1/spaces/${spaceId}/objects`,
      data,
    );
    return unwrapResponse<AnyObject>(response, 'object');
  }

  async updateObject(
    spaceId: string,
    objectId: string,
    data: Partial<{
      name: string;
      body: string;
      properties: Array<{ key: string; [field: string]: unknown }>;
    }>,
  ): Promise<AnyObject> {
    // The Anytype API accepts "body" for POST (create) but requires "markdown" for PATCH (update)
    const { body, ...rest } = data;
    const payload = body !== undefined ? { ...rest, markdown: body } : rest;

    const response = await this.request<Record<string, unknown>>(
      'PATCH',
      `/v1/spaces/${spaceId}/objects/${objectId}`,
      payload,
    );
    return unwrapResponse<AnyObject>(response, 'object');
  }

  async deleteObject(spaceId: string, objectId: string): Promise<void> {
    await this.request<void>('DELETE', `/v1/spaces/${spaceId}/objects/${objectId}`);
  }

  async search(
    query: string,
    filters?: {
      type_key?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<SearchResult[]> {
    const endpoint = buildEndpointWithParams('/v1/search', {
      limit: filters?.limit,
      offset: filters?.offset,
    });
    const body: Record<string, unknown> = { query };
    if (filters?.type_key) body.types = [filters.type_key];

    const response = await this.request<PaginatedResponse<SearchResult>>('POST', endpoint, body);
    return response.data;
  }

  async searchInSpace(
    spaceId: string,
    query: string,
    filters?: {
      type_key?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<AnyObject[]> {
    const endpoint = buildEndpointWithParams(`/v1/spaces/${spaceId}/search`, {
      limit: filters?.limit,
      offset: filters?.offset,
    });
    const body: Record<string, unknown> = { query };
    if (filters?.type_key) body.types = [filters.type_key];

    const response = await this.request<PaginatedResponse<AnyObject>>('POST', endpoint, body);
    return response.data;
  }

  async listTags(spaceId: string, propertyId: string): Promise<Tag[]> {
    const response = await this.request<PaginatedResponse<Tag>>(
      'GET',
      `/v1/spaces/${spaceId}/properties/${propertyId}/tags`,
    );
    return response.data;
  }

  async createTag(
    spaceId: string,
    propertyId: string,
    data: { name: string; color?: string },
  ): Promise<Tag> {
    const response = await this.request<Record<string, unknown>>(
      'POST',
      `/v1/spaces/${spaceId}/properties/${propertyId}/tags`,
      data,
    );
    return unwrapResponse<Tag>(response, 'tag');
  }
}
