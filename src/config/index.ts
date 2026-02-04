import Conf from 'conf';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';

/**
 * Configuration schema
 */
export interface ConfigSchema {
  apiKey?: string;
  defaultSpace?: string;
  aliases?: Record<string, string>;
  baseURL?: string;
}

/**
 * Configuration manager using conf package
 */
class ConfigManager {
  private conf: Conf<ConfigSchema>;

  constructor() {
    const configDir = join(homedir(), '.anytype-cli');
    const configPath = join(configDir, 'config.json');

    try {
      // Create config in ~/.anytype-cli/config.json
      this.conf = new Conf<ConfigSchema>({
        projectName: 'anytype-cli',
        cwd: configDir,
      });
    } catch (error) {
      // Handle corrupted config file (e.g., empty JSON)
      if (
        error instanceof SyntaxError &&
        error.message.includes('JSON')
      ) {
        // Delete corrupted config file and retry
        if (existsSync(configPath)) {
          unlinkSync(configPath);
        }
        this.conf = new Conf<ConfigSchema>({
          projectName: 'anytype-cli',
          cwd: configDir,
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Get the entire config
   */
  getConfig(): ConfigSchema {
    return this.conf.store;
  }

  /**
   * Check if config exists and has required fields
   */
  hasConfig(): boolean {
    return Boolean(this.conf.get('apiKey'));
  }

  /**
   * Get a specific config value
   */
  get<K extends keyof ConfigSchema>(key: K): ConfigSchema[K] | undefined {
    return this.conf.get(key);
  }

  /**
   * Set a specific config value
   */
  set<K extends keyof ConfigSchema>(key: K, value: ConfigSchema[K]): void {
    this.conf.set(key, value);
  }

  /**
   * Get API key
   */
  getApiKey(): string | undefined {
    return this.conf.get('apiKey');
  }

  /**
   * Set API key
   */
  setApiKey(apiKey: string): void {
    this.conf.set('apiKey', apiKey);
  }

  /**
   * Get default space
   */
  getDefaultSpace(): string | undefined {
    return this.conf.get('defaultSpace');
  }

  /**
   * Set default space
   */
  setDefaultSpace(spaceId: string): void {
    this.conf.set('defaultSpace', spaceId);
  }

  /**
   * Get all aliases
   */
  getAliases(): Record<string, string> {
    return this.conf.get('aliases') || {};
  }

  /**
   * Set aliases
   */
  setAliases(aliases: Record<string, string>): void {
    this.conf.set('aliases', aliases);
  }

  /**
   * Add a single alias
   */
  addAlias(alias: string, typeKey: string): void {
    const aliases = this.getAliases();
    aliases[alias] = typeKey;
    this.setAliases(aliases);
  }

  /**
   * Remove an alias
   */
  removeAlias(alias: string): void {
    const aliases = this.getAliases();
    delete aliases[alias];
    this.setAliases(aliases);
  }

  /**
   * Resolve an alias to its type key
   */
  resolveAlias(alias: string): string {
    const aliases = this.getAliases();
    return aliases[alias] || alias;
  }

  /**
   * Get base URL
   */
  getBaseURL(): string {
    return this.conf.get('baseURL') || 'http://127.0.0.1:31009';
  }

  /**
   * Set base URL
   */
  setBaseURL(baseURL: string): void {
    this.conf.set('baseURL', baseURL);
  }

  /**
   * Clear all config
   */
  clear(): void {
    this.conf.clear();
  }
}

// Export singleton instance
export const config = new ConfigManager();
