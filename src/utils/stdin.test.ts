import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { readStdinIfAvailable } from './stdin.js';

describe('readStdinIfAvailable', () => {
  let originalStdin: typeof process.stdin;

  beforeEach(() => {
    originalStdin = process.stdin;
  });

  it('should return empty string when stdin is a TTY', async () => {
    const mockStdin = new EventEmitter() as typeof process.stdin;
    Object.defineProperty(mockStdin, 'isTTY', { value: true });
    Object.defineProperty(process, 'stdin', { value: mockStdin, configurable: true });

    const result = await readStdinIfAvailable();

    expect(result).toBe('');
    Object.defineProperty(process, 'stdin', { value: originalStdin, configurable: true });
  });

  it('should read piped data from stdin', async () => {
    const mockStdin = new EventEmitter() as typeof process.stdin;
    Object.defineProperty(mockStdin, 'isTTY', { value: false });
    (mockStdin as any).setEncoding = vi.fn();
    Object.defineProperty(process, 'stdin', { value: mockStdin, configurable: true });

    const promise = readStdinIfAvailable();

    mockStdin.emit('data', 'hello ');
    mockStdin.emit('data', 'world');
    mockStdin.emit('end');

    const result = await promise;

    expect(result).toBe('hello world');
    Object.defineProperty(process, 'stdin', { value: originalStdin, configurable: true });
  });

  it('should return empty string on stdin error', async () => {
    const mockStdin = new EventEmitter() as typeof process.stdin;
    Object.defineProperty(mockStdin, 'isTTY', { value: false });
    (mockStdin as any).setEncoding = vi.fn();
    Object.defineProperty(process, 'stdin', { value: mockStdin, configurable: true });

    const promise = readStdinIfAvailable();
    mockStdin.emit('error', new Error('read error'));

    const result = await promise;

    expect(result).toBe('');
    Object.defineProperty(process, 'stdin', { value: originalStdin, configurable: true });
  });
});
