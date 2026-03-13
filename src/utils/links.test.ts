import { describe, it, expect } from 'vitest';
import type { TypeProperty } from '../api/types.js';
import { getSettableLinkProperties, resolveLinkProperty } from './links.js';

function prop(key: string, format: string, name = key): TypeProperty {
  return { object: 'property', id: `id-${key}`, key, name, format };
}

const systemProps: TypeProperty[] = [
  prop('links', 'objects', 'Links'),
  prop('backlinks', 'objects', 'Backlinks'),
  prop('creator', 'objects', 'Created by'),
  prop('last_modified_by', 'objects', 'Last modified by'),
];

describe('getSettableLinkProperties', () => {
  it('should filter out reserved system properties', () => {
    const properties = [...systemProps, prop('assignee', 'objects', 'Assignee')];
    const result = getSettableLinkProperties(properties);
    expect(result).toEqual([prop('assignee', 'objects', 'Assignee')]);
  });

  it('should ignore non-objects format properties', () => {
    const properties = [
      ...systemProps,
      prop('tag', 'multi_select', 'Tag'),
      prop('description', 'text', 'Description'),
    ];
    const result = getSettableLinkProperties(properties);
    expect(result).toEqual([]);
  });

  it('should return multiple settable properties', () => {
    const properties = [
      ...systemProps,
      prop('assignee', 'objects', 'Assignee'),
      prop('linked_projects', 'objects', 'Linked Projects'),
    ];
    const result = getSettableLinkProperties(properties);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.key)).toEqual(['assignee', 'linked_projects']);
  });
});

describe('resolveLinkProperty', () => {
  it('should return the single candidate when exactly one exists', () => {
    const properties = [...systemProps, prop('assignee', 'objects', 'Assignee')];
    const result = resolveLinkProperty(properties);
    expect(result.key).toBe('assignee');
  });

  it('should throw when no settable object properties exist', () => {
    expect(() => resolveLinkProperty(systemProps)).toThrow(
      'This type has no settable object properties',
    );
  });

  it('should throw listing options when multiple candidates exist', () => {
    const properties = [
      ...systemProps,
      prop('assignee', 'objects', 'Assignee'),
      prop('linked_projects', 'objects', 'Linked Projects'),
    ];
    expect(() => resolveLinkProperty(properties)).toThrow('--link-property <key>');
    expect(() => resolveLinkProperty(properties)).toThrow('assignee');
    expect(() => resolveLinkProperty(properties)).toThrow('linked_projects');
  });

  it('should return the explicitly named property', () => {
    const properties = [
      ...systemProps,
      prop('assignee', 'objects', 'Assignee'),
      prop('linked_projects', 'objects', 'Linked Projects'),
    ];
    const result = resolveLinkProperty(properties, 'linked_projects');
    expect(result.key).toBe('linked_projects');
  });

  it('should throw when explicit key does not match any candidate', () => {
    const properties = [...systemProps, prop('assignee', 'objects', 'Assignee')];
    expect(() => resolveLinkProperty(properties, 'nonexistent')).toThrow(
      'not a settable object property',
    );
  });

  it('should throw when explicit key matches a reserved property', () => {
    expect(() => resolveLinkProperty(systemProps, 'links')).toThrow(
      'not a settable object property',
    );
  });
});
