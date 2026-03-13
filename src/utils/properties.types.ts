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
