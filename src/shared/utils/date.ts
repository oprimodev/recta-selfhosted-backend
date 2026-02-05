/**
 * Date utilities for UTC-3 timezone (Brazil)
 * All dates are handled in UTC-3 to ensure consistency
 * 
 * Note: With process.env.TZ = 'America/Sao_Paulo', JavaScript Date objects
 * will automatically use UTC-3 when created and formatted.
 */

/**
 * Get current date/time (will use UTC-3 due to TZ env var)
 */
export function now(): Date {
  return new Date();
}

/**
 * Create a date with specific components (interpreted in UTC-3)
 */
export function createDate(year: number, month: number, day: number, hours = 0, minutes = 0, seconds = 0, milliseconds = 0): Date {
  // When TZ is set to America/Sao_Paulo, new Date() constructor will interpret
  // the local time components correctly
  const date = new Date(year, month - 1, day, hours, minutes, seconds, milliseconds);
  return date;
}

/**
 * Get start of day in UTC-3
 */
export function startOfDay(date: Date): Date {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return createDate(year, month, day, 0, 0, 0, 0);
}

/**
 * Get end of day in UTC-3
 */
export function endOfDay(date: Date): Date {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return createDate(year, month, day, 23, 59, 59, 999);
}

/**
 * Get start of month in UTC-3
 */
export function startOfMonth(year: number, month: number): Date {
  return createDate(year, month, 1, 0, 0, 0, 0);
}

/**
 * Get end of month in UTC-3
 */
export function endOfMonth(year: number, month: number): Date {
  // Get last day of month
  const lastDay = new Date(year, month, 0).getDate();
  return createDate(year, month, lastDay, 23, 59, 59, 999);
}

/**
 * Parse a date string (YYYY-MM-DD) and create a date in UTC-3
 * The date is interpreted as local time in UTC-3
 */
export function parseDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return createDate(year, month, day);
}

/**
 * Format date to YYYY-MM-DD in UTC-3
 */
export function formatDate(date: Date): string {
  // With TZ set to America/Sao_Paulo, these methods return values in UTC-3
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Get current date in YYYY-MM-DD format (UTC-3)
 */
export function today(): string {
  return formatDate(now());
}

/**
 * Convert a date to ISO string (standard ISO format, preserving UTC-3 time)
 * Note: toISOString() always returns UTC, but the time value represents the correct moment
 */
export function toISOStringUTC3(date: Date): string {
  // For API responses, we typically want ISO string in UTC
  // The actual moment in time is preserved regardless of timezone
  return date.toISOString();
}

