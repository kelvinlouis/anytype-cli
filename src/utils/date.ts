import { ValidationError } from './errors.js';

/**
 * Parse a date filter string into a Date object.
 *
 * Supported formats:
 * - "today" → midnight today
 * - Relative: "7d" (days), "2w" (weeks), "1m" (months)
 * - ISO format: "2025-01-01"
 */
export function parseDateFilter(dateStr: string): Date {
  if (dateStr === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  // Relative date: e.g. "7d", "2w", "1m"
  const relativeMatch = dateStr.match(/^(\d+)([dwm])$/);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    switch (unit) {
      case 'd':
        date.setDate(date.getDate() - amount);
        break;
      case 'w':
        date.setDate(date.getDate() - amount * 7);
        break;
      case 'm':
        date.setMonth(date.getMonth() - amount);
        break;
    }

    return date;
  }

  // Try ISO format
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }

  throw new ValidationError(
    `Invalid date format: ${dateStr}. Use ISO format (YYYY-MM-DD), "today", or relative (7d, 2w, 1m).`,
  );
}
