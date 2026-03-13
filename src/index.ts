#!/usr/bin/env node

import { Command } from 'commander';
import { createInitCommand } from './cli/commands/init.js';
import { createTypesCommand } from './cli/commands/types.js';
import { createListCommand } from './cli/commands/list.js';
import { createGetCommand } from './cli/commands/get.js';
import { createSearchCommand } from './cli/commands/search.js';
import { createCreateCommand } from './cli/commands/create.js';
import { createUpdateCommand } from './cli/commands/update.js';
import { createAliasCommand } from './cli/commands/alias.js';
import { createFieldsCommand } from './cli/commands/fields.js';
import { createTemplatesCommand } from './cli/commands/templates.js';

const CLI_VERSION = '1.0.0';
const CLI_DESCRIPTION = 'CLI tool for interacting with Anytype objects';

const program = new Command();

program
  .name('anytype')
  .description(CLI_DESCRIPTION)
  .version(CLI_VERSION, '-v, --version', 'Output version number')
  .option('--verbose', 'Show detailed output and errors', false)
  .option('--no-color', 'Disable colored output', false)
  .option('--space <id>', 'Override default space')
  .option('--dry-run', 'Preview changes without executing', false);

// Add commands
program.addCommand(createInitCommand());
program.addCommand(createTypesCommand());
program.addCommand(createListCommand());
program.addCommand(createGetCommand());
program.addCommand(createSearchCommand());
program.addCommand(createCreateCommand());
program.addCommand(createUpdateCommand());
program.addCommand(createAliasCommand());
program.addCommand(createFieldsCommand());
program.addCommand(createTemplatesCommand());

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
  process.exit(0);
}
