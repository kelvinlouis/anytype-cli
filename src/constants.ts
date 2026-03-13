export const DEFAULT_BASE_URL = 'http://127.0.0.1:31009';
export const EMPTY_CELL = '-';
export const DEFAULT_DISPLAY_FIELDS = ['name', 'id', 'created_at', 'updated_at'];
export const DEFAULT_TAG_COLOR = 'grey';
export const DEFAULT_LIST_LIMIT = 100;
export const MAX_LIST_LIMIT = 1000;
export const LINKED_SEARCH_LIMIT = 10;
export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_SEARCH_LIMIT = 1000;
export const DEFAULT_SEARCH_OFFSET = 0;
export const NAME_LOOKUP_LIMIT = 100;
export const INLINE_OBJECT_KEY_THRESHOLD = 3;
export const MAX_CELL_LENGTH = 80;
export const MAX_SNIPPET_LENGTH = 80;
export const DATE_FIELDS = ['updated_at', 'updated_date', 'created_at', 'created_date'];
export const RESERVED_OBJECT_PROPERTIES = new Set([
  'links',
  'backlinks',
  'creator',
  'last_modified_by',
]);
