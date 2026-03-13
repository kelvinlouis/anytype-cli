/**
 * Configuration schema
 */
export interface ConfigSchema {
  apiKey?: string;
  defaultSpace?: string;
  aliases?: Record<string, string>;
  typeFields?: Record<string, string[]>;
  baseURL?: string;
}
