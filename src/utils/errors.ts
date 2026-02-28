/**
 * Exit code constants
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  CONFIG_ERROR: 2,
  CONNECTION_ERROR: 3,
  NOT_FOUND: 4,
  VALIDATION_ERROR: 5,
} as const;

/**
 * Custom error class for CLI errors
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public exitCode: number = EXIT_CODES.GENERAL_ERROR,
    public verbose?: boolean,
    public cause?: Error,
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

/**
 * Configuration error (missing API key, invalid config)
 */
export class ConfigError extends CLIError {
  constructor(message: string, cause?: Error) {
    super(message, EXIT_CODES.CONFIG_ERROR, undefined, cause);
    this.name = 'ConfigError';
  }
}

/**
 * Connection error (Anytype not running)
 */
export class ConnectionError extends CLIError {
  constructor(message: string, cause?: Error) {
    super(message, EXIT_CODES.CONNECTION_ERROR, undefined, cause);
    this.name = 'ConnectionError';
  }
}

/**
 * Not found error (object, type, or space doesn't exist)
 */
export class NotFoundError extends CLIError {
  constructor(message: string, cause?: Error) {
    super(message, EXIT_CODES.NOT_FOUND, undefined, cause);
    this.name = 'NotFoundError';
  }
}

/**
 * Validation error (invalid input)
 */
export class ValidationError extends CLIError {
  constructor(message: string, cause?: Error) {
    super(message, EXIT_CODES.VALIDATION_ERROR, undefined, cause);
    this.name = 'ValidationError';
  }
}

/**
 * Global error handler for the CLI
 */
export function handleError(error: unknown, verbose: boolean = false): never {
  if (error instanceof CLIError) {
    console.error(`Error: ${error.message}`);
    if (verbose && error.cause) {
      console.error('\nStack trace:');
      console.error(error.cause.stack);
    }
    process.exit(error.exitCode);
  }

  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
    if (verbose) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }

  console.error('Error:', error);
  process.exit(EXIT_CODES.GENERAL_ERROR);
}
