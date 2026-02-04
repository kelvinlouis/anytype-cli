#!/usr/bin/env node

// src/index.ts
import { Command as Command9 } from "commander";

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
var NotFoundError = class extends CLIError {
  constructor(message, cause) {
    super(message, EXIT_CODES.NOT_FOUND, void 0, cause);
    this.name = "NotFoundError";
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
    const response = await this.request("GET", "/v1/spaces");
    return response.data;
  }
  /**
   * Get all types in a space
   */
  async getTypes(spaceId) {
    const response = await this.request("GET", `/v1/spaces/${spaceId}/types`);
    return response.data;
  }
  /**
   * Get objects in a space with optional filtering
   * Note: When filtering by type, uses the search endpoint as the objects
   * endpoint doesn't support type filtering via query params
   */
  async getObjects(spaceId, filters) {
    if (filters?.type_key) {
      const queryParams2 = new URLSearchParams();
      if (filters.limit) queryParams2.append("limit", String(filters.limit));
      if (filters.offset) queryParams2.append("offset", String(filters.offset));
      const endpoint2 = queryParams2.size > 0 ? `/v1/spaces/${spaceId}/search?${queryParams2}` : `/v1/spaces/${spaceId}/search`;
      const body = {
        query: "",
        types: [filters.type_key]
      };
      const response2 = await this.request("POST", endpoint2, body);
      return response2.data;
    }
    const queryParams = new URLSearchParams();
    if (filters?.limit) queryParams.append("limit", String(filters.limit));
    if (filters?.offset) queryParams.append("offset", String(filters.offset));
    const endpoint = queryParams.size > 0 ? `/v1/spaces/${spaceId}/objects?${queryParams}` : `/v1/spaces/${spaceId}/objects`;
    const response = await this.request("GET", endpoint);
    return response.data;
  }
  /**
   * Get a single object
   */
  async getObject(spaceId, objectId, options) {
    const queryParams = new URLSearchParams();
    if (options?.format) queryParams.append("format", options.format);
    const endpoint = queryParams.size > 0 ? `/v1/spaces/${spaceId}/objects/${objectId}?${queryParams}` : `/v1/spaces/${spaceId}/objects/${objectId}`;
    const response = await this.request("GET", endpoint);
    return response.object;
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
    if (filters?.limit) queryParams.append("limit", String(filters.limit));
    if (filters?.offset) queryParams.append("offset", String(filters.offset));
    const endpoint = queryParams.size > 0 ? `/v1/search?${queryParams}` : "/v1/search";
    const body = { query };
    if (filters?.type_key) body.types = [filters.type_key];
    const response = await this.request("POST", endpoint, body);
    return response.data;
  }
  /**
   * Search within a specific space
   */
  async searchInSpace(spaceId, query, filters) {
    const queryParams = new URLSearchParams();
    if (filters?.limit) queryParams.append("limit", String(filters.limit));
    if (filters?.offset) queryParams.append("offset", String(filters.offset));
    const endpoint = queryParams.size > 0 ? `/v1/spaces/${spaceId}/search?${queryParams}` : `/v1/spaces/${spaceId}/search`;
    const body = { query };
    if (filters?.type_key) body.types = [filters.type_key];
    const response = await this.request("POST", endpoint, body);
    return response.data;
  }
};

// src/config/index.ts
import Conf from "conf";
import { homedir } from "os";
import { join } from "path";
import { existsSync, unlinkSync } from "fs";
var ConfigManager = class {
  constructor() {
    const configDir = join(homedir(), ".anytype-cli");
    const configPath = join(configDir, "config.json");
    try {
      this.conf = new Conf({
        projectName: "anytype-cli",
        cwd: configDir
      });
    } catch (error) {
      if (error instanceof SyntaxError && error.message.includes("JSON")) {
        if (existsSync(configPath)) {
          unlinkSync(configPath);
        }
        this.conf = new Conf({
          projectName: "anytype-cli",
          cwd: configDir
        });
      } else {
        throw error;
      }
    }
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

// src/cli/commands/types.ts
import { Command as Command2 } from "commander";

// src/cli/output.ts
function formatAsJson(data) {
  return JSON.stringify(data, null, 2);
}
function formatIcon(icon) {
  if (typeof icon === "string") {
    return icon;
  }
  if (typeof icon === "object" && icon !== null) {
    const iconObj = icon;
    if (iconObj.emoji) {
      return iconObj.emoji;
    }
    if (iconObj.file) {
      return iconObj.file;
    }
    if (iconObj.url) {
      return iconObj.url;
    }
    if (iconObj.name) {
      return iconObj.name;
    }
  }
  return "-";
}
function formatPropertyValue(prop) {
  if (prop.object !== "property" || !prop.format || !prop.name) {
    return null;
  }
  const name = prop.name;
  const format = prop.format;
  switch (format) {
    case "date":
      if (prop.date) {
        const date = new Date(prop.date);
        return { name, value: date.toLocaleDateString() };
      }
      return { name, value: "-" };
    case "number":
      if (prop.number !== void 0 && prop.number !== null) {
        return { name, value: String(prop.number) };
      }
      return { name, value: "-" };
    case "text":
      if (prop.text) {
        return { name, value: prop.text };
      }
      return { name, value: "-" };
    case "select":
      if (prop.select && typeof prop.select === "object") {
        const select = prop.select;
        return { name, value: select.name || select.key || "-" };
      }
      return { name, value: "-" };
    case "multi_select":
      if (Array.isArray(prop.multi_select) && prop.multi_select.length > 0) {
        const tags = prop.multi_select.map(
          (tag) => tag.name || tag.key
        );
        return { name, value: tags.join(", ") };
      }
      return { name, value: "-" };
    case "objects":
      if (Array.isArray(prop.objects) && prop.objects.length > 0) {
        const count = prop.objects.length;
        return { name, value: `${count} object${count > 1 ? "s" : ""}` };
      }
      return { name, value: "-" };
    case "checkbox":
      return { name, value: prop.checkbox ? "Yes" : "No" };
    case "url":
      if (prop.url) {
        return { name, value: prop.url };
      }
      return { name, value: "-" };
    case "email":
      if (prop.email) {
        return { name, value: prop.email };
      }
      return { name, value: "-" };
    case "phone":
      if (prop.phone) {
        return { name, value: prop.phone };
      }
      return { name, value: "-" };
    default:
      return { name, value: "-" };
  }
}
function formatValue(value, indent = 0) {
  if (value === null) {
    return "null";
  }
  if (value === void 0) {
    return "undefined";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    if (value.every((v) => typeof v !== "object" || v === null)) {
      return value.map((v) => formatValue(v)).join(", ");
    }
    const prefix = "  ".repeat(indent + 1);
    return "\n" + value.map((v, i) => `${prefix}${i + 1}. ${formatValue(v, indent + 1)}`).join("\n");
  }
  if (typeof value === "object") {
    const obj = value;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return "{}";
    }
    if (keys.length <= 3) {
      const parts = keys.filter((k) => obj[k] !== void 0 && obj[k] !== null).map((k) => `${k}: ${formatValue(obj[k], indent + 1)}`);
      return parts.join(", ");
    }
    return JSON.stringify(obj);
  }
  return String(value);
}
function formatTypesAsMarkdown(types) {
  if (types.length === 0) {
    return "No types found.";
  }
  const lines = [];
  lines.push("| Type Name | Type Key | Property Count |");
  lines.push("|-----------|----------|----------------|");
  for (const type of types) {
    const propCount = Object.keys(type.properties || {}).length;
    lines.push(`| ${type.name} | \`${type.key}\` | ${propCount} |`);
  }
  return lines.join("\n");
}
function formatObjectsAsMarkdown(objects, fields) {
  if (objects.length === 0) {
    return "No objects found.";
  }
  const displayFields = fields || ["name", "id", "updated_at"];
  const headers = displayFields.map((f) => {
    return f.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  });
  const lines = [];
  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`|${headers.map(() => "---------").join("|")}|`);
  for (const obj of objects) {
    const row = displayFields.map((field) => {
      const value = obj[field];
      if (value === void 0 || value === null) {
        return "-";
      }
      const formatted = formatValue(value);
      const singleLine = formatted.replace(/\n/g, " ").trim();
      return singleLine.length > 30 ? singleLine.substring(0, 27) + "..." : singleLine;
    });
    lines.push(`| ${row.join(" | ")} |`);
  }
  return lines.join("\n");
}
function formatObjectAsText(obj) {
  const lines = [];
  lines.push(`# ${obj.name}`);
  lines.push("");
  lines.push(`**ID:** \`${obj.id}\``);
  lines.push(`**Type:** ${obj.type?.key || obj.type_key}`);
  if (obj.icon) {
    lines.push(`**Icon:** ${formatIcon(obj.icon)}`);
  }
  if (obj.created_at) {
    lines.push(`**Created:** ${new Date(obj.created_at).toLocaleDateString()}`);
  }
  if (obj.updated_at) {
    lines.push(
      `**Updated:** ${new Date(obj.updated_at).toLocaleDateString()}`
    );
  }
  if (obj.properties && obj.properties.length > 0) {
    lines.push("");
    lines.push("## Properties");
    for (const prop of obj.properties) {
      const formatted = formatPropertyValue(prop);
      if (formatted) {
        lines.push(`- **${formatted.name}:** ${formatted.value}`);
      }
    }
  }
  if (obj.markdown && obj.markdown.trim()) {
    lines.push("");
    lines.push("## Content");
    lines.push("");
    lines.push(obj.markdown);
  }
  return lines.join("\n");
}
function formatSearchResultsAsMarkdown(results) {
  if (results.length === 0) {
    return "No results found.";
  }
  const lines = [];
  for (const result of results) {
    lines.push(`- **${result.name}** (\`${result.id}\`)`);
    if (result.snippet) {
      lines.push(`  > ${result.snippet.substring(0, 80)}...`);
    }
    if (result.type_key) {
      lines.push(`  *Type: ${result.type_key}*`);
    }
  }
  return lines.join("\n");
}

// src/cli/commands/types.ts
function createTypesCommand() {
  const command = new Command2("types").description("List all object types in the default space").option("--json", "Output as JSON instead of markdown").action(async (options) => {
    try {
      await typesAction(options);
    } catch (error) {
      handleError(error, options.verbose);
    }
  });
  return command;
}
async function typesAction(options) {
  const apiKey = config.getApiKey();
  if (!apiKey) {
    throw new ConfigError(
      "API key not configured. Run `anytype init` first."
    );
  }
  const spaceId = config.getDefaultSpace();
  if (!spaceId) {
    throw new ConfigError(
      "No default space configured. Run `anytype init` first."
    );
  }
  const client = new AnytypeClient(config.getBaseURL(), apiKey);
  const types = await client.getTypes(spaceId);
  if (options.json) {
    console.log(formatAsJson(types));
  } else {
    console.log(formatTypesAsMarkdown(types));
  }
}

// src/cli/commands/list.ts
import { Command as Command3 } from "commander";
function createListCommand() {
  const command = new Command3("list").arguments("<type>").description("List objects of a given type").option("--linked-to <name>", "Filter by linked object name").option("--since <date>", 'Filter by date (ISO format or "today")').option("--limit <n>", "Limit number of results", "100").option("--fields <list>", "Select specific fields (comma-separated)").option("--orphan", "Show only orphan objects (no links)").option("--json", "Output as JSON instead of markdown").option("--verbose", "Show detailed output").action(async (type, options) => {
    try {
      await listAction(type, options);
    } catch (error) {
      handleError(error, options.verbose);
    }
  });
  return command;
}
async function listAction(typeInput, options) {
  const apiKey = config.getApiKey();
  if (!apiKey) {
    throw new ConfigError(
      "API key not configured. Run `anytype init` first."
    );
  }
  const spaceId = config.getDefaultSpace();
  if (!spaceId) {
    throw new ConfigError(
      "No default space configured. Run `anytype init` first."
    );
  }
  const typeKey = config.resolveAlias(typeInput);
  const client = new AnytypeClient(config.getBaseURL(), apiKey);
  const limit = Math.min(parseInt(options.limit || "100", 10), 1e3);
  let objects = await client.getObjects(spaceId, {
    type_key: typeKey,
    limit
  });
  if (options.since) {
    const sinceDate = parseDateFilter(options.since);
    objects = objects.filter((obj) => {
      if (!obj.updated_at) return false;
      return new Date(obj.updated_at) >= sinceDate;
    });
  }
  if (options.linkedTo) {
    const searchResults = await client.search(options.linkedTo, { limit: 10 });
    const targetResult = searchResults.find(
      (r) => r.name.toLowerCase() === options.linkedTo.toLowerCase()
    ) || searchResults[0];
    if (!targetResult) {
      throw new ValidationError(`No object found matching "${options.linkedTo}"`);
    }
    const targetId = targetResult.id;
    const targetBacklinks = /* @__PURE__ */ new Set();
    const backlinksProperty = targetResult.properties?.find(
      (p) => p.key === "backlinks"
    );
    if (backlinksProperty?.objects) {
      for (const id of backlinksProperty.objects) {
        targetBacklinks.add(id);
      }
    }
    const mentionResults = await client.searchInSpace(spaceId, options.linkedTo, {
      type_key: typeKey,
      limit
    });
    const mentionIds = new Set(mentionResults.map((r) => r.id));
    objects = objects.filter((obj) => {
      if (mentionIds.has(obj.id)) {
        return true;
      }
      if (targetBacklinks.has(obj.id)) {
        return true;
      }
      const linksProperty = obj.properties?.find(
        (p) => p.key === "links"
      );
      if (linksProperty?.objects?.includes(targetId)) {
        return true;
      }
      return false;
    });
    if (options.verbose) {
      console.error(`[DEBUG] Objects after filter: ${objects.length}`);
    }
  }
  if (options.orphan) {
    objects = objects.filter((obj) => {
      const linksProperty = obj.properties?.find(
        (p) => p.key === "links"
      );
      const backlinksProperty = obj.properties?.find(
        (p) => p.key === "backlinks"
      );
      const hasLinks = (linksProperty?.objects?.length || 0) > 0;
      const hasBacklinks = (backlinksProperty?.objects?.length || 0) > 0;
      return !hasLinks && !hasBacklinks;
    });
  }
  const fields = options.fields ? options.fields.split(",").map((f) => f.trim()) : void 0;
  if (options.json) {
    console.log(formatAsJson(objects));
  } else {
    console.log(formatObjectsAsMarkdown(objects, fields));
  }
}
function parseDateFilter(dateStr) {
  if (dateStr === "today") {
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }
  throw new ValidationError(`Invalid date format: ${dateStr}. Use ISO format (YYYY-MM-DD) or "today".`);
}

// src/cli/commands/get.ts
import { Command as Command4 } from "commander";
function createGetCommand() {
  const command = new Command4("get").arguments("<type> <identifier>").description("Get full details of a single object by ID or name").option("--json", "Output as JSON instead of markdown").option("--verbose", "Show detailed output").action(async (type, identifier, options) => {
    try {
      await getAction(type, identifier, options);
    } catch (error) {
      handleError(error, options.verbose);
    }
  });
  return command;
}
async function getAction(typeInput, identifier, options) {
  const apiKey = config.getApiKey();
  if (!apiKey) {
    throw new ConfigError(
      "API key not configured. Run `anytype init` first."
    );
  }
  const spaceId = config.getDefaultSpace();
  if (!spaceId) {
    throw new ConfigError(
      "No default space configured. Run `anytype init` first."
    );
  }
  const typeKey = config.resolveAlias(typeInput);
  const client = new AnytypeClient(config.getBaseURL(), apiKey);
  let object;
  try {
    object = await client.getObject(spaceId, identifier, { format: "markdown" });
  } catch {
    const objects = await client.getObjects(spaceId, {
      type_key: typeKey,
      limit: 100
    });
    const found = objects.find((obj) => obj.name === identifier);
    if (!found) {
      throw new NotFoundError(
        `Object "${identifier}" not found (type: ${typeInput})`
      );
    }
    object = await client.getObject(spaceId, found.id, { format: "markdown" });
  }
  if (options.json) {
    console.log(formatAsJson(object));
  } else {
    console.log(formatObjectAsText(object));
  }
}

// src/cli/commands/search.ts
import { Command as Command5 } from "commander";
function createSearchCommand() {
  const command = new Command5("search").arguments("<query>").description("Search for objects across all types").option("--type <type>", "Filter by type key").option("--limit <n>", "Limit number of results", "20").option("--offset <n>", "Pagination offset", "0").option("--json", "Output as JSON instead of markdown").option("--verbose", "Show detailed output").action(async (query, options) => {
    try {
      await searchAction(query, options);
    } catch (error) {
      handleError(error, options.verbose);
    }
  });
  return command;
}
async function searchAction(query, options) {
  const apiKey = config.getApiKey();
  if (!apiKey) {
    throw new ConfigError(
      "API key not configured. Run `anytype init` first."
    );
  }
  const client = new AnytypeClient(config.getBaseURL(), apiKey);
  const limit = Math.min(parseInt(options.limit || "20", 10), 1e3);
  const offset = Math.max(parseInt(options.offset || "0", 10), 0);
  let typeKey;
  if (options.type) {
    typeKey = config.resolveAlias(options.type);
  }
  const results = await client.search(query, {
    type_key: typeKey,
    limit,
    offset
  });
  if (options.json) {
    console.log(formatAsJson(results));
  } else {
    console.log(formatSearchResultsAsMarkdown(results));
  }
}

// src/cli/commands/create.ts
import { Command as Command6 } from "commander";
import { readFileSync } from "fs";
async function readStdinIfAvailable() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolve(data);
    });
    process.stdin.on("error", () => {
      resolve("");
    });
  });
}
function createCreateCommand() {
  const command = new Command6("create").arguments("<type> [name]").description("Create a new object").option("--body <md>", 'Markdown body content (use "-" to read from stdin)').option("--body-file <path>", "Read body from file").option("--property <key=value>", "Set object property (repeatable)", collect, []).option("--link-to <id>", "Link to another object by ID").option("--dry-run", "Preview without creating").option("--json", "Output as JSON instead of markdown").option("--verbose", "Show detailed output").action(async (type, name, options) => {
    try {
      await createAction(type, name, options);
    } catch (error) {
      handleError(error, options.verbose);
    }
  });
  return command;
}
function collect(value, previous) {
  const [key, val] = value.split("=");
  if (!key || !val) {
    throw new ValidationError("Properties must be in format key=value");
  }
  return previous.concat({ key, value: val });
}
async function createAction(typeInput, name, options) {
  const apiKey = config.getApiKey();
  if (!apiKey) {
    throw new ConfigError(
      "API key not configured. Run `anytype init` first."
    );
  }
  const spaceId = config.getDefaultSpace();
  if (!spaceId) {
    throw new ConfigError(
      "No default space configured. Run `anytype init` first."
    );
  }
  const typeKey = config.resolveAlias(typeInput);
  let body = options.body;
  if (options.bodyFile) {
    body = readFileSync(options.bodyFile, "utf-8");
  } else if (body === "-") {
    body = await readStdinIfAvailable();
  } else if (!body && !options.bodyFile) {
    const stdinData = await readStdinIfAvailable();
    if (stdinData) {
      body = stdinData;
    }
  }
  const properties = {};
  for (const prop of options.property) {
    properties[prop.key] = prop.value;
  }
  const data = {
    name: name || `New ${typeInput}`,
    type_key: typeKey,
    body,
    properties: Object.keys(properties).length > 0 ? properties : void 0
  };
  if (options.dryRun) {
    console.log("Would create object with:");
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  const client = new AnytypeClient(config.getBaseURL(), apiKey);
  const createdObject = await client.createObject(spaceId, data);
  if (options.linkTo) {
    console.log(`Created object: ${createdObject.id}`);
    console.log(`To link to ${options.linkTo}, use:`);
    console.log(`  anytype update ${createdObject.id} --link-to ${options.linkTo}`);
  } else {
    if (options.json) {
      console.log(formatAsJson(createdObject));
    } else {
      console.log(`\u2713 Created object: ${createdObject.id}`);
      console.log(`  Name: ${createdObject.name}`);
      console.log(`  Type: ${createdObject.type_key}`);
    }
  }
}

// src/cli/commands/update.ts
import { Command as Command7 } from "commander";
import { readFileSync as readFileSync2 } from "fs";
async function readStdinIfAvailable2() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolve(data);
    });
    process.stdin.on("error", () => {
      resolve("");
    });
  });
}
function createUpdateCommand() {
  const command = new Command7("update").arguments("<identifier>").description("Update an existing object").option("--name <name>", "Rename object").option("--body <md>", 'Replace body content (use "-" to read from stdin)').option("--append <md>", "Append to body content").option("--body-file <path>", "Read body from file").option("--property <key=value>", "Update object property (repeatable)", collect2, []).option("--link-to <id>", "Link to another object by ID").option("--unlink-from <id>", "Remove link to object").option("--dry-run", "Preview without updating").option("--json", "Output as JSON instead of markdown").option("--verbose", "Show detailed output").action(async (identifier, options) => {
    try {
      await updateAction(identifier, options);
    } catch (error) {
      handleError(error, options.verbose);
    }
  });
  return command;
}
function collect2(value, previous) {
  const [key, val] = value.split("=");
  if (!key || !val) {
    throw new ValidationError("Properties must be in format key=value");
  }
  return previous.concat({ key, value: val });
}
async function updateAction(identifier, options) {
  const apiKey = config.getApiKey();
  if (!apiKey) {
    throw new ConfigError(
      "API key not configured. Run `anytype init` first."
    );
  }
  const spaceId = config.getDefaultSpace();
  if (!spaceId) {
    throw new ConfigError(
      "No default space configured. Run `anytype init` first."
    );
  }
  const client = new AnytypeClient(config.getBaseURL(), apiKey);
  let object;
  try {
    object = await client.getObject(spaceId, identifier);
  } catch {
    throw new NotFoundError(`Object "${identifier}" not found`);
  }
  const updateData = {};
  if (options.name) {
    updateData.name = options.name;
  }
  if (options.body) {
    if (options.body === "-") {
      updateData.body = await readStdinIfAvailable2();
    } else {
      updateData.body = options.body;
    }
  } else if (options.append) {
    updateData.body = (object.body || "") + "\n" + options.append;
  } else if (options.bodyFile) {
    updateData.body = readFileSync2(options.bodyFile, "utf-8");
  }
  const properties = { ...object.properties };
  for (const prop of options.property) {
    properties[prop.key] = prop.value;
  }
  if (options.property.length > 0) {
    updateData.properties = properties;
  }
  if (options.dryRun) {
    console.log("Would update object with:");
    console.log(JSON.stringify(updateData, null, 2));
    if (options.linkTo) {
      console.log(`
Would also link to: ${options.linkTo}`);
    }
    if (options.unlinkFrom) {
      console.log(`
Would also unlink from: ${options.unlinkFrom}`);
    }
    return;
  }
  if (Object.keys(updateData).length > 0) {
    const updated = await client.updateObject(spaceId, object.id, updateData);
    if (options.json) {
      console.log(formatAsJson(updated));
    } else {
      console.log(`\u2713 Updated object: ${updated.id}`);
      if (options.name) console.log(`  Name: ${updated.name}`);
      if (options.body || options.append || options.bodyFile) console.log(`  Body updated`);
      if (options.property.length > 0) console.log(`  Properties updated`);
    }
  } else {
    console.log(`No changes to apply`);
  }
}

// src/cli/commands/alias.ts
import { Command as Command8 } from "commander";
function createAliasCommand() {
  const command = new Command8("alias").description("Manage type aliases");
  command.command("list").description("List all configured aliases").action(() => {
    listAliases();
  });
  command.command("set <alias> <type_key>").description("Create or update an alias").action((alias, typeKey) => {
    try {
      setAlias(alias, typeKey);
    } catch (error) {
      handleError(error, false);
    }
  });
  command.command("remove <alias>").description("Remove an alias").action((alias) => {
    try {
      removeAlias(alias);
    } catch (error) {
      handleError(error, false);
    }
  });
  return command;
}
function listAliases() {
  const aliases = config.getAliases();
  if (Object.keys(aliases).length === 0) {
    console.log("No aliases configured.");
    return;
  }
  console.log("Configured aliases:\n");
  const maxLen = Math.max(...Object.keys(aliases).map((k) => k.length));
  for (const [alias, typeKey] of Object.entries(aliases)) {
    console.log(`  ${alias.padEnd(maxLen)}  \u2192  ${typeKey}`);
  }
}
function setAlias(alias, typeKey) {
  config.addAlias(alias, typeKey);
  console.log(`\u2713 Alias set: ${alias} \u2192 ${typeKey}`);
}
function removeAlias(alias) {
  config.removeAlias(alias);
  console.log(`\u2713 Alias removed: ${alias}`);
}

// src/index.ts
var packageJson = {
  version: "1.0.0",
  description: "CLI tool for interacting with Anytype objects"
};
var program = new Command9();
program.name("anytype").description(packageJson.description).version(packageJson.version, "-v, --version", "Output version number").option("--verbose", "Show detailed output and errors", false).option("--no-color", "Disable colored output", false).option("--space <id>", "Override default space").option("--dry-run", "Preview changes without executing", false).hook("preAction", (thisCommand) => {
  const options = thisCommand.opts();
});
program.addCommand(createInitCommand());
program.addCommand(createTypesCommand());
program.addCommand(createListCommand());
program.addCommand(createGetCommand());
program.addCommand(createSearchCommand());
program.addCommand(createCreateCommand());
program.addCommand(createUpdateCommand());
program.addCommand(createAliasCommand());
program.parse(process.argv);
if (!process.argv.slice(2).length) {
  program.outputHelp();
  process.exit(0);
}
