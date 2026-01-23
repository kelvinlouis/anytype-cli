#!/usr/bin/env node

// src/index.ts
import { Command as Command2 } from "commander";

// src/cli/commands/init.ts
import { Command } from "commander";

// src/utils/errors.ts
var EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  CONFIG_ERROR: 2,
  CONNECTION_ERROR: 3,
  NOT_FOUND: 4,
  VALIDATION_ERROR: 5
};
var CLIError = class extends Error {
  constructor(message, exitCode = EXIT_CODES.GENERAL_ERROR, verbose, cause) {
    super(message);
    this.exitCode = exitCode;
    this.verbose = verbose;
    this.cause = cause;
    this.name = "CLIError";
  }
};
var ConfigError = class extends CLIError {
  constructor(message, cause) {
    super(message, EXIT_CODES.CONFIG_ERROR, void 0, cause);
    this.name = "ConfigError";
  }
};
var ConnectionError = class extends CLIError {
  constructor(message, cause) {
    super(message, EXIT_CODES.CONNECTION_ERROR, void 0, cause);
    this.name = "ConnectionError";
  }
};
var ValidationError = class extends CLIError {
  constructor(message, cause) {
    super(message, EXIT_CODES.VALIDATION_ERROR, void 0, cause);
    this.name = "ValidationError";
  }
};
function handleError(error, verbose = false) {
  if (error instanceof CLIError) {
    console.error(`Error: ${error.message}`);
    if (verbose && error.cause) {
      console.error("\nStack trace:");
      console.error(error.cause.stack);
    }
    process.exit(error.exitCode);
  }
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
    if (verbose) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }
  console.error("Error:", error);
  process.exit(EXIT_CODES.GENERAL_ERROR);
}

// src/api/client.ts
var AnytypeClient = class {
  constructor(baseURL = "http://127.0.0.1:31009", apiKey) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
  }
  /**
   * Make an authenticated request to the Anytype API
   */
  async request(method, endpoint, body) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`
    };
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : void 0
      });
      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        let errorData = `HTTP ${response.status}`;
        if (contentType?.includes("application/json")) {
          try {
            errorData = await response.json();
          } catch {
            errorData = await response.text();
          }
        } else {
          errorData = await response.text();
        }
        if (response.status === 401) {
          throw new ValidationError("Invalid API key. Check your configuration.");
        }
        if (response.status === 404) {
          throw new ValidationError(`Not found: ${endpoint}`);
        }
        throw new ValidationError(
          `API error: ${typeof errorData === "string" ? errorData : errorData.message || JSON.stringify(errorData)}`
        );
      }
      return await response.json();
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      if (error instanceof TypeError) {
        throw new ConnectionError(
          "Failed to connect to Anytype. Ensure Anytype is running on http://127.0.0.1:31009",
          error
        );
      }
      throw error;
    }
  }
  /**
   * Get all spaces
   */
  async getSpaces() {
    return this.request("GET", "/v1/spaces");
  }
  /**
   * Get all types in a space
   */
  async getTypes(spaceId) {
    return this.request("GET", `/v1/spaces/${spaceId}/types`);
  }
  /**
   * Get objects in a space with optional filtering
   */
  async getObjects(spaceId, filters) {
    const queryParams = new URLSearchParams();
    if (filters?.type_key) queryParams.append("type_key", filters.type_key);
    if (filters?.limit) queryParams.append("limit", String(filters.limit));
    if (filters?.offset) queryParams.append("offset", String(filters.offset));
    const endpoint = queryParams.size > 0 ? `/v1/spaces/${spaceId}/objects?${queryParams}` : `/v1/spaces/${spaceId}/objects`;
    return this.request("GET", endpoint);
  }
  /**
   * Get a single object
   */
  async getObject(spaceId, objectId) {
    return this.request("GET", `/v1/spaces/${spaceId}/objects/${objectId}`);
  }
  /**
   * Create an object
   */
  async createObject(spaceId, data) {
    return this.request("POST", `/v1/spaces/${spaceId}/objects`, data);
  }
  /**
   * Update an object
   */
  async updateObject(spaceId, objectId, data) {
    return this.request(
      "PATCH",
      `/v1/spaces/${spaceId}/objects/${objectId}`,
      data
    );
  }
  /**
   * Archive an object
   */
  async deleteObject(spaceId, objectId) {
    await this.request("DELETE", `/v1/spaces/${spaceId}/objects/${objectId}`);
  }
  /**
   * Global search
   */
  async search(query, filters) {
    const queryParams = new URLSearchParams();
    queryParams.append("query", query);
    if (filters?.type_key) queryParams.append("type_key", filters.type_key);
    if (filters?.limit) queryParams.append("limit", String(filters.limit));
    if (filters?.offset) queryParams.append("offset", String(filters.offset));
    return this.request("POST", `/v1/search?${queryParams}`);
  }
};

// src/config/index.ts
import Conf from "conf";
import { homedir } from "os";
import { join } from "path";
var ConfigManager = class {
  constructor() {
    this.conf = new Conf({
      projectName: "anytype-cli",
      configFileLocation: join(homedir(), ".anytype-cli", "config.json")
    });
  }
  /**
   * Get the entire config
   */
  getConfig() {
    return this.conf.store;
  }
  /**
   * Check if config exists and has required fields
   */
  hasConfig() {
    return Boolean(this.conf.get("apiKey"));
  }
  /**
   * Get a specific config value
   */
  get(key) {
    return this.conf.get(key);
  }
  /**
   * Set a specific config value
   */
  set(key, value) {
    this.conf.set(key, value);
  }
  /**
   * Get API key
   */
  getApiKey() {
    return this.conf.get("apiKey");
  }
  /**
   * Set API key
   */
  setApiKey(apiKey) {
    this.conf.set("apiKey", apiKey);
  }
  /**
   * Get default space
   */
  getDefaultSpace() {
    return this.conf.get("defaultSpace");
  }
  /**
   * Set default space
   */
  setDefaultSpace(spaceId) {
    this.conf.set("defaultSpace", spaceId);
  }
  /**
   * Get all aliases
   */
  getAliases() {
    return this.conf.get("aliases") || {};
  }
  /**
   * Set aliases
   */
  setAliases(aliases) {
    this.conf.set("aliases", aliases);
  }
  /**
   * Add a single alias
   */
  addAlias(alias, typeKey) {
    const aliases = this.getAliases();
    aliases[alias] = typeKey;
    this.setAliases(aliases);
  }
  /**
   * Remove an alias
   */
  removeAlias(alias) {
    const aliases = this.getAliases();
    delete aliases[alias];
    this.setAliases(aliases);
  }
  /**
   * Resolve an alias to its type key
   */
  resolveAlias(alias) {
    const aliases = this.getAliases();
    return aliases[alias] || alias;
  }
  /**
   * Get base URL
   */
  getBaseURL() {
    return this.conf.get("baseURL") || "http://127.0.0.1:31009";
  }
  /**
   * Set base URL
   */
  setBaseURL(baseURL) {
    this.conf.set("baseURL", baseURL);
  }
  /**
   * Clear all config
   */
  clear() {
    this.conf.clear();
  }
};
var config = new ConfigManager();

// src/cli/commands/init.ts
function createInitCommand() {
  const command = new Command("init").description("Initialize Anytype CLI with API key and default space").option("--api-key <key>", "API key (will prompt if not provided)").action(async (options) => {
    try {
      await initAction(options);
    } catch (error) {
      handleError(error, options.verbose);
    }
  });
  return command;
}
async function initAction(options) {
  let apiKey = options.apiKey;
  if (!apiKey) {
    throw new ConfigError(
      "API key is required. Use --api-key <key> to provide it, or run without flags for interactive mode."
    );
  }
  const client = new AnytypeClient(config.getBaseURL(), apiKey);
  console.log("Validating API key...");
  const spaces = await client.getSpaces();
  if (!spaces || spaces.length === 0) {
    throw new ConfigError("No spaces found in Anytype. Please create a space first.");
  }
  config.setApiKey(apiKey);
  if (!config.getDefaultSpace() && spaces.length > 0) {
    config.setDefaultSpace(spaces[0].id);
    console.log(`\u2713 Default space set to: ${spaces[0].name}`);
  }
  const defaultAliases = {
    team: "team_member",
    member: "team_member",
    "1on1": "one_on_one",
    goal: "team_member_goal",
    goals: "team_member_goal",
    mag: "appraisal",
    training: "team_member_training",
    education: "team_member_training"
  };
  config.setAliases(defaultAliases);
  console.log("\u2713 Configuration saved successfully");
  console.log(`\u2713 Found ${spaces.length} space(s)`);
  console.log("\u2713 Default aliases configured");
  console.log("\nYou can now use anytype commands. Try:");
  console.log("  anytype --help");
  console.log("  anytype types");
}

// src/index.ts
var packageJson = {
  version: "1.0.0",
  description: "CLI tool for interacting with Anytype objects"
};
var program = new Command2();
program.name("anytype").description(packageJson.description).version(packageJson.version, "-v, --version", "Output version number").option("--json", "Output as JSON instead of markdown", false).option("--verbose", "Show detailed output and errors", false).option("--no-color", "Disable colored output", false).option("--space <id>", "Override default space").option("--dry-run", "Preview changes without executing", false).hook("preAction", (thisCommand) => {
  const options = thisCommand.opts();
});
program.addCommand(createInitCommand());
program.parse(process.argv);
if (!process.argv.slice(2).length) {
  program.outputHelp();
  process.exit(0);
}
