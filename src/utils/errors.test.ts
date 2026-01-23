import { describe, it, expect } from 'vitest';
import {
  EXIT_CODES,
  CLIError,
  ConfigError,
  ConnectionError,
  NotFoundError,
  ValidationError,
} from './errors.js';

describe('Error Classes', () => {
  describe('EXIT_CODES', () => {
    it('should have correct exit code values', () => {
      expect(EXIT_CODES.SUCCESS).toBe(0);
      expect(EXIT_CODES.GENERAL_ERROR).toBe(1);
      expect(EXIT_CODES.CONFIG_ERROR).toBe(2);
      expect(EXIT_CODES.CONNECTION_ERROR).toBe(3);
      expect(EXIT_CODES.NOT_FOUND).toBe(4);
      expect(EXIT_CODES.VALIDATION_ERROR).toBe(5);
    });
  });

  describe('CLIError', () => {
    it('should create a CLI error with default exit code', () => {
      const error = new CLIError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
      expect(error.name).toBe('CLIError');
    });

    it('should create a CLI error with custom exit code', () => {
      const error = new CLIError('Test error', 42);
      expect(error.exitCode).toBe(42);
    });

    it('should store cause error', () => {
      const cause = new Error('Original error');
      const error = new CLIError('Test error', EXIT_CODES.GENERAL_ERROR, true, cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('ConfigError', () => {
    it('should have CONFIG_ERROR exit code', () => {
      const error = new ConfigError('Missing API key');
      expect(error.exitCode).toBe(EXIT_CODES.CONFIG_ERROR);
      expect(error.name).toBe('ConfigError');
    });
  });

  describe('ConnectionError', () => {
    it('should have CONNECTION_ERROR exit code', () => {
      const error = new ConnectionError('Cannot connect');
      expect(error.exitCode).toBe(EXIT_CODES.CONNECTION_ERROR);
      expect(error.name).toBe('ConnectionError');
    });
  });

  describe('NotFoundError', () => {
    it('should have NOT_FOUND exit code', () => {
      const error = new NotFoundError('Object not found');
      expect(error.exitCode).toBe(EXIT_CODES.NOT_FOUND);
      expect(error.name).toBe('NotFoundError');
    });
  });

  describe('ValidationError', () => {
    it('should have VALIDATION_ERROR exit code', () => {
      const error = new ValidationError('Invalid input');
      expect(error.exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
      expect(error.name).toBe('ValidationError');
    });
  });
});
