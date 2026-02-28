import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseDateFilter } from './date.js';

describe('parseDateFilter', () => {
  beforeEach(() => {
    // Fix "now" to 2025-06-15 12:00:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 15, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should parse "today" as midnight today', () => {
    const result = parseDateFilter('today');
    expect(result).toEqual(new Date(2025, 5, 15, 0, 0, 0, 0));
  });

  it('should parse "7d" as 7 days ago at midnight', () => {
    const result = parseDateFilter('7d');
    expect(result).toEqual(new Date(2025, 5, 8, 0, 0, 0, 0));
  });

  it('should parse "1d" as 1 day ago at midnight', () => {
    const result = parseDateFilter('1d');
    expect(result).toEqual(new Date(2025, 5, 14, 0, 0, 0, 0));
  });

  it('should parse "2w" as 14 days ago at midnight', () => {
    const result = parseDateFilter('2w');
    expect(result).toEqual(new Date(2025, 5, 1, 0, 0, 0, 0));
  });

  it('should parse "1m" as 1 month ago at midnight', () => {
    const result = parseDateFilter('1m');
    expect(result).toEqual(new Date(2025, 4, 15, 0, 0, 0, 0));
  });

  it('should parse "3m" as 3 months ago at midnight', () => {
    const result = parseDateFilter('3m');
    expect(result).toEqual(new Date(2025, 2, 15, 0, 0, 0, 0));
  });

  it('should parse ISO date string', () => {
    const result = parseDateFilter('2025-01-01');
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(1);
  });

  it('should throw on invalid date string', () => {
    expect(() => parseDateFilter('not-a-date')).toThrow('Invalid date format');
  });

  it('should throw on empty string', () => {
    expect(() => parseDateFilter('')).toThrow('Invalid date format');
  });

  it('should throw on invalid unit', () => {
    // "7x" doesn't match the regex, so falls through to ISO parsing
    expect(() => parseDateFilter('7x')).toThrow('Invalid date format');
  });
});
