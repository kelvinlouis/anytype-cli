import { Command } from 'commander';
import { config } from '../../config/index.js';
import { DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT, DEFAULT_SEARCH_OFFSET } from '../../constants.js';
import { handleError } from '../../utils/errors.js';
import { formatAsJson, formatSearchResultsAsMarkdown } from '../output.js';
import { createAuthenticatedClient } from './shared.js';

interface SearchOptions {
  type?: string;
  limit?: string;
  offset?: string;
  json?: boolean;
  verbose?: boolean;
}

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

async function searchAction(query: string, options: SearchOptions): Promise<void> {
  const { client } = createAuthenticatedClient();
  const limit = Math.min(
    parseInt(options.limit || String(DEFAULT_SEARCH_LIMIT), 10),
    MAX_SEARCH_LIMIT,
  );
  const offset = Math.max(parseInt(options.offset || String(DEFAULT_SEARCH_OFFSET), 10), 0);

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
