import { Command } from 'commander';
import { AnytypeClient } from '../../api/client.js';
import { config } from '../../config/index.js';
import { ConfigError, handleError } from '../../utils/errors.js';
import {
  formatAsJson,
  formatTemplatesAsMarkdown,
  formatTemplateDetailAsMarkdown,
} from '../output.js';

/**
 * Create the `templates` command
 */
export function createTemplatesCommand(): Command {
  const command = new Command('templates')
    .description('List templates for a type, or show detail for a specific template')
    .argument('<type>', 'Type key or alias')
    .argument('[template]', 'Template ID to show details for')
    .option('--json', 'Output as JSON instead of markdown')
    .action(async (type, template, options) => {
      try {
        if (template) {
          await templateDetailAction(type, template, options);
        } else {
          await templatesAction(type, options);
        }
      } catch (error) {
        handleError(error, options.verbose);
      }
    });

  return command;
}

interface TemplatesOptions {
  json?: boolean;
  verbose?: boolean;
}

/**
 * List all templates for a type
 */
async function templatesAction(typeArg: string, options: TemplatesOptions): Promise<void> {
  const apiKey = config.getApiKey();
  if (!apiKey) {
    throw new ConfigError('API key not configured. Run `anytype init` first.');
  }

  const spaceId = config.getDefaultSpace();
  if (!spaceId) {
    throw new ConfigError('No default space configured. Run `anytype init` first.');
  }

  const client = new AnytypeClient(config.getBaseURL(), apiKey);

  // Resolve alias and type
  const typeKey = config.resolveAlias(typeArg);
  const type = await client.resolveType(spaceId, typeKey);

  const templates = await client.getTemplates(spaceId, type.id);

  if (options.json) {
    console.log(formatAsJson(templates));
  } else {
    console.log(formatTemplatesAsMarkdown(templates));
  }
}

/**
 * Show detail for a specific template
 */
async function templateDetailAction(
  typeArg: string,
  templateId: string,
  options: TemplatesOptions,
): Promise<void> {
  const apiKey = config.getApiKey();
  if (!apiKey) {
    throw new ConfigError('API key not configured. Run `anytype init` first.');
  }

  const spaceId = config.getDefaultSpace();
  if (!spaceId) {
    throw new ConfigError('No default space configured. Run `anytype init` first.');
  }

  const client = new AnytypeClient(config.getBaseURL(), apiKey);

  // Resolve alias and type
  const typeKey = config.resolveAlias(typeArg);
  const type = await client.resolveType(spaceId, typeKey);

  const template = await client.getTemplate(spaceId, type.id, templateId);

  if (options.json) {
    console.log(formatAsJson(template));
  } else {
    console.log(formatTemplateDetailAsMarkdown(template));
  }
}
