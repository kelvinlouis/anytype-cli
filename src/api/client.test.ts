import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnytypeClient } from './client.js';
import { ConnectionError, ValidationError } from '../utils/errors.js';

global.fetch = vi.fn();

function mockFetchResponse(data: unknown) {
  (global.fetch as any).mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  });
}

function mockFetchError(status: number, body: unknown) {
  (global.fetch as any).mockResolvedValueOnce({
    ok: false,
    status,
    headers: new Map([['content-type', 'application/json']]),
    json: async () => body,
  });
}

describe('AnytypeClient', () => {
  const baseURL = 'http://127.0.0.1:31009';
  const apiKey = 'test-api-key';
  let client: AnytypeClient;

  beforeEach(() => {
    client = new AnytypeClient(baseURL, apiKey);
  });

  describe('getSpaces', () => {
    it('should return spaces from the API', async () => {
      const mockSpaces = [
        { id: 'space1', name: 'Space 1' },
        { id: 'space2', name: 'Space 2' },
      ];
      mockFetchResponse({ data: mockSpaces });

      const result = await client.getSpaces();

      expect(result).toEqual(mockSpaces);
    });

    it('should call the correct endpoint', async () => {
      mockFetchResponse({ data: [] });

      await client.getSpaces();

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/v1/spaces`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should throw ConnectionError on network failure', async () => {
      (global.fetch as any).mockRejectedValueOnce(new TypeError('Network error'));

      await expect(client.getSpaces()).rejects.toThrow(ConnectionError);
    });

    it('should throw ValidationError on 401', async () => {
      mockFetchError(401, { message: 'Unauthorized' });

      await expect(client.getSpaces()).rejects.toThrow(ValidationError);
    });
  });

  describe('getTypes', () => {
    it('should return types for a space', async () => {
      const mockTypes = [
        { key: 'type1', name: 'Type 1' },
        { key: 'type2', name: 'Type 2' },
      ];
      mockFetchResponse({ data: mockTypes });

      const result = await client.getTypes('space1');

      expect(result).toEqual(mockTypes);
    });

    it('should call the correct endpoint', async () => {
      mockFetchResponse({ data: [] });

      await client.getTypes('space1');

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/v1/spaces/space1/types`,
        expect.any(Object),
      );
    });
  });

  describe('getType', () => {
    it('should unwrap a wrapped response', async () => {
      const mockType = { id: 'type-id-1', key: 'note', name: 'Note', properties: [] };
      mockFetchResponse({ type: mockType });

      const result = await client.getType('space1', 'note');

      expect(result).toEqual(mockType);
    });

    it('should handle unwrapped response shape', async () => {
      const mockType = { id: 'type-id-1', key: 'note', name: 'Note', properties: [] };
      mockFetchResponse(mockType);

      const result = await client.getType('space1', 'note');

      expect(result).toEqual(mockType);
    });

    it('should throw ValidationError on 404', async () => {
      mockFetchError(404, { message: 'Not found' });

      await expect(client.getType('space1', 'nonexistent')).rejects.toThrow(ValidationError);
    });
  });

  describe('getObjects', () => {
    it('should fetch objects without filters', async () => {
      const mockObjects = [{ id: 'obj1', name: 'Object 1', type_key: 'type1' }];
      mockFetchResponse({ data: mockObjects });

      const result = await client.getObjects('space1');

      expect(result).toEqual(mockObjects);
    });

    it('should use objects endpoint without type filter', async () => {
      mockFetchResponse({ data: [] });

      await client.getObjects('space1');

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/v1/spaces/space1/objects`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should use search endpoint with type filter', async () => {
      mockFetchResponse({ data: [] });

      await client.getObjects('space1', { type_key: 'type1' });

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/v1/spaces/space1/search`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ query: '', types: ['type1'] }),
        }),
      );
    });

    it('should append limit as query parameter', async () => {
      mockFetchResponse({ data: [] });

      await client.getObjects('space1', { limit: 10 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object),
      );
    });
  });

  describe('getObject', () => {
    it('should return the unwrapped object', async () => {
      const mockObject = { id: 'obj1', name: 'Object 1', type_key: 'type1' };
      mockFetchResponse({ object: mockObject });

      const result = await client.getObject('space1', 'obj1');

      expect(result).toEqual(mockObject);
    });

    it('should call the correct endpoint', async () => {
      mockFetchResponse({ object: { id: 'obj1' } });

      await client.getObject('space1', 'obj1');

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/v1/spaces/space1/objects/obj1`,
        expect.any(Object),
      );
    });

    it('should throw ValidationError on 404', async () => {
      mockFetchError(404, { message: 'Not found' });

      await expect(client.getObject('space1', 'nonexistent')).rejects.toThrow(ValidationError);
    });
  });

  describe('createObject', () => {
    it('should return the created object', async () => {
      const objectData = { name: 'New Object', type_key: 'type1', body: 'Content' };
      const mockCreated = { id: 'new-obj-id', ...objectData };
      mockFetchResponse(mockCreated);

      const result = await client.createObject('space1', objectData);

      expect(result).toEqual(mockCreated);
    });

    it('should POST to the objects endpoint', async () => {
      const objectData = { name: 'New Object', type_key: 'type1' };
      mockFetchResponse({ id: 'new-obj-id', ...objectData });

      await client.createObject('space1', objectData);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/v1/spaces/space1/objects`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(objectData),
        }),
      );
    });

    it('should include properties in the request body', async () => {
      const objectData = {
        name: 'New Object',
        type_key: 'type1',
        properties: [{ key: 'mood', text: 'happy' }],
      };
      mockFetchResponse({ id: 'new-obj-id', ...objectData });

      await client.createObject('space1', objectData);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ body: JSON.stringify(objectData) }),
      );
    });
  });

  describe('updateObject', () => {
    it('should return the updated object', async () => {
      const updateData = { name: 'Updated Name' };
      const mockUpdated = { id: 'obj1', ...updateData, type_key: 'type1' };
      mockFetchResponse(mockUpdated);

      const result = await client.updateObject('space1', 'obj1', updateData);

      expect(result).toEqual(mockUpdated);
    });

    it('should PATCH the correct endpoint', async () => {
      const updateData = { name: 'Updated' };
      mockFetchResponse({ id: 'obj1', ...updateData });

      await client.updateObject('space1', 'obj1', updateData);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/v1/spaces/space1/objects/obj1`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(updateData),
        }),
      );
    });

    it('should send body as markdown field in PATCH request', async () => {
      const updateData = { body: '## Updated content' };
      mockFetchResponse({ id: 'obj1', name: 'Test' });

      await client.updateObject('space1', 'obj1', updateData);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/v1/spaces/space1/objects/obj1`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ markdown: '## Updated content' }),
        }),
      );
    });

    it('should send body as markdown alongside other fields', async () => {
      const updateData = { name: 'New Name', body: '## Content' };
      mockFetchResponse({ id: 'obj1', name: 'New Name' });

      await client.updateObject('space1', 'obj1', updateData);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/v1/spaces/space1/objects/obj1`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'New Name', markdown: '## Content' }),
        }),
      );
    });
  });

  describe('search', () => {
    it('should return search results', async () => {
      const mockResults = [{ id: 'obj1', name: 'Object 1', snippet: 'Found text' }];
      mockFetchResponse({ data: mockResults });

      const result = await client.search('test query', { type_key: 'type1' });

      expect(result).toEqual(mockResults);
    });

    it('should POST to the search endpoint with type filter in body', async () => {
      mockFetchResponse({ data: [] });

      await client.search('test query', { type_key: 'type1' });

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/v1/search`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ query: 'test query', types: ['type1'] }),
        }),
      );
    });
  });

  describe('Authentication', () => {
    it('should include Bearer token in headers', async () => {
      mockFetchResponse({ data: [] });

      await client.getSpaces();

      const callArgs = (global.fetch as any).mock.calls[0];
      expect(callArgs[1].headers.Authorization).toBe(`Bearer ${apiKey}`);
    });

    it('should set Content-Type to application/json', async () => {
      mockFetchResponse({ data: [] });

      await client.getSpaces();

      const callArgs = (global.fetch as any).mock.calls[0];
      expect(callArgs[1].headers['Content-Type']).toBe('application/json');
    });
  });
});
