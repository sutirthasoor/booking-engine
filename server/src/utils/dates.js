// All date handling is done on plain YYYY-MM-DD strings in UTC so that results never
// depend on the timezone of the machine that runs the server.

const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidDateString(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str) && !Number.isNaN(new Date(str).getTime());
}

/** Dates (YYYY-MM-DD) of every night from start (inclusive) to end (exclusive). */
export function getDatesBetween(startStr, endStr) {
  const dates = [];
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return dates;
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export function calculateNights(checkinStr, checkoutStr) {
  const checkin = new Date(checkinStr);
  const checkout = new Date(checkoutStr);
  return Math.ceil((checkout - checkin) / DAY_MS);
}

/** "30 Oct 2026" */
export function formatDateForDisplay(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function todayUtc() {
  return new Date().toISOString().split('T')[0];
}
