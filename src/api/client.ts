import { ConnectionError, ValidationError } from '../utils/errors.js';
import type { Space, AnyObject, ObjectType, SearchResult, APIError } from './types.js';

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
 * Typed API client for Anytype
 */
export class AnytypeClient {
  private baseURL: string;
  private apiKey: string;

  constructor(baseURL: string = 'http://127.0.0.1:31009', apiKey: string) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
  }

  /**
   * Make an authenticated request to the Anytype API
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
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

        // Handle specific HTTP errors
        if (response.status === 401) {
          throw new ValidationError('Invalid API key. Check your configuration.');
        }

        if (response.status === 404) {
          throw new ValidationError(`Not found: ${endpoint}`);
        }

        throw new ValidationError(
          `API error: ${typeof errorData === 'string' ? errorData : (errorData as APIError).message || JSON.stringify(errorData)}`
        );
      }

      return await response.json() as T;
    } catch (error) {
      // Re-throw ValidationErrors as-is
      if (error instanceof ValidationError) {
        throw error;
      }

      // Network/connection errors
      if (error instanceof TypeError) {
        throw new ConnectionError(
          'Failed to connect to Anytype. Ensure Anytype is running on http://127.0.0.1:31009',
          error as Error
        );
      }

      throw error;
    }
  }

  /**
   * Get all spaces
   */
  async getSpaces(): Promise<Space[]> {
    const response = await this.request<PaginatedResponse<Space>>('GET', '/v1/spaces');
    return response.data;
  }

  /**
   * Get all types in a space
   */
  async getTypes(spaceId: string): Promise<ObjectType[]> {
    const response = await this.request<PaginatedResponse<ObjectType>>('GET', `/v1/spaces/${spaceId}/types`);
    return response.data;
  }

  /**
   * Get objects in a space with optional filtering
   * Note: When filtering by type, uses the search endpoint as the objects
   * endpoint doesn't support type filtering via query params
   */
  async getObjects(
    spaceId: string,
    filters?: {
      type_key?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<AnyObject[]> {
    // If filtering by type, use the search endpoint
    if (filters?.type_key) {
      const queryParams = new URLSearchParams();
      if (filters.limit) queryParams.append('limit', String(filters.limit));
      if (filters.offset) queryParams.append('offset', String(filters.offset));

      const endpoint = queryParams.size > 0
        ? `/v1/spaces/${spaceId}/search?${queryParams}`
        : `/v1/spaces/${spaceId}/search`;

      const body = {
        query: '',
        types: [filters.type_key],
      };

      const response = await this.request<PaginatedResponse<AnyObject>>('POST', endpoint, body);
      return response.data;
    }

    // No type filter - use the objects endpoint
    const queryParams = new URLSearchParams();
    if (filters?.limit) queryParams.append('limit', String(filters.limit));
    if (filters?.offset) queryParams.append('offset', String(filters.offset));

    const endpoint =
      queryParams.size > 0
        ? `/v1/spaces/${spaceId}/objects?${queryParams}`
        : `/v1/spaces/${spaceId}/objects`;

    const response = await this.request<PaginatedResponse<AnyObject>>('GET', endpoint);
    return response.data;
  }

  /**
   * Get a single object
   */
  async getObject(spaceId: string, objectId: string, options?: { format?: 'markdown' }): Promise<AnyObject> {
    const queryParams = new URLSearchParams();
    if (options?.format) queryParams.append('format', options.format);

    const endpoint = queryParams.size > 0
      ? `/v1/spaces/${spaceId}/objects/${objectId}?${queryParams}`
      : `/v1/spaces/${spaceId}/objects/${objectId}`;

    const response = await this.request<{ object: AnyObject }>('GET', endpoint);
    return response.object;
  }

  /**
   * Create an object
   */
  async createObject(
    spaceId: string,
    data: {
      name: string;
      type_key: string;
      body?: string;
      properties?: Record<string, unknown>;
    }
  ): Promise<AnyObject> {
    return this.request<AnyObject>('POST', `/v1/spaces/${spaceId}/objects`, data);
  }

  /**
   * Update an object
   */
  async updateObject(
    spaceId: string,
    objectId: string,
    data: Partial<{
      name: string;
      body: string;
      properties: Record<string, unknown>;
    }>
  ): Promise<AnyObject> {
    return this.request<AnyObject>(
      'PATCH',
      `/v1/spaces/${spaceId}/objects/${objectId}`,
      data
    );
  }

  /**
   * Archive an object
   */
  async deleteObject(spaceId: string, objectId: string): Promise<void> {
    await this.request<void>('DELETE', `/v1/spaces/${spaceId}/objects/${objectId}`);
  }

  /**
   * Global search
   */
  async search(
    query: string,
    filters?: {
      type_key?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<SearchResult[]> {
    const queryParams = new URLSearchParams();
    if (filters?.limit) queryParams.append('limit', String(filters.limit));
    if (filters?.offset) queryParams.append('offset', String(filters.offset));

    const endpoint = queryParams.size > 0 ? `/v1/search?${queryParams}` : '/v1/search';

    const body: Record<string, unknown> = { query };
    if (filters?.type_key) body.types = [filters.type_key];

    const response = await this.request<PaginatedResponse<SearchResult>>('POST', endpoint, body);
    return response.data;
  }

  /**
   * Search within a specific space
   */
  async searchInSpace(
    spaceId: string,
    query: string,
    filters?: {
      type_key?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<AnyObject[]> {
    const queryParams = new URLSearchParams();
    if (filters?.limit) queryParams.append('limit', String(filters.limit));
    if (filters?.offset) queryParams.append('offset', String(filters.offset));

    const endpoint = queryParams.size > 0
      ? `/v1/spaces/${spaceId}/search?${queryParams}`
      : `/v1/spaces/${spaceId}/search`;

    const body: Record<string, unknown> = { query };
    if (filters?.type_key) body.types = [filters.type_key];

    const response = await this.request<PaginatedResponse<AnyObject>>('POST', endpoint, body);
    return response.data;
  }
}
