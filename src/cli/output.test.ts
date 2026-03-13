import { describe, it, expect } from 'vitest';
import {
  resolveFieldValue,
  resolveRawFieldValue,
  truncateCell,
  formatObjectsAsMarkdown,
  formatTypeDetailAsMarkdown,
  formatTypesAsMarkdown,
} from './output.js';
import type { AnyObject, ObjectType } from '../api/types.js';

function makeObject(overrides: Partial<AnyObject> = {}): AnyObject {
  return {
    id: 'obj-1',
    name: 'Test Object',
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2025-06-10T00:00:00Z',
    properties: [],
    ...overrides,
  };
}

describe('Computed fields', () => {
  const objWithLinks = makeObject({
    properties: [
      {
        object: 'property',
        id: 'p1',
        key: 'links',
        name: 'Links',
        format: 'objects',
        objects: ['a', 'b', 'c'],
      },
      {
        object: 'property',
        id: 'p2',
        key: 'backlinks',
        name: 'Backlinks',
        format: 'objects',
        objects: ['x'],
      },
    ],
  });

  const objNoLinks = makeObject({
    properties: [
      {
        object: 'property',
        id: 'p1',
        key: 'links',
        name: 'Links',
        format: 'objects',
        objects: [],
      },
    ],
  });

  const objNoProperties = makeObject({ properties: [] });

  describe('resolveFieldValue', () => {
    it('should return link_count from links property', () => {
      expect(resolveFieldValue(objWithLinks, 'link_count')).toBe('3');
    });

    it('should return backlink_count from backlinks property', () => {
      expect(resolveFieldValue(objWithLinks, 'backlink_count')).toBe('1');
    });

    it('should return 0 when links property has empty objects array', () => {
      expect(resolveFieldValue(objNoLinks, 'link_count')).toBe('0');
    });

    it('should return 0 when no matching property exists', () => {
      expect(resolveFieldValue(objNoProperties, 'link_count')).toBe('0');
      expect(resolveFieldValue(objNoProperties, 'backlink_count')).toBe('0');
    });
  });

  describe('resolveRawFieldValue', () => {
    it('should return link_count as a number', () => {
      const val = resolveRawFieldValue(objWithLinks, 'link_count');
      expect(val).toBe(3);
      expect(typeof val).toBe('number');
    });

    it('should return backlink_count as a number', () => {
      const val = resolveRawFieldValue(objWithLinks, 'backlink_count');
      expect(val).toBe(1);
      expect(typeof val).toBe('number');
    });

    it('should return 0 as number when no links', () => {
      expect(resolveRawFieldValue(objNoProperties, 'link_count')).toBe(0);
    });
  });
});

describe('truncateCell', () => {
  it('should return short strings unchanged', () => {
    expect(truncateCell('hello')).toBe('hello');
  });

  it('should collapse newlines into spaces', () => {
    expect(truncateCell('line1\nline2\nline3')).toBe('line1 line2 line3');
  });

  it('should escape pipe characters', () => {
    expect(truncateCell('a | b | c')).toBe('a \\| b \\| c');
  });

  it('should truncate long strings with ellipsis', () => {
    const long = 'a'.repeat(100);
    const result = truncateCell(long);
    expect(result.length).toBe(80);
    expect(result.endsWith('...')).toBe(true);
  });

  it('should respect custom maxLength', () => {
    const result = truncateCell('a'.repeat(50), 20);
    expect(result.length).toBe(20);
    expect(result.endsWith('...')).toBe(true);
  });

  it('should not truncate strings at exactly maxLength', () => {
    const exact = 'a'.repeat(80);
    expect(truncateCell(exact)).toBe(exact);
  });

  it('should handle combined newlines, pipes, and long text', () => {
    const input = 'first line\nsecond | line\n' + 'x'.repeat(100);
    const result = truncateCell(input);
    expect(result).not.toContain('\n');
    // Pipes should be escaped (preceded by backslash), not bare
    expect(result).not.toMatch(/(?<!\\)\|/);
    expect(result.length).toBe(80);
    expect(result.endsWith('...')).toBe(true);
  });
});

describe('formatObjectsAsMarkdown with truncation', () => {
  it('should truncate long field values in table output', () => {
    const obj = makeObject({ name: 'a'.repeat(100) });
    const result = formatObjectsAsMarkdown([obj], ['name']);
    const rows = result.split('\n');
    // header + separator + 1 data row
    expect(rows).toHaveLength(3);
    const dataRow = rows[2];
    // The cell value should be truncated
    expect(dataRow).toContain('...');
  });

  it('should escape pipes in field values', () => {
    const obj = makeObject({ name: 'foo | bar' });
    const result = formatObjectsAsMarkdown([obj], ['name']);
    // The pipe in the value should be escaped
    expect(result).toContain('foo \\| bar');
  });

  it('should include computed fields in table output', () => {
    const obj = makeObject({
      properties: [
        {
          object: 'property',
          id: 'p1',
          key: 'links',
          name: 'Links',
          format: 'objects',
          objects: ['a', 'b'],
        },
      ],
    });
    const result = formatObjectsAsMarkdown([obj], ['name', 'link_count']);
    expect(result).toContain('Link Count');
    expect(result).toContain('2');
  });
});

describe('formatTypeDetailAsMarkdown', () => {
  it('should render type name, key, and layout', () => {
    const type: ObjectType = {
      id: 'type-1',
      key: 'note',
      name: 'Note',
      layout: 'basic',
      properties: [],
    };
    const result = formatTypeDetailAsMarkdown(type);
    expect(result).toContain('# Note');
    expect(result).toContain('**Key:** `note`');
    expect(result).toContain('**Layout:** basic');
  });

  it('should render properties table', () => {
    const type: ObjectType = {
      id: 'type-1',
      key: 'note',
      name: 'Note',
      properties: [
        { object: 'property', id: 'p1', key: 'description', name: 'Description', format: 'text' },
        { object: 'property', id: 'p2', key: 'priority', name: 'Priority', format: 'select' },
        { object: 'property', id: 'p3', key: 'done', name: 'Done', format: 'checkbox' },
      ],
    };
    const result = formatTypeDetailAsMarkdown(type);
    expect(result).toContain('## Properties (3)');
    expect(result).toContain('| Description | `description` | text |');
    expect(result).toContain('| Priority | `priority` | select |');
    expect(result).toContain('| Done | `done` | checkbox |');
  });

  it('should render usage examples excluding system properties', () => {
    const type: ObjectType = {
      id: 'type-1',
      key: 'note',
      name: 'Note',
      properties: [
        { object: 'property', id: 'p0', key: 'name', name: 'Name', format: 'text' },
        { object: 'property', id: 'p1', key: 'description', name: 'Description', format: 'text' },
        { object: 'property', id: 'p2', key: 'links', name: 'Links', format: 'objects' },
      ],
    };
    const result = formatTypeDetailAsMarkdown(type);
    expect(result).toContain('## Usage');
    expect(result).toContain('anyt create note "Name" --property description="example value"');
    expect(result).toContain('anyt list note --where description=value');
    expect(result).toContain('anyt list note --fields name,description');
  });

  it('should show message when no properties', () => {
    const type: ObjectType = {
      id: 'type-1',
      key: 'empty',
      name: 'Empty',
      properties: [],
    };
    const result = formatTypeDetailAsMarkdown(type);
    expect(result).toContain('No properties found for this type.');
  });

  it('should handle undefined properties', () => {
    const type: ObjectType = {
      id: 'type-1',
      key: 'empty',
      name: 'Empty',
    };
    const result = formatTypeDetailAsMarkdown(type);
    expect(result).toContain('No properties found for this type.');
  });
});

describe('formatTypesAsMarkdown property count', () => {
  it('should count properties from array', () => {
    const types: ObjectType[] = [
      {
        id: 'type-1',
        key: 'note',
        name: 'Note',
        properties: [
          { object: 'property', id: 'p1', key: 'desc', name: 'Desc', format: 'text' },
          { object: 'property', id: 'p2', key: 'done', name: 'Done', format: 'checkbox' },
        ],
      },
    ];
    const result = formatTypesAsMarkdown(types);
    expect(result).toContain('| Note | `note` | 2 |');
  });

  it('should handle empty properties', () => {
    const types: ObjectType[] = [{ id: 'type-1', key: 'empty', name: 'Empty', properties: [] }];
    const result = formatTypesAsMarkdown(types);
    expect(result).toContain('| Empty | `empty` | 0 |');
  });
});
