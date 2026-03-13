import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createListCommand } from './list.js';
import { createGetCommand } from './get.js';
import { createCreateCommand } from './create.js';
import { createUpdateCommand } from './update.js';

// --- Mock client methods (vi.hoisted ensures they're available in vi.mock factories) ---

const {
  mockGetObjects,
  mockGetObject,
  mockCreateObject,
  mockUpdateObject,
  mockSearch,
  mockResolveObjectNames,
  mockResolveType,
} = vi.hoisted(() => ({
  mockGetObjects: vi.fn(),
  mockGetObject: vi.fn(),
  mockCreateObject: vi.fn(),
  mockUpdateObject: vi.fn(),
  mockSearch: vi.fn(),
  mockResolveObjectNames: vi.fn(() => Promise.resolve(new Map<string, string>())),
  mockResolveType: vi.fn(() =>
    Promise.resolve({ id: 'type-id', key: 'note', name: 'Note', properties: [] }),
  ),
}));

vi.mock('./shared.js', () => ({
  createAuthenticatedClient: vi.fn(() => ({
    client: {
      getObjects: mockGetObjects,
      getObject: mockGetObject,
      createObject: mockCreateObject,
      updateObject: mockUpdateObject,
      search: mockSearch,
      searchInSpace: vi.fn(() => Promise.resolve([])),
      resolveType: mockResolveType,
      getTemplates: vi.fn(() => Promise.resolve([])),
    },
    spaceId: 'space-123',
  })),
  resolveObjectNames: mockResolveObjectNames,
}));

vi.mock('../../config/index.js', () => ({
  config: {
    getApiKey: vi.fn(() => 'test-key'),
    getDefaultSpace: vi.fn(() => 'space-123'),
    resolveAlias: vi.fn((alias: string) => alias),
    getBaseURL: vi.fn(() => 'http://127.0.0.1:31009'),
    getTypeFields: vi.fn(() => undefined),
  },
}));

vi.mock('../../utils/stdin.js', () => ({
  readStdinIfAvailable: vi.fn(() => Promise.resolve('')),
}));

vi.mock('../../utils/errors.js', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    handleError: vi.fn(),
  };
});

// Reset hoisted mocks between tests (not covered by Vitest's restoreMocks config)
beforeEach(() => {
  mockGetObjects.mockReset();
  mockGetObject.mockReset();
  mockCreateObject.mockReset();
  mockUpdateObject.mockReset();
  mockSearch.mockReset();
  mockResolveObjectNames.mockReset().mockResolvedValue(new Map<string, string>());
  mockResolveType.mockReset().mockResolvedValue({
    id: 'type-id',
    key: 'note',
    name: 'Note',
    properties: [],
  });
});

// --- Metadata tests ---

describe('List Command', () => {
  it('should have correct command name', () => {
    const command = createListCommand();
    expect(command.name()).toBe('list');
  });

  it('should have correct arguments and options', () => {
    const command = createListCommand();

    expect(command._args.length).toBeGreaterThan(0);

    const options = command.options;
    const optionNames = options.map((opt) => opt.long);

    expect(optionNames).toContain('--json');
    expect(optionNames).toContain('--limit');
    expect(optionNames).toContain('--fields');
  });

  it('should have proper help text', () => {
    const command = createListCommand();
    expect(command._description).toBeTruthy();
  });
});

describe('Get Command', () => {
  it('should have correct command name', () => {
    const command = createGetCommand();
    expect(command.name()).toBe('get');
  });

  it('should have correct arguments and options', () => {
    const command = createGetCommand();

    expect(command._args.length).toBeGreaterThan(0);

    const options = command.options;
    const optionNames = options.map((opt) => opt.long);

    expect(optionNames).toContain('--json');
  });

  it('should have proper help text', () => {
    const command = createGetCommand();
    expect(command._description).toBeTruthy();
  });
});

describe('Create Command', () => {
  it('should have correct command name', () => {
    const command = createCreateCommand();
    expect(command.name()).toBe('create');
  });

  it('should have stdin documentation in --body option', () => {
    const command = createCreateCommand();
    const bodyOption = command.options.find((opt) => opt.long === '--body');
    expect(bodyOption).toBeDefined();
    expect(bodyOption?.description).toContain('stdin');
  });

  it('should have correct arguments and options', () => {
    const command = createCreateCommand();

    const options = command.options;
    const optionNames = options.map((opt) => opt.long);

    expect(optionNames).toContain('--body');
    expect(optionNames).toContain('--body-file');
    expect(optionNames).toContain('--property');
    expect(optionNames).toContain('--link-to');
    expect(optionNames).toContain('--link-property');
    expect(optionNames).toContain('--dry-run');
  });
});

describe('Update Command', () => {
  it('should have correct command name', () => {
    const command = createUpdateCommand();
    expect(command.name()).toBe('update');
  });

  it('should have stdin documentation in --body option', () => {
    const command = createUpdateCommand();
    const bodyOption = command.options.find((opt) => opt.long === '--body');
    expect(bodyOption).toBeDefined();
    expect(bodyOption?.description).toContain('stdin');
  });

  it('should have correct arguments and options', () => {
    const command = createUpdateCommand();

    const options = command.options;
    const optionNames = options.map((opt) => opt.long);

    expect(optionNames).toContain('--name');
    expect(optionNames).toContain('--body');
    expect(optionNames).toContain('--append');
    expect(optionNames).toContain('--body-file');
    expect(optionNames).toContain('--property');
    expect(optionNames).toContain('--link-property');
    expect(optionNames).toContain('--dry-run');
  });
});

// --- Behavioral tests ---

/**
 * Helper to execute a Commander command with the given arguments,
 * suppressing Commander's default exit/write behavior.
 */
async function runCommand(
  createFn: () => ReturnType<typeof createListCommand>,
  args: string[],
): Promise<void> {
  const command = createFn();
  command.exitOverride();
  command.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  await command.parseAsync(['node', 'test', ...args]);
}

describe('List Command — behavior', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    logSpy.mockClear();
  });

  it('should call getObjects with the resolved type key', async () => {
    mockGetObjects.mockResolvedValueOnce([]);

    await runCommand(createListCommand, ['note']);

    expect(mockGetObjects).toHaveBeenCalledWith(
      'space-123',
      expect.objectContaining({ type_key: 'note' }),
    );
  });

  it('should output a markdown table by default', async () => {
    mockGetObjects.mockResolvedValueOnce([{ id: 'obj-1', name: 'My Note', type_key: 'note' }]);

    await runCommand(createListCommand, ['note']);

    const output = logSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('My Note');
    expect(output).toContain('|');
  });

  it('should output JSON when --json flag is passed', async () => {
    const objects = [{ id: 'obj-1', name: 'My Note', type_key: 'note' }];
    mockGetObjects.mockResolvedValueOnce(objects);

    await runCommand(createListCommand, ['note', '--json']);

    const output = logSpy.mock.calls[0]?.[0] as string;
    expect(JSON.parse(output)).toEqual(objects);
  });

  it('should respect --limit option', async () => {
    mockGetObjects.mockResolvedValueOnce([]);

    await runCommand(createListCommand, ['note', '--limit', '5']);

    expect(mockGetObjects).toHaveBeenCalledWith('space-123', expect.objectContaining({ limit: 5 }));
  });
});

describe('Get Command — behavior', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    logSpy.mockClear();
  });

  it('should fetch the object by ID', async () => {
    mockGetObject.mockResolvedValueOnce({
      id: 'obj-1',
      name: 'My Note',
      type: { key: 'note', name: 'Note' },
    });

    await runCommand(createGetCommand, ['note', 'obj-1']);

    expect(mockGetObject).toHaveBeenCalledWith('space-123', 'obj-1', { format: 'markdown' });
  });

  it('should fall back to name search when ID lookup fails', async () => {
    mockGetObject
      .mockRejectedValueOnce(new Error('Not found'))
      .mockResolvedValueOnce({ id: 'obj-1', name: 'My Note', type: { key: 'note', name: 'Note' } });
    mockGetObjects.mockResolvedValueOnce([{ id: 'obj-1', name: 'My Note', type_key: 'note' }]);

    await runCommand(createGetCommand, ['note', 'My Note']);

    expect(mockGetObjects).toHaveBeenCalledWith(
      'space-123',
      expect.objectContaining({ type_key: 'note' }),
    );
  });

  it('should output JSON when --json flag is passed', async () => {
    const object = { id: 'obj-1', name: 'My Note', type: { key: 'note', name: 'Note' } };
    mockGetObject.mockResolvedValueOnce(object);

    await runCommand(createGetCommand, ['note', 'obj-1', '--json']);

    const output = logSpy.mock.calls[0]?.[0] as string;
    expect(JSON.parse(output)).toEqual(object);
  });
});

describe('Create Command — behavior', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    logSpy.mockClear();
  });

  it('should call createObject with the correct payload', async () => {
    mockCreateObject.mockResolvedValueOnce({
      id: 'new-obj',
      name: 'Test Note',
      type_key: 'note',
    });

    await runCommand(createCreateCommand, ['note', 'Test Note']);

    expect(mockCreateObject).toHaveBeenCalledWith(
      'space-123',
      expect.objectContaining({ name: 'Test Note', type_key: 'note' }),
    );
  });

  it('should show preview in dry-run mode without calling API', async () => {
    await runCommand(createCreateCommand, ['note', 'Test Note', '--dry-run']);

    expect(mockCreateObject).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('Would create object with:');
  });

  it('should include body in the create payload', async () => {
    mockCreateObject.mockResolvedValueOnce({
      id: 'new-obj',
      name: 'Test Note',
      type_key: 'note',
    });

    await runCommand(createCreateCommand, ['note', 'Test Note', '--body', 'Hello world']);

    expect(mockCreateObject).toHaveBeenCalledWith(
      'space-123',
      expect.objectContaining({ body: 'Hello world' }),
    );
  });

  it('should link to another object after creation when --link-to is passed', async () => {
    mockResolveType.mockResolvedValueOnce({
      id: 'type-id',
      key: 'task',
      name: 'Task',
      properties: [
        { object: 'property', id: 'p-links', key: 'links', name: 'Links', format: 'objects' },
        {
          object: 'property',
          id: 'p-lp',
          key: 'linked_projects',
          name: 'Linked Projects',
          format: 'objects',
        },
      ],
    });
    mockCreateObject.mockResolvedValueOnce({
      id: 'new-obj',
      name: 'Test Task',
      type_key: 'task',
    });
    mockUpdateObject.mockResolvedValueOnce({
      id: 'new-obj',
      name: 'Test Task',
      type_key: 'task',
    });

    await runCommand(createCreateCommand, ['task', 'Test Task', '--link-to', 'target-obj-id']);

    expect(mockCreateObject).toHaveBeenCalled();
    expect(mockUpdateObject).toHaveBeenCalledWith('space-123', 'new-obj', {
      properties: [{ key: 'linked_projects', format: 'objects', objects: ['target-obj-id'] }],
    });
  });

  it('should use --link-property to disambiguate when multiple object properties exist', async () => {
    mockResolveType.mockResolvedValueOnce({
      id: 'type-id',
      key: 'task',
      name: 'Task',
      properties: [
        { object: 'property', id: 'p-links', key: 'links', name: 'Links', format: 'objects' },
        {
          object: 'property',
          id: 'p-a',
          key: 'assignee',
          name: 'Assignee',
          format: 'objects',
        },
        {
          object: 'property',
          id: 'p-lp',
          key: 'linked_projects',
          name: 'Linked Projects',
          format: 'objects',
        },
      ],
    });
    mockCreateObject.mockResolvedValueOnce({
      id: 'new-obj',
      name: 'Test Task',
      type_key: 'task',
    });
    mockUpdateObject.mockResolvedValueOnce({
      id: 'new-obj',
      name: 'Test Task',
      type_key: 'task',
    });

    await runCommand(createCreateCommand, [
      'task',
      'Test Task',
      '--link-to',
      'target-obj-id',
      '--link-property',
      'assignee',
    ]);

    expect(mockUpdateObject).toHaveBeenCalledWith('space-123', 'new-obj', {
      properties: [{ key: 'assignee', format: 'objects', objects: ['target-obj-id'] }],
    });
  });
});

describe('Update Command — behavior', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    logSpy.mockClear();
  });

  it('should fetch existing object then call updateObject', async () => {
    mockGetObject.mockResolvedValueOnce({ id: 'obj-1', name: 'Old Name', type_key: 'note' });
    mockUpdateObject.mockResolvedValueOnce({ id: 'obj-1', name: 'New Name', type_key: 'note' });

    await runCommand(createUpdateCommand, ['obj-1', '--name', 'New Name']);

    expect(mockUpdateObject).toHaveBeenCalledWith(
      'space-123',
      'obj-1',
      expect.objectContaining({ name: 'New Name' }),
    );
  });

  it('should show preview in dry-run mode without calling API', async () => {
    mockGetObject.mockResolvedValueOnce({ id: 'obj-1', name: 'Old Name', type_key: 'note' });

    await runCommand(createUpdateCommand, ['obj-1', '--name', 'New Name', '--dry-run']);

    expect(mockUpdateObject).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('Would update object with:');
  });

  it('should output JSON when --json flag is passed', async () => {
    const updated = { id: 'obj-1', name: 'New Name', type_key: 'note' };
    mockGetObject.mockResolvedValueOnce({ id: 'obj-1', name: 'Old Name', type_key: 'note' });
    mockUpdateObject.mockResolvedValueOnce(updated);

    await runCommand(createUpdateCommand, ['obj-1', '--name', 'New Name', '--json']);

    const output = logSpy.mock.calls[0]?.[0] as string;
    expect(JSON.parse(output)).toEqual(updated);
  });

  it('should report no changes when no update options provided', async () => {
    mockGetObject.mockResolvedValueOnce({ id: 'obj-1', name: 'My Note', type_key: 'note' });

    await runCommand(createUpdateCommand, ['obj-1']);

    expect(mockUpdateObject).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('No changes to apply');
  });

  it('should link to another object when --link-to is passed', async () => {
    mockResolveType.mockResolvedValueOnce({
      id: 'type-id',
      key: 'task',
      name: 'Task',
      properties: [
        { object: 'property', id: 'p-links', key: 'links', name: 'Links', format: 'objects' },
        {
          object: 'property',
          id: 'p-lp',
          key: 'linked_projects',
          name: 'Linked Projects',
          format: 'objects',
        },
      ],
    });
    mockGetObject.mockResolvedValueOnce({
      id: 'obj-1',
      name: 'My Task',
      type_key: 'task',
      properties: [],
    });
    mockUpdateObject.mockResolvedValueOnce({ id: 'obj-1', name: 'My Task', type_key: 'task' });

    await runCommand(createUpdateCommand, ['obj-1', '--link-to', 'target-obj-id']);

    expect(mockUpdateObject).toHaveBeenCalledWith(
      'space-123',
      'obj-1',
      expect.objectContaining({
        properties: expect.arrayContaining([
          { key: 'linked_projects', format: 'objects', objects: ['target-obj-id'] },
        ]),
      }),
    );
  });

  it('should preserve existing links when adding a new link', async () => {
    mockResolveType.mockResolvedValueOnce({
      id: 'type-id',
      key: 'task',
      name: 'Task',
      properties: [
        { object: 'property', id: 'p-links', key: 'links', name: 'Links', format: 'objects' },
        {
          object: 'property',
          id: 'p-lp',
          key: 'linked_projects',
          name: 'Linked Projects',
          format: 'objects',
        },
      ],
    });
    mockGetObject.mockResolvedValueOnce({
      id: 'obj-1',
      name: 'My Task',
      type_key: 'task',
      properties: [{ key: 'linked_projects', format: 'objects', objects: ['existing-link-id'] }],
    });
    mockUpdateObject.mockResolvedValueOnce({ id: 'obj-1', name: 'My Task', type_key: 'task' });

    await runCommand(createUpdateCommand, ['obj-1', '--link-to', 'target-obj-id']);

    expect(mockUpdateObject).toHaveBeenCalledWith(
      'space-123',
      'obj-1',
      expect.objectContaining({
        properties: expect.arrayContaining([
          {
            key: 'linked_projects',
            format: 'objects',
            objects: ['existing-link-id', 'target-obj-id'],
          },
        ]),
      }),
    );
  });

  it('should unlink from another object when --unlink-from is passed', async () => {
    mockResolveType.mockResolvedValueOnce({
      id: 'type-id',
      key: 'task',
      name: 'Task',
      properties: [
        { object: 'property', id: 'p-links', key: 'links', name: 'Links', format: 'objects' },
        {
          object: 'property',
          id: 'p-lp',
          key: 'linked_projects',
          name: 'Linked Projects',
          format: 'objects',
        },
      ],
    });
    mockGetObject.mockResolvedValueOnce({
      id: 'obj-1',
      name: 'My Task',
      type_key: 'task',
      properties: [{ key: 'linked_projects', format: 'objects', objects: ['link-a', 'link-b'] }],
    });
    mockUpdateObject.mockResolvedValueOnce({ id: 'obj-1', name: 'My Task', type_key: 'task' });

    await runCommand(createUpdateCommand, ['obj-1', '--unlink-from', 'link-a']);

    expect(mockUpdateObject).toHaveBeenCalledWith(
      'space-123',
      'obj-1',
      expect.objectContaining({
        properties: expect.arrayContaining([
          { key: 'linked_projects', format: 'objects', objects: ['link-b'] },
        ]),
      }),
    );
  });
});
