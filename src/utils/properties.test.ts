import { describe, it, expect, vi } from 'vitest';
import {
  parsePropertyFlag,
  buildPropertyPayload,
  collectProperty,
  toPropertyPayloads,
  resolveTagProperties,
} from './properties.js';
import type { AnytypeClient } from '../api/client.js';
import type { TypeProperty } from '../api/types.js';

describe('parsePropertyFlag', () => {
  it('should parse simple key=value', () => {
    expect(parsePropertyFlag('tag=test')).toEqual({
      key: 'tag',
      type: undefined,
      value: 'test',
    });
  });

  it('should parse key:type=value', () => {
    expect(parsePropertyFlag('done:checkbox=true')).toEqual({
      key: 'done',
      type: 'checkbox',
      value: 'true',
    });
  });

  it('should handle values containing = signs', () => {
    expect(parsePropertyFlag('url=https://example.com?a=1&b=2')).toEqual({
      key: 'url',
      type: undefined,
      value: 'https://example.com?a=1&b=2',
    });
  });

  it('should handle values containing colons', () => {
    expect(parsePropertyFlag('url:url=https://example.com')).toEqual({
      key: 'url',
      type: 'url',
      value: 'https://example.com',
    });
  });

  it('should throw on missing =', () => {
    expect(() => parsePropertyFlag('noequals')).toThrow();
  });

  it('should throw on empty key', () => {
    expect(() => parsePropertyFlag('=value')).toThrow();
  });

  it('should throw on empty key with type', () => {
    expect(() => parsePropertyFlag(':text=value')).toThrow();
  });

  it('should throw on empty type', () => {
    expect(() => parsePropertyFlag('key:=value')).toThrow();
  });

  it('should allow empty value', () => {
    expect(parsePropertyFlag('key=')).toEqual({
      key: 'key',
      type: undefined,
      value: '',
    });
  });
});

describe('buildPropertyPayload - auto-detection', () => {
  it('should detect checkbox for true', () => {
    const result = buildPropertyPayload({ key: 'done', type: undefined, value: 'true' });
    expect(result).toEqual({ key: 'done', checkbox: true });
  });

  it('should detect checkbox for false', () => {
    const result = buildPropertyPayload({ key: 'done', type: undefined, value: 'false' });
    expect(result).toEqual({ key: 'done', checkbox: false });
  });

  it('should detect checkbox for yes (case-insensitive)', () => {
    expect(buildPropertyPayload({ key: 'done', type: undefined, value: 'yes' })).toEqual({
      key: 'done',
      checkbox: true,
    });
    expect(buildPropertyPayload({ key: 'done', type: undefined, value: 'Yes' })).toEqual({
      key: 'done',
      checkbox: true,
    });
    expect(buildPropertyPayload({ key: 'done', type: undefined, value: 'YES' })).toEqual({
      key: 'done',
      checkbox: true,
    });
  });

  it('should detect checkbox for no (case-insensitive)', () => {
    expect(buildPropertyPayload({ key: 'done', type: undefined, value: 'no' })).toEqual({
      key: 'done',
      checkbox: false,
    });
    expect(buildPropertyPayload({ key: 'done', type: undefined, value: 'No' })).toEqual({
      key: 'done',
      checkbox: false,
    });
  });

  it('should detect number for integers', () => {
    const result = buildPropertyPayload({ key: 'count', type: undefined, value: '42' });
    expect(result).toEqual({ key: 'count', number: 42 });
  });

  it('should detect number for decimals', () => {
    const result = buildPropertyPayload({ key: 'price', type: undefined, value: '9.99' });
    expect(result).toEqual({ key: 'price', number: 9.99 });
  });

  it('should detect number for negative values', () => {
    const result = buildPropertyPayload({ key: 'offset', type: undefined, value: '-5' });
    expect(result).toEqual({ key: 'offset', number: -5 });
  });

  it('should detect url for http URLs', () => {
    const result = buildPropertyPayload({
      key: 'link',
      type: undefined,
      value: 'https://example.com',
    });
    expect(result).toEqual({ key: 'link', url: 'https://example.com' });
  });

  it('should detect email', () => {
    const result = buildPropertyPayload({
      key: 'contact',
      type: undefined,
      value: 'user@example.com',
    });
    expect(result).toEqual({ key: 'contact', email: 'user@example.com' });
  });

  it('should detect ISO date', () => {
    const result = buildPropertyPayload({ key: 'due', type: undefined, value: '2024-01-15' });
    expect(result).toEqual({ key: 'due', date: '2024-01-15' });
  });

  it('should detect ISO datetime', () => {
    const result = buildPropertyPayload({ key: 'due', type: undefined, value: '2024-01-15T10:30' });
    expect(result).toEqual({ key: 'due', date: '2024-01-15T10:30' });
  });

  it('should fall back to text for plain strings', () => {
    const result = buildPropertyPayload({ key: 'tag', type: undefined, value: 'important' });
    expect(result).toEqual({ key: 'tag', text: 'important' });
  });
});

describe('buildPropertyPayload - explicit types', () => {
  it('should use text when explicitly set', () => {
    const result = buildPropertyPayload({ key: 'note', type: 'text', value: '42' });
    expect(result).toEqual({ key: 'note', text: '42' });
  });

  it('should use number when explicitly set', () => {
    const result = buildPropertyPayload({ key: 'count', type: 'number', value: '42' });
    expect(result).toEqual({ key: 'count', number: 42 });
  });

  it('should use checkbox when explicitly set', () => {
    const result = buildPropertyPayload({ key: 'done', type: 'checkbox', value: '1' });
    expect(result).toEqual({ key: 'done', checkbox: true });
  });

  it('should accept yes/Yes/YES as truthy for explicit checkbox', () => {
    expect(buildPropertyPayload({ key: 'done', type: 'checkbox', value: 'yes' })).toEqual({
      key: 'done',
      checkbox: true,
    });
    expect(buildPropertyPayload({ key: 'done', type: 'checkbox', value: 'Yes' })).toEqual({
      key: 'done',
      checkbox: true,
    });
    expect(buildPropertyPayload({ key: 'done', type: 'checkbox', value: 'YES' })).toEqual({
      key: 'done',
      checkbox: true,
    });
  });

  it('should accept true/True/TRUE as truthy for explicit checkbox', () => {
    expect(buildPropertyPayload({ key: 'done', type: 'checkbox', value: 'True' })).toEqual({
      key: 'done',
      checkbox: true,
    });
    expect(buildPropertyPayload({ key: 'done', type: 'checkbox', value: 'TRUE' })).toEqual({
      key: 'done',
      checkbox: true,
    });
  });

  it('should use checkbox false for non-true values', () => {
    const result = buildPropertyPayload({ key: 'done', type: 'checkbox', value: '0' });
    expect(result).toEqual({ key: 'done', checkbox: false });
  });

  it('should accept no/No/false as falsy for explicit checkbox', () => {
    expect(buildPropertyPayload({ key: 'done', type: 'checkbox', value: 'no' })).toEqual({
      key: 'done',
      checkbox: false,
    });
    expect(buildPropertyPayload({ key: 'done', type: 'checkbox', value: 'No' })).toEqual({
      key: 'done',
      checkbox: false,
    });
    expect(buildPropertyPayload({ key: 'done', type: 'checkbox', value: 'false' })).toEqual({
      key: 'done',
      checkbox: false,
    });
  });

  it('should use date when explicitly set', () => {
    const result = buildPropertyPayload({ key: 'due', type: 'date', value: '2024-01-15' });
    expect(result).toEqual({ key: 'due', date: '2024-01-15' });
  });

  it('should use url when explicitly set', () => {
    const result = buildPropertyPayload({ key: 'site', type: 'url', value: 'https://example.com' });
    expect(result).toEqual({ key: 'site', url: 'https://example.com' });
  });

  it('should use email when explicitly set', () => {
    const result = buildPropertyPayload({ key: 'mail', type: 'email', value: 'a@b.com' });
    expect(result).toEqual({ key: 'mail', email: 'a@b.com' });
  });

  it('should use phone when explicitly set', () => {
    const result = buildPropertyPayload({ key: 'tel', type: 'phone', value: '+1234567890' });
    expect(result).toEqual({ key: 'tel', phone: '+1234567890' });
  });

  it('should use select when explicitly set', () => {
    const result = buildPropertyPayload({ key: 'priority', type: 'select', value: 'high' });
    expect(result).toEqual({ key: 'priority', select: 'high' });
  });

  it('should split multi_select by comma', () => {
    const result = buildPropertyPayload({ key: 'tags', type: 'multi_select', value: 'a, b, c' });
    expect(result).toEqual({ key: 'tags', multi_select: ['a', 'b', 'c'] });
  });

  it('should split objects by comma', () => {
    const result = buildPropertyPayload({ key: 'related', type: 'objects', value: 'id1,id2' });
    expect(result).toEqual({ key: 'related', objects: ['id1', 'id2'] });
  });

  it('should split files by comma', () => {
    const result = buildPropertyPayload({ key: 'attachments', type: 'files', value: 'f1, f2' });
    expect(result).toEqual({ key: 'attachments', files: ['f1', 'f2'] });
  });

  it('should throw on unknown type', () => {
    expect(() => buildPropertyPayload({ key: 'x', type: 'unknown', value: 'y' })).toThrow(
      'Unknown property type "unknown"',
    );
  });
});

describe('collectProperty', () => {
  it('should accumulate parsed properties', () => {
    let result = collectProperty('tag=test', []);
    result = collectProperty('done:checkbox=true', result);
    expect(result).toEqual([
      { key: 'tag', type: undefined, value: 'test' },
      { key: 'done', type: 'checkbox', value: 'true' },
    ]);
  });
});

describe('toPropertyPayloads', () => {
  it('should convert parsed properties to API payloads', () => {
    const parsed = [
      { key: 'tag', type: undefined as string | undefined, value: 'test' },
      { key: 'done', type: 'checkbox' as string | undefined, value: 'true' },
      { key: 'url', type: undefined as string | undefined, value: 'https://example.com' },
    ];
    const result = toPropertyPayloads(parsed);
    expect(result).toEqual([
      { key: 'tag', text: 'test' },
      { key: 'done', checkbox: true },
      { key: 'url', url: 'https://example.com' },
    ]);
  });

  it('should merge repeated same-key multi_select properties', () => {
    const schema = new Map([['tag', 'multi_select']]);
    const parsed = [
      { key: 'tag', type: undefined as string | undefined, value: 'frontend' },
      { key: 'tag', type: undefined as string | undefined, value: 'react' },
      { key: 'url', type: undefined as string | undefined, value: 'https://example.com' },
    ];
    const result = toPropertyPayloads(parsed, schema);
    expect(result).toEqual([
      { key: 'tag', multi_select: ['frontend', 'react'] },
      { key: 'url', url: 'https://example.com' },
    ]);
  });

  it('should merge repeated multi_select with comma-separated values', () => {
    const schema = new Map([['tag', 'multi_select']]);
    const parsed = [
      { key: 'tag', type: undefined as string | undefined, value: 'frontend,react' },
      { key: 'tag', type: undefined as string | undefined, value: 'typescript' },
    ];
    const result = toPropertyPayloads(parsed, schema);
    expect(result).toEqual([{ key: 'tag', multi_select: ['frontend', 'react', 'typescript'] }]);
  });
});

describe('resolveTagProperties', () => {
  const existingTags = [
    { id: 'tag-id-1', key: 'key-1', name: '⭐' },
    { id: 'tag-id-5', key: 'key-5', name: '⭐⭐⭐⭐⭐' },
  ];

  const ratingProp: TypeProperty = {
    object: 'property',
    id: 'prop-rating',
    key: 'rating',
    name: 'Rating',
    format: 'select',
  };

  const tagProp: TypeProperty = {
    object: 'property',
    id: 'prop-tag',
    key: 'tag',
    name: 'Tag',
    format: 'multi_select',
  };

  function mockClient(tags: typeof existingTags) {
    return {
      listTags: vi.fn().mockResolvedValue(tags),
      createTag: vi.fn().mockResolvedValue({ id: 'new-tag-id', name: 'new' }),
    } as unknown as AnytypeClient;
  }

  it('should resolve select tag by name', async () => {
    const client = mockClient(existingTags);
    const result = await resolveTagProperties(
      [{ key: 'rating', select: '⭐⭐⭐⭐⭐' }],
      [ratingProp],
      client,
      'space-1',
    );
    expect(result).toEqual([{ key: 'rating', select: 'tag-id-5' }]);
  });

  it('should resolve select tag by id', async () => {
    const client = mockClient(existingTags);
    const result = await resolveTagProperties(
      [{ key: 'rating', select: 'tag-id-1' }],
      [ratingProp],
      client,
      'space-1',
    );
    expect(result).toEqual([{ key: 'rating', select: 'tag-id-1' }]);
  });

  it('should resolve select tag by key', async () => {
    const client = mockClient(existingTags);
    const result = await resolveTagProperties(
      [{ key: 'rating', select: 'key-5' }],
      [ratingProp],
      client,
      'space-1',
    );
    expect(result).toEqual([{ key: 'rating', select: 'tag-id-5' }]);
  });

  it('should throw for invalid select value with available options', async () => {
    const client = mockClient(existingTags);
    await expect(
      resolveTagProperties([{ key: 'rating', select: '5' }], [ratingProp], client, 'space-1'),
    ).rejects.toThrow('Invalid value "5" for select property "Rating"');
  });

  it('should include available options in select error message', async () => {
    const client = mockClient(existingTags);
    await expect(
      resolveTagProperties([{ key: 'rating', select: 'invalid' }], [ratingProp], client, 'space-1'),
    ).rejects.toThrow('⭐, ⭐⭐⭐⭐⭐');
  });

  it('should auto-create tags for multi_select', async () => {
    const client = mockClient([]);
    const result = await resolveTagProperties(
      [{ key: 'tag', multi_select: ['new-tag'] }],
      [tagProp],
      client,
      'space-1',
    );
    expect(result).toEqual([{ key: 'tag', multi_select: ['new-tag-id'] }]);
    expect(client.createTag).toHaveBeenCalled();
  });

  it('should not auto-create tags for select', async () => {
    const client = mockClient([]);
    await expect(
      resolveTagProperties(
        [{ key: 'rating', select: 'nonexistent' }],
        [ratingProp],
        client,
        'space-1',
      ),
    ).rejects.toThrow('Invalid value');
    expect(client.createTag).not.toHaveBeenCalled();
  });
});
