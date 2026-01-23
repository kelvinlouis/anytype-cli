import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createListCommand } from './list.js';
import { createGetCommand } from './get.js';
import { createCreateCommand } from './create.js';
import { createUpdateCommand } from './update.js';
import { AnytypeClient } from '../../api/client.js';
import { config } from '../../config/index.js';

// Mock the API client
vi.mock('../../api/client.js');

// Mock the config
vi.mock('../../config/index.js', () => ({
  config: {
    getApiKey: vi.fn(() => 'test-key'),
    getDefaultSpace: vi.fn(() => 'space-123'),
    resolveAlias: vi.fn((alias) => alias),
    getBaseURL: vi.fn(() => 'http://127.0.0.1:31009'),
  },
}));

describe('List Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    expect(optionNames).toContain('--dry-run');
  });
});

describe('Update Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    expect(optionNames).toContain('--dry-run');
  });
});
