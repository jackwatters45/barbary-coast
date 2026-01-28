/**
 * Parse a date string and return a Date object in local time.
 * Handles both ISO strings (2026-01-11T13:00:00.000Z) and date-only strings (2026-01-11).
 * Avoids timezone shift issues when displaying dates.
 */
export function parseLocalDate(dateStr: string): Date {
  // If it's a full ISO string, extract just the date part
  const datePart = dateStr.split('T')[0];
  // Parse as local time by adding T00:00:00 (no Z suffix)
  return new Date(datePart + 'T00:00:00');
}
