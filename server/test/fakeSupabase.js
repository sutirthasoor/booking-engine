import { supabase } from '../src/supabase.js';

// ---------------------------------------------------------------- fake database
export const db = {
  hotels: [
    {
      id: 1, name: 'Kakkson Patia', location: 'Patia', logo: '', admin_email: 'admin@x.com',
      room_types: ['DELUXE', 'SUITE'],
      photos: ['https://img/1.jpg'],
      inventory: {
        '2030-01-10': { DELUXE: 3, SUITE: 1 },
        '2030-01-11': { DELUXE: 2, SUITE: 1 },
      },
      room_details: {
        DELUXE: { maxAdults: 3, maxOccupants: 4, basePrice: 2000, cpPrice: 2300 },
        SUITE: { maxAdults: 4, maxOccupants: 6, basePrice: 8000, cpPrice: 8500 },
      },
      rates: {
        '2030-01-10': {
          DELUXE: { single_ep: 2000, double_ep: 2500, single_cp: 2300, double_cp: 2900, extra_adult: 600 },
          SUITE: { single_ep: 8000, double_ep: 8000, single_cp: 8500, double_cp: 8500, extra_adult: 900 },
        },
        '2030-01-11': {
          DELUXE: { single_ep: 2200, double_ep: 2700, single_cp: 2500, double_cp: 3100, extra_adult: 600 },
        },
      },
      offers: [{ name: '10% off', type: 'percentage', value: 10, description: 'Ten percent off' }],
      addons: [{ name: 'Airport pickup', price: 500, type: 'per_room', description: '' },
               { name: 'Dinner', price: 300, type: 'per_person' }],
      tax_rate: 5, active_payment_gateway: 'razorpay', razorpay_key_id: 'rzp_test_abc', razorpay_key_secret: 'SECRET', qr_code: '',
    },
    { id: 2, name: 'Other', location: 'Puri', room_types: [], inventory: {}, photos: null },
  ],
  bookings: [],
};

function builder(table) {
  const q = { filters: [], op: 'select', payload: null, single: false, limitN: null };
  const run = () => {
    let rows = db[table];
    q.filters.forEach(([k, v]) => { rows = rows.filter((r) => String(r[k]) === String(v)); });
    if (q.op === 'insert') { const r = q.payload.map((p) => ({ ...p, created_at: '2030-01-01T00:00:00Z' })); db[table].push(...r); return { data: r, error: null }; }
    if (q.op === 'update') { rows.forEach((r) => Object.assign(r, q.payload)); return { data: rows, error: null }; }
    if (q.limitN) rows = rows.slice(0, q.limitN);
    if (q.single) return rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: 'none' } };
    return { data: rows, error: null };
  };
  const b = {
    select: () => b, eq: (k, v) => { q.filters.push([k, v]); return b; }, limit: (n) => { q.limitN = n; return b; },
    order: () => b, single: () => { q.single = true; return b; },
    insert: (p) => { q.op = 'insert'; q.payload = p; return b; }, update: (p) => { q.op = 'update'; q.payload = p; return b; },
    then: (res, rej) => Promise.resolve(run()).then(res, rej),
  };
  return b;
}
export function installFakeSupabase() { supabase.from = builder; }

