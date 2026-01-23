import { describe, it, expect, beforeEach, vi } from 'vitest';
import Conf from 'conf';

// Mock the conf package
vi.mock('conf', () => {
  const mockStore: Record<string, any> = {};

  return {
    default: class MockConf {
      store = mockStore;

      constructor(options: any) {
        // Initialize with empty store
      }

      get(key: string) {
        return mockStore[key];
      }

      set(key: string, value: any) {
        mockStore[key] = value;
      }

      clear() {
        Object.keys(mockStore).forEach((key) => {
          delete mockStore[key];
        });
      }
    },
  };
});

// Import after mocking
import { config } from './index.js';

describe('ConfigManager', () => {
  beforeEach(() => {
    config.clear();
  });

  describe('hasConfig', () => {
    it('should return false when no API key is set', () => {
      expect(config.hasConfig()).toBe(false);
    });

    it('should return true when API key is set', () => {
      config.setApiKey('test-key');
      expect(config.hasConfig()).toBe(true);
    });
  });

  describe('API Key Management', () => {
    it('should set and get API key', () => {
      config.setApiKey('my-api-key');
      expect(config.getApiKey()).toBe('my-api-key');
    });

    it('should return undefined for unset API key', () => {
      expect(config.getApiKey()).toBeUndefined();
    });
  });

  describe('Default Space Management', () => {
    it('should set and get default space', () => {
      config.setDefaultSpace('space-123');
      expect(config.getDefaultSpace()).toBe('space-123');
    });

    it('should return undefined for unset default space', () => {
      expect(config.getDefaultSpace()).toBeUndefined();
    });
  });

  describe('Alias Management', () => {
    it('should get empty aliases by default', () => {
      expect(config.getAliases()).toEqual({});
    });

    it('should add an alias', () => {
      config.addAlias('member', 'team_member');
      expect(config.getAliases()).toEqual({ member: 'team_member' });
    });

    it('should add multiple aliases', () => {
      config.addAlias('member', 'team_member');
      config.addAlias('1on1', 'one_on_one');
      config.addAlias('goal', 'team_member_goal');

      expect(config.getAliases()).toEqual({
        member: 'team_member',
        '1on1': 'one_on_one',
        goal: 'team_member_goal',
      });
    });

    it('should remove an alias', () => {
      config.addAlias('member', 'team_member');
      config.addAlias('goal', 'team_member_goal');

      config.removeAlias('member');

      expect(config.getAliases()).toEqual({
        goal: 'team_member_goal',
      });
    });

    it('should set all aliases at once', () => {
      const aliases = {
        member: 'team_member',
        '1on1': 'one_on_one',
      };

      config.setAliases(aliases);

      expect(config.getAliases()).toEqual(aliases);
    });

    it('should resolve alias to type key', () => {
      config.addAlias('member', 'team_member');
      config.addAlias('goal', 'team_member_goal');

      expect(config.resolveAlias('member')).toBe('team_member');
      expect(config.resolveAlias('goal')).toBe('team_member_goal');
    });

    it('should return original input if alias not found', () => {
      config.addAlias('member', 'team_member');

      expect(config.resolveAlias('unknown')).toBe('unknown');
    });
  });

  describe('Base URL Management', () => {
    it('should get default base URL', () => {
      expect(config.getBaseURL()).toBe('http://127.0.0.1:31009');
    });

    it('should set and get custom base URL', () => {
      config.setBaseURL('http://localhost:8080');
      expect(config.getBaseURL()).toBe('http://localhost:8080');
    });
  });

  describe('General Config Management', () => {
    it('should get entire config', () => {
      config.setApiKey('test-key');
      config.setDefaultSpace('space-123');
      config.addAlias('member', 'team_member');

      const fullConfig = config.getConfig();

      expect(fullConfig.apiKey).toBe('test-key');
      expect(fullConfig.defaultSpace).toBe('space-123');
      expect(fullConfig.aliases).toEqual({ member: 'team_member' });
    });

    it('should set generic config value', () => {
      config.set('apiKey', 'generic-key');
      expect(config.get('apiKey')).toBe('generic-key');
    });

    it('should clear all config', () => {
      config.setApiKey('test-key');
      config.setDefaultSpace('space-123');
      config.addAlias('member', 'team_member');

      config.clear();

      expect(config.getApiKey()).toBeUndefined();
      expect(config.getDefaultSpace()).toBeUndefined();
      expect(config.getAliases()).toEqual({});
    });
  });
});
