export class ApiError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} message human readable message (also used as the toast text)
   * @param {{toastType?: string, details?: any}} [opts]
   */
  constructor(status, message, opts = {}) {
    super(message);
    this.status = status;
    this.toastType = opts.toastType || 'error';
    this.details = opts.details;
  }
}

export const badRequest = (message, toastType = 'error') => new ApiError(400, message, { toastType });
export const notFound = (message) => new ApiError(404, message);

export const toast = (type, message) => ({ type, message });
