import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnytypeClient } from './client.js';
import { ConnectionError, ValidationError } from '../utils/errors.js';

// Mock global fetch
global.fetch = vi.fn();

describe('AnytypeClient', () => {
  const baseURL = 'http://127.0.0.1:31009';
  const apiKey = 'test-api-key';
  let client: AnytypeClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new AnytypeClient(baseURL, apiKey);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getSpaces', () => {
    it('should fetch all spaces', async () => {
      const mockSpaces = [
        { id: 'space1', name: 'Space 1' },
        { id: 'space2', name: 'Space 2' },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSpaces,
      });

      const result = await client.getSpaces();

      expect(result).toEqual(mockSpaces);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/v1/spaces`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${apiKey}`,
          }),
        }),
      );
    });

    it('should handle connection errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new TypeError('Network error'));

      await expect(client.getSpaces()).rejects.toThrow(ConnectionError);
    });

    it('should handle 401 unauthorized', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ message: 'Unauthorized' }),
      });

      await expect(client.getSpaces()).rejects.toThrow(ValidationError);
    });
  });

  describe('getTypes', () => {
    it('should fetch types for a space', async () => {
      const mockTypes = [
        { key: 'type1', name: 'Type 1' },
        { key: 'type2', name: 'Type 2' },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTypes,
      });

      const result = await client.getTypes('space1');

      expect(result).toEqual(mockTypes);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/v1/spaces/space1/types`,
        expect.any(Object),
      );
    });
  });

  describe('getType', () => {
    it('should fetch a single type by key (wrapped response)', async () => {
      const mockType = {
        id: 'type-id-1',
        key: 'note',
        name: 'Note',
        layout: 'basic',
        properties: [
          { object: 'property', id: 'p1', key: 'description', name: 'Description', format: 'text' },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ type: mockType }),
      });

      const result = await client.getType('space1', 'note');

      expect(result).toEqual(mockType);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/v1/spaces/space1/types/note`,
        expect.any(Object),
      );
    });

    it('should handle unwrapped response shape', async () => {
      const mockType = {
        id: 'type-id-1',
        key: 'note',
        name: 'Note',
        properties: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockType,
      });

      const result = await client.getType('space1', 'note');

      expect(result).toEqual(mockType);
    });

    it('should handle 404 not found', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ message: 'Not found' }),
      });

      await expect(client.getType('space1', 'nonexistent')).rejects.toThrow(ValidationError);
    });
  });

  describe('getObjects', () => {
    it('should fetch objects without filters', async () => {
      const mockObjects = [{ id: 'obj1', name: 'Object 1', type_key: 'type1' }];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockObjects,
      });

      const result = await client.getObjects('space1');

      expect(result).toEqual(mockObjects);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/v1/spaces/space1/objects`,
        expect.any(Object),
      );
    });

    it('should fetch objects with type filter', async () => {
      const mockObjects = [{ id: 'obj1', name: 'Object 1', type_key: 'type1' }];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockObjects,
      });

      const result = await client.getObjects('space1', { type_key: 'type1' });

      expect(result).toEqual(mockObjects);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('type_key=type1'),
        expect.any(Object),
      );
    });

    it('should fetch objects with limit', async () => {
      const mockObjects = [{ id: 'obj1', name: 'Object 1', type_key: 'type1' }];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockObjects,
      });

      const result = await client.getObjects('space1', { limit: 10 });

      expect(result).toEqual(mockObjects);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object),
      );
    });
  });

  describe('getObject', () => {
    it('should fetch a single object by ID', async () => {
      const mockObject = {
        id: 'obj1',
        name: 'Object 1',
        type_key: 'type1',
        body: 'Content',
        properties: {},
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockObject,
      });

      const result = await client.getObject('space1', 'obj1');

      expect(result).toEqual(mockObject);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/v1/spaces/space1/objects/obj1`,
        expect.any(Object),
      );
    });

    it('should handle 404 not found', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ message: 'Not found' }),
      });

      await expect(client.getObject('space1', 'nonexistent')).rejects.toThrow(ValidationError);
    });
  });

  describe('createObject', () => {
    it('should create an object', async () => {
      const objectData = {
        name: 'New Object',
        type_key: 'type1',
        body: 'Content',
      };

      const mockCreatedObject = {
        id: 'new-obj-id',
        ...objectData,
        properties: {},
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreatedObject,
      });

      const result = await client.createObject('space1', objectData);

      expect(result).toEqual(mockCreatedObject);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/v1/spaces/space1/objects`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(objectData),
        }),
      );
    });

    it('should create an object with properties', async () => {
      const objectData = {
        name: 'New Object',
        type_key: 'type1',
        properties: [
          { key: 'mood', text: 'happy' },
          { key: 'status', text: 'active' },
        ],
      };

      const mockCreatedObject = {
        id: 'new-obj-id',
        ...objectData,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreatedObject,
      });

      const result = await client.createObject('space1', objectData);

      expect(result).toEqual(mockCreatedObject);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(objectData),
        }),
      );
    });
  });

  describe('updateObject', () => {
    it('should update an object', async () => {
      const updateData = {
        name: 'Updated Name',
        body: 'Updated content',
      };

      const mockUpdatedObject = {
        id: 'obj1',
        ...updateData,
        type_key: 'type1',
        properties: {},
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUpdatedObject,
      });

      const result = await client.updateObject('space1', 'obj1', updateData);

      expect(result).toEqual(mockUpdatedObject);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/v1/spaces/space1/objects/obj1`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(updateData),
        }),
      );
    });

    it('should update object properties', async () => {
      const updateData = {
        properties: { mood: 'happy', status: 'completed' },
      };

      const mockUpdatedObject = {
        id: 'obj1',
        name: 'Object 1',
        type_key: 'type1',
        ...updateData,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUpdatedObject,
      });

      const result = await client.updateObject('space1', 'obj1', updateData);

      expect(result).toEqual(mockUpdatedObject);
    });
  });

  describe('search', () => {
    it('should search with type filter', async () => {
      const mockResults = [{ id: 'obj1', name: 'Object 1', snippet: 'Found text' }];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResults,
      });

      const result = await client.search('test query', { type_key: 'type1' });

      expect(result).toEqual(mockResults);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('type_key=type1'),
        expect.any(Object),
      );
    });
  });

  describe('Authentication', () => {
    it('should include Bearer token in headers', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await client.getSpaces();

      const callArgs = (global.fetch as any).mock.calls[0];
      expect(callArgs[1].headers.Authorization).toBe(`Bearer ${apiKey}`);
    });

    it('should set Content-Type header', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await client.getSpaces();

      const callArgs = (global.fetch as any).mock.calls[0];
      expect(callArgs[1].headers['Content-Type']).toBe('application/json');
    });
  });
});
