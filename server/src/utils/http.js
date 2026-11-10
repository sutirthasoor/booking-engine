import { ApiError, toast } from './errors.js';
import { isValidDateString } from './dates.js';

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Same checks as the original search form. */
export function assertValidDates(checkin, checkout) {
  if (!checkin || !checkout) throw new ApiError(400, 'Please select check-in and check-out dates');
  if (!isValidDateString(checkin) || !isValidDateString(checkout)) {
    throw new ApiError(400, 'Please select check-in and check-out dates');
  }
  if (new Date(checkin) >= new Date(checkout)) {
    throw new ApiError(400, 'Check-out date must be after check-in date');
  }
}

export const ok = (res, data = {}) => res.json({ ok: true, ...data });

/** Business-rule failure that is still a normal answer (HTTP 200, ok:false) so the UI can show the toasts. */
export const refuse = (res, toasts, extra = {}) =>
  res.json({ ok: false, toasts: Array.isArray(toasts) ? toasts : [toast('error', String(toasts))], ...extra });
