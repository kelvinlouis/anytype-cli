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
 * Property associated with a type from the types API
 */
export interface TypeProperty {
  object: 'property';
  id: string;
  key: string;
  name: string;
  format: string;
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
  properties?: TypeProperty[];
  layout?: string;
}

/**
 * Property value from API
 */
export interface PropertyValue {
  object: 'property';
  id: string;
  key: string;
  name: string;
  format: string;
  // For format: "objects" (links, backlinks, etc.)
  objects?: string[];
  // For format: "text"
  text?: string;
  // For format: "number"
  number?: number;
  // For format: "date"
  date?: string;
  // For format: "select"
  select?: { id: string; key: string; name: string; color?: string };
  // For format: "multi_select"
  multi_select?: { id: string; key: string; name: string; color?: string }[];
}

/**
 * Object from /v1/spaces/{space_id}/objects
 */
export interface AnyObject {
  id: string;
  name: string;
  icon?: unknown;
  type?: {
    key: string;
    name: string;
    [key: string]: unknown;
  };
  type_key?: string; // Fallback for backwards compatibility
  snippet?: string;
  body?: string;
  markdown?: string;
  properties?: PropertyValue[];
  created_at?: string;
  updated_at?: string;
  space_id?: string;
  archived?: boolean;
  layout?: string;
}

/**
 * Search result from /v1/search
 */
export interface SearchResult {
  id: string;
  name: string;
  type_key?: string;
  type?: {
    key: string;
    name: string;
    [key: string]: unknown;
  };
  icon?: unknown;
  snippet?: string;
  properties?: PropertyValue[];
  created_at?: string;
  updated_at?: string;
  space_id?: string;
}

/**
 * Tag for select/multi_select properties
 */
export interface Tag {
  id: string;
  key?: string;
  name: string;
  color?: string;
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
