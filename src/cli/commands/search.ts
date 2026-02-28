import { Command } from 'commander';
import { AnytypeClient } from '../../api/client.js';
import { config } from '../../config/index.js';
import { ConfigError, handleError } from '../../utils/errors.js';
import { formatAsJson, formatSearchResultsAsMarkdown } from '../output.js';

/**
 * Create the `search` command
 */
export function createSearchCommand(): Command {
  const command = new Command('search')
    .arguments('<query>')
    .description('Search for objects across all types')
    .option('--type <type>', 'Filter by type key')
    .option('--limit <n>', 'Limit number of results', '20')
    .option('--offset <n>', 'Pagination offset', '0')
    .option('--json', 'Output as JSON instead of markdown')
    .option('--verbose', 'Show detailed output')
    .action(async (query: string, options) => {
      try {
        await searchAction(query, options);
      } catch (error) {
        handleError(error, options.verbose);
      }
    });

  return command;
}

interface SearchOptions {
  type?: string;
  limit?: string;
  offset?: string;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Search for objects
 */
async function searchAction(query: string, options: SearchOptions): Promise<void> {
  // Get API key
  const apiKey = config.getApiKey();
  if (!apiKey) {
    throw new ConfigError('API key not configured. Run `anytype init` first.');
  }

  // Fetch search results
  const client = new AnytypeClient(config.getBaseURL(), apiKey);
  const limit = Math.min(parseInt(options.limit || '20', 10), 1000);
  const offset = Math.max(parseInt(options.offset || '0', 10), 0);

  let typeKey: string | undefined;
  if (options.type) {
    typeKey = config.resolveAlias(options.type);
  }

  const results = await client.search(query, {
    type_key: typeKey,
    limit,
    offset,
  });

  // Output results
  if (options.json) {
    console.log(formatAsJson(results));
  } else {
    console.log(formatSearchResultsAsMarkdown(results));
  }
}
