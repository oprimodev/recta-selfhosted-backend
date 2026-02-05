import { z } from 'zod';

/**
 * Custom date parser that treats YYYY-MM-DD strings as local dates, not UTC
 * This prevents timezone conversion issues where dates shift by a day
 * 
 * When JavaScript parses "2024-01-08", it interprets it as UTC midnight,
 * which can become the previous day in timezones behind UTC (like UTC-3).
 * This schema ensures dates are parsed as local dates.
 */
export const localDateSchema = z.preprocess((val) => {
  if (val instanceof Date) {
    // If already a Date, normalize to local midnight to ensure consistency
    return new Date(val.getFullYear(), val.getMonth(), val.getDate(), 0, 0, 0, 0);
  }
  if (typeof val === 'string') {
    // Parse YYYY-MM-DD as local date, not UTC
    const parts = val.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed in JavaScript
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        // Create date in local timezone at midnight
        return new Date(year, month, day, 0, 0, 0, 0);
      }
    }
    // Fallback: try to parse as ISO string, but extract date part if possible
    if (val.includes('T') || val.includes('Z')) {
      // ISO format: extract just the date part (YYYY-MM-DD)
      const datePart = val.split('T')[0];
      const dateParts = datePart.split('-');
      if (dateParts.length === 3) {
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[2], 10);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          return new Date(year, month, day, 0, 0, 0, 0);
        }
      }
    }
    // Last resort: standard date parsing
    const parsed = new Date(val);
    // If parsing succeeded, normalize to local midnight
    if (!isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
    }
  }
  return val;
}, z.date());

