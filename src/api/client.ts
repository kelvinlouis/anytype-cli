import { ConnectionError, ValidationError } from '../utils/errors.js';
import type { Space, AnyObject, ObjectType, SearchResult, APIError } from './types.js';

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
    return this.request<Space[]>('GET', '/v1/spaces');
  }

  /**
   * Get all types in a space
   */
  async getTypes(spaceId: string): Promise<ObjectType[]> {
    return this.request<ObjectType[]>('GET', `/v1/spaces/${spaceId}/types`);
  }

  /**
   * Get objects in a space with optional filtering
   */
  async getObjects(
    spaceId: string,
    filters?: {
      type_key?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<AnyObject[]> {
    const queryParams = new URLSearchParams();
    if (filters?.type_key) queryParams.append('type_key', filters.type_key);
    if (filters?.limit) queryParams.append('limit', String(filters.limit));
    if (filters?.offset) queryParams.append('offset', String(filters.offset));

    const endpoint =
      queryParams.size > 0
        ? `/v1/spaces/${spaceId}/objects?${queryParams}`
        : `/v1/spaces/${spaceId}/objects`;

    return this.request<AnyObject[]>('GET', endpoint);
  }

  /**
   * Get a single object
   */
  async getObject(spaceId: string, objectId: string): Promise<AnyObject> {
    return this.request<AnyObject>('GET', `/v1/spaces/${spaceId}/objects/${objectId}`);
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
    queryParams.append('query', query);
    if (filters?.type_key) queryParams.append('type_key', filters.type_key);
    if (filters?.limit) queryParams.append('limit', String(filters.limit));
    if (filters?.offset) queryParams.append('offset', String(filters.offset));

    return this.request<SearchResult[]>('POST', `/v1/search?${queryParams}`);
  }
}
