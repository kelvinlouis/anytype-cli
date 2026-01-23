import { Command } from 'commander';
import { AnytypeClient } from '../../api/client.js';
import { config } from '../../config/index.js';
import { ConfigError, handleError } from '../../utils/errors.js';

/**
 * Create the `init` command
 */
export function createInitCommand(): Command {
  const command = new Command('init')
    .description('Initialize Anytype CLI with API key and default space')
    .option('--api-key <key>', 'API key (will prompt if not provided)')
    .action(async (options) => {
      try {
        await initAction(options);
      } catch (error) {
        handleError(error, options.verbose);
      }
    });

  return command;
}

interface InitOptions {
  apiKey?: string;
  verbose?: boolean;
}

/**
 * Initialize CLI configuration
 */
async function initAction(options: InitOptions): Promise<void> {
  let apiKey = options.apiKey;

  // Validate API key was provided
  if (!apiKey) {
    throw new ConfigError(
      'API key is required. Use --api-key <key> to provide it, or run without flags for interactive mode.'
    );
  }

  // Validate API key by calling /v1/spaces
  const client = new AnytypeClient(config.getBaseURL(), apiKey);

  console.log('Validating API key...');
  const spaces = await client.getSpaces();

  if (!spaces || spaces.length === 0) {
    throw new ConfigError('No spaces found in Anytype. Please create a space first.');
  }

  // Save configuration
  config.setApiKey(apiKey);

  // Set first space as default if not already set
  if (!config.getDefaultSpace() && spaces.length > 0) {
    config.setDefaultSpace(spaces[0].id);
    console.log(`✓ Default space set to: ${spaces[0].name}`);
  }

  // Set default aliases
  const defaultAliases: Record<string, string> = {
    team: 'team_member',
    member: 'team_member',
    '1on1': 'one_on_one',
    goal: 'team_member_goal',
    goals: 'team_member_goal',
    mag: 'appraisal',
    training: 'team_member_training',
    education: 'team_member_training',
  };
  config.setAliases(defaultAliases);

  console.log('✓ Configuration saved successfully');
  console.log(`✓ Found ${spaces.length} space(s)`);
  console.log('✓ Default aliases configured');
  console.log('\nYou can now use anytype commands. Try:');
  console.log('  anytype --help');
  console.log('  anytype types');
}
