/**
 * API type definitions for Anytype endpoints
 */

/**
 * Space object from /v1/spaces
 */
export interface Space {
  id: string;
  name: string;
  icon?: string;
  is_favorite?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Object type from /v1/spaces/{space_id}/types
 */
export interface ObjectType {
  id: string;
  key: string;
  name: string;
  icon?: string;
  description?: string;
  properties?: Record<string, unknown>;
  layout?: string;
}

/**
 * Property definition for object types
 */
export interface PropertyDefinition {
  id: string;
  key: string;
  name: string;
  type: string;
  required?: boolean;
}

/**
 * Object from /v1/spaces/{space_id}/objects
 */
export interface AnyObject {
  id: string;
  name: string;
  icon?: string;
  type_key: string;
  body?: string;
  properties: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  relations?: Record<string, string[]>;
}

/**
 * Search result from /v1/search
 */
export interface SearchResult {
  id: string;
  name: string;
  type_key: string;
  icon?: string;
  snippet?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * API error response
 */
export interface APIError {
  error?: string;
  message?: string;
  code?: string;
  status?: number;
}
