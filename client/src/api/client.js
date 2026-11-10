export class ApiError extends Error {
  constructor(message, status, toasts = []) {
    super(message);
    this.status = status;
    this.toasts = toasts;
  }
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError('Cannot reach the server. Please check your connection.', 0);
  }

  let json = null;
  try { json = await res.json(); } catch { /* non JSON */ }

  if (!res.ok) {
    throw new ApiError(json?.error || `Request failed (${res.status})`, res.status, json?.toasts || []);
  }
  return json;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body || {}),

  // hotels
  searchHotels: (p) => api.post('/hotels/search', p),
  selectHotel: (p) => api.post('/hotels/select', p),
  getRooms: (id, checkin, checkout) => api.get(`/hotels/${id}/rooms?checkin=${checkin}&checkout=${checkout}`),
  getPaymentConfig: (id) => api.get(`/hotels/${id}/payment-config`),

  // rooms
  roomRate: (p) => api.post('/rooms/rate', p),
  occupancyInit: (p) => api.post('/rooms/occupancy/init', p),
  occupancyUpdate: (p) => api.post('/rooms/occupancy/update', p),
  occupancyApply: (p) => api.post('/rooms/occupancy/apply', p),
  multiInit: (p) => api.post('/rooms/multi/init', p),
  multiUpdate: (p) => api.post('/rooms/multi/update', p),
  upgrade: (p) => api.post('/rooms/upgrade', p),
  selectRoom: (selection) => api.post('/rooms/select', { selection }),

  // booking
  quote: (p) => api.post('/booking/quote', p),
  validateGuest: (guest) => api.post('/booking/guest/validate', { guest }),
  startBooking: (p) => api.post('/bookings/start', p),
  confirmBooking: (p) => api.post('/bookings/confirm', p),
  emailVoucher: (receiptToken) => api.post('/bookings/email', { receiptToken }),
  downloadVoucher: (receiptToken) => api.post('/bookings/voucher', { receiptToken }),
};
