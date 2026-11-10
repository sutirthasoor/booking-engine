import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createApp } from '../src/index.js';
import { calculateRoomRate, calculateConvenienceFee } from '../src/services/pricingService.js';
import { getDatesBetween } from '../src/utils/dates.js';

import { db, installFakeSupabase } from './fakeSupabase.js';
installFakeSupabase();

let server; let base;
test.before(async () => {
  process.env.CACHE_TTL_MS = '0';
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
  globalThis.__origFetch = globalThis.fetch;
  globalThis.__orders = {};
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('razorpay-order')) {
      const body = JSON.parse(opts.body);
      const id = `order_${Object.keys(globalThis.__orders).length + 1}`;
      globalThis.__orders[id] = { amount: body.amount, paid: false };
      return new Response(JSON.stringify({ id }), { status: 200 });
    }
    if (u.startsWith('https://api.razorpay.com/v1/orders/')) {
      const o = globalThis.__orders[u.split('/').pop()];
      if (!o) return new Response('{}', { status: 400 });
      return new Response(JSON.stringify({ status: o.paid ? 'paid' : 'created', amount: o.amount, amount_paid: o.paid ? o.amount : 0 }), { status: 200 });
    }
    if (u.includes('emailjs')) { globalThis.__emails = (globalThis.__emails || 0) + 1; globalThis.__lastEmail = JSON.parse(opts.body).template_params; return new Response('OK', { status: 200 }); }
    return globalThis.__origFetch(url, opts);
  };
});
test.after(() => { server.close(); globalThis.fetch = globalThis.__origFetch; });

const call = async (method, path, body) => {
  const res = await globalThis.__origFetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json() };
};
const ci = '2030-01-10'; const co = '2030-01-12';

// ---------------------------------------------------------------- unit
test('dates + rate maths', () => {
  assert.deepEqual(getDatesBetween(ci, co), ['2030-01-10', '2030-01-11']);
  const h = db.hotels[0];
  assert.equal(calculateRoomRate(h, 'DELUXE', ci, co, 'ep', 1, 0, 0), 2100); // avg(2000,2200)
  assert.equal(calculateRoomRate(h, 'DELUXE', ci, co, 'ep', 2, 0, 0), 2600);
  assert.equal(calculateRoomRate(h, 'DELUXE', ci, co, 'ep', 3, 0, 0), 3200); // double + 1 extra
  assert.equal(calculateRoomRate(h, 'DELUXE', ci, co, 'cp', 1, 0, 0), 2400);
  const f = calculateConvenienceFee(1000);
  assert.equal(Math.round(f.totalConvenienceFee * 100) / 100, 23.6);
});

// ---------------------------------------------------------------- API
test('search: validation, availability, filters', async () => {
  let r = await call('POST', '/hotels/search', { checkin: ci, checkout: ci });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, 'Check-out date must be after check-in date');

  r = await call('POST', '/hotels/search', { checkin: ci, checkout: co });
  assert.equal(r.json.hotels.length, 2);
  assert.equal(r.json.hotels[0].hasAvailableRooms, true);
  assert.equal(r.json.hotels[0].availableRooms, 3); // DELUXE min 2 + SUITE min 1
  assert.equal(r.json.hotels[0].photos.length, 3);
  assert.equal(r.json.hotels[1].hasAvailableRooms, false);
  assert.ok(!JSON.stringify(r.json).includes('SECRET'));

  r = await call('POST', '/hotels/search', { checkin: ci, checkout: co, sidebarLocation: 'Puri' });
  assert.equal(r.json.hotels.length, 1);
  r = await call('POST', '/hotels/search', { checkin: ci, checkout: co, price: '2000-5000' });
  assert.equal(r.json.hotels.length, 0); // list has no rates -> 1500 fallback, as in the original
});

test('select hotel + rooms view never leaks secrets', async () => {
  let r = await call('POST', '/hotels/select', { hotelId: 2, checkin: ci, checkout: co });
  assert.equal(r.json.ok, false);
  r = await call('GET', `/hotels/1/rooms?checkin=${ci}&checkout=${co}`);
  assert.equal(r.json.rooms.length, 2);
  assert.equal(r.json.rooms[0].singleEpRate, 2100);
  assert.equal(r.json.offerBanner, 'Ten percent off');
  assert.ok(!JSON.stringify(r.json).includes('SECRET'));
  r = await call('GET', '/hotels/1/payment-config');
  assert.equal(r.json.paymentConfig.status, 'available');
  assert.ok(!JSON.stringify(r.json).includes('SECRET'));
});

test('occupancy dialog rules', async () => {
  let r = await call('POST', '/rooms/occupancy/init', { hotelId: 1, roomType: 'DELUXE', numRooms: 2 });
  assert.equal(r.json.rooms.length, 2);
  assert.deepEqual(r.json.view.rooms[0].adultsOptions, [1, 2, 3]);
  r = await call('POST', '/rooms/occupancy/update', { hotelId: 1, roomType: 'DELUXE', rooms: r.json.rooms, index: 0, field: 'adults', value: 3 });
  assert.equal(r.json.rooms[0].adults, 3);
  assert.deepEqual(r.json.view.rooms[0].childrenAbove6Options, [0]);
  r = await call('POST', '/rooms/occupancy/apply', { roomType: 'DELUXE', rooms: r.json.rooms, mealPlan: 'cp' });
  assert.equal(r.json.mode, 'multi');
  assert.equal(r.json.multiRoomConfig[0].mealPlan, 'cp');
});

test('multi-room dialog: init, add until limit, remove, type auto-switch', async () => {
  let r = await call('POST', '/rooms/multi/init', { hotelId: 1, checkin: ci, checkout: co, config: [], numRooms: 1 });
  assert.equal(r.json.config.length, 1);
  assert.equal(r.json.view.maxAvailable, 3);
  let config = r.json.config;
  for (let i = 0; i < 2; i += 1) {
    r = await call('POST', '/rooms/multi/update', { hotelId: 1, checkin: ci, checkout: co, config, action: { type: 'addRoom' } });
    config = r.json.config;
  }
  assert.equal(config.length, 3);
  assert.equal(config.filter((c) => c.roomType === 'SUITE').length, 1); // only 1 suite
  r = await call('POST', '/rooms/multi/update', { hotelId: 1, checkin: ci, checkout: co, config, action: { type: 'addRoom' } });
  assert.match(r.json.toasts[0].message, /Maximum 3 rooms available/);
  r = await call('POST', '/rooms/multi/update', { hotelId: 1, checkin: ci, checkout: co, config, action: { type: 'removeRoom', index: 2 } });
  assert.equal(r.json.config.length, 2);
});

test('book now validation', async () => {
  const base = { hotelId: 1, checkin: ci, checkout: co, roomType: 'DELUXE', numRooms: 1, mealPlan: 'ep', occupancy: { adults: 5, childrenAbove6: 0, childrenBelow6: 0 } };
  let r = await call('POST', '/rooms/select', { selection: base });
  assert.equal(r.json.ok, false);
  assert.match(r.json.toasts[0].message, /Maximum 4 adults|Maximum 3 adults/);
  r = await call('POST', '/rooms/select', { selection: { ...base, occupancy: { adults: 2, childrenAbove6: 0, childrenBelow6: 0 }, numRooms: 3 } });
  assert.match(r.json.toasts[0].message, /only 2 DELUXE rooms available/);
  assert.equal(r.json.refresh, true);
  r = await call('POST', '/rooms/select', { selection: { ...base, occupancy: { adults: 2, childrenAbove6: 0, childrenBelow6: 0 }, numRooms: 2, mealPlan: 'cp' } });
  assert.equal(r.json.ok, true);
  assert.equal(r.json.selection.totals.adults, 4);
  assert.equal(r.json.selection.rate, 3000); // cp double avg(2900,3100)
  assert.equal(r.json.toasts[0].message, 'Room selection confirmed! (Breakfast Included)');
});

test('quote: single room, add-ons, offer, tax, gateway fee', async () => {
  const selection = { hotelId: 1, checkin: ci, checkout: co, roomType: 'DELUXE', numRooms: 2, mealPlan: 'ep', occupancy: { adults: 2, childrenAbove6: 0, childrenBelow6: 0 } };
  let r = await call('POST', '/booking/quote', { selection, addons: [0, 1] });
  const c = r.json.quote.charges;
  assert.equal(c.roomCharges, 2600 * 2 * 2); // rate * nights * rooms
  assert.equal(c.addonsCharges, 500 + 300 * 4); // per_room x1, per_person x 4 guests
  assert.equal(c.offerDiscount, 1040);
  assert.equal(c.taxAmount, Math.round((10400 + 1700 - 1040) * 0.05));
  assert.equal(c.convenienceFee, 0);
  assert.equal(c.totalAmount, 10400 + 1700 - 1040 + c.taxAmount);
  r = await call('POST', '/booking/quote', { selection, addons: [], paymentMethod: 'razorpay_card' });
  assert.ok(r.json.quote.charges.convenienceFee > 0);
  assert.equal(r.json.quote.summary.paymentRoomText, 'DELUXE (2 room(s), Room Only)');
});

test('quote: multi-room with mixed meal plans and 18% tax slab', async () => {
  const selection = { hotelId: 1, checkin: ci, checkout: co, multiRoomConfig: [
    { roomType: 'SUITE', adults: 2, childrenAbove6: 0, childrenBelow6: 0, mealPlan: 'cp' },
    { roomType: 'DELUXE', adults: 1, childrenAbove6: 0, childrenBelow6: 0, mealPlan: 'ep' } ] };
  const { json } = await call('POST', '/booking/quote', { selection });
  const q = json.quote;
  assert.equal(q.selection.numRooms, 2);
  // SUITE has no rate on the 2nd night -> original fallback: cpPrice*1.5 = 12750 -> avg(8500,12750)=10625
  assert.equal(q.charges.roomCharges, (10625 * 2) + (2100 * 2));
  assert.equal(q.taxRate, 0.05); // avg nightly rate (10625+2100)/2 = 6362 < 7500
  const hi = await call('POST', '/booking/quote', { selection: { hotelId: 1, checkin: ci, checkout: co, roomType: 'SUITE', numRooms: 1, mealPlan: 'cp', occupancy: { adults: 2, childrenAbove6: 0, childrenBelow6: 0 } } });
  assert.equal(hi.json.quote.taxRate, 0.18); // 10625/night >= 7500
});

const sign = (orderId, paymentId, secret = 'SECRET') =>
  crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
const payFor = (orderId, paymentId = 'pay_1') => ({
  razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sign(orderId, paymentId),
});

const guest = { name: 'Asha', email: 'asha@example.com', phone: '9876543210', specialRequests: 'High floor' };
const sel = () => ({ hotelId: 1, checkin: ci, checkout: co, roomType: 'DELUXE', numRooms: 2, mealPlan: 'ep', occupancy: { adults: 2, childrenAbove6: 0, childrenBelow6: 0 } });
const start = (extra = {}) => call('POST', '/bookings/start', { selection: sel(), guest, addons: [], paymentMethod: 'razorpay_card', ...extra });

test('start: validation, pending booking, server-side amount, no secrets', async () => {
  let r = await start({ guest: { ...guest, phone: '123' } });
  assert.equal(r.json.ok, false);
  r = await start({ paymentMethod: 'upi' });
  assert.match(r.json.toasts[0].message, /coming soon/);

  const before = db.bookings.length;
  r = await start();
  assert.equal(r.json.ok, true);
  assert.equal(r.json.razorpay.key, 'rzp_test_abc');
  assert.ok(!JSON.stringify(r.json).includes('SECRET'));
  assert.equal(db.bookings.length, before + 1);
  const b = db.bookings.at(-1);
  assert.equal(b.status, 'pending'); // NOT confirmed until payment is verified
  assert.equal(b.razorpay_order_id, r.json.razorpay.order_id);
  assert.equal(b.num_adults, 4);
  assert.ok(b.convenience_fee > 0);
  // the amount sent to Razorpay is the server's total, whatever the browser says
  assert.equal(globalThis.__orders[r.json.razorpay.order_id].amount, Math.round(b.total_amount * 100));
});

test('price tampering is impossible: client-sent amounts are ignored', async () => {
  const r = await start({ amount: 1, total_amount: 1, booking_amount: 1, totalAmount: 1, selection: { ...sel(), rate: 1, totals: { adults: 1 }, price: 1 } });
  assert.equal(r.json.ok, true);
  const b = db.bookings.at(-1);
  assert.ok(b.total_amount > 5000, `total was ${b.total_amount}`);
  assert.equal(globalThis.__orders[r.json.razorpay.order_id].amount, Math.round(b.total_amount * 100));
});

test('ATTACK: confirming without paying is rejected, nothing is booked', async () => {
  const s = await start();
  const invBefore = JSON.stringify(db.hotels[0].inventory);

  // 1. no payment proof at all
  let r = await call('POST', '/bookings/confirm', { startToken: s.json.startToken });
  assert.equal(r.json.ok, false);
  // 2. forged signature
  r = await call('POST', '/bookings/confirm', { startToken: s.json.startToken, payment: { ...payFor(s.json.razorpay.order_id), razorpay_signature: 'f'.repeat(64) } });
  assert.equal(r.status, 400);
  // 3. correct signature but the order was never paid
  r = await call('POST', '/bookings/confirm', { startToken: s.json.startToken, payment: payFor(s.json.razorpay.order_id) });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /amount does not match/);
  // 4. signature made with a guessed/other secret
  r = await call('POST', '/bookings/confirm', { startToken: s.json.startToken, payment: { ...payFor(s.json.razorpay.order_id), razorpay_signature: sign(s.json.razorpay.order_id, 'pay_1', 'wrong') } });
  assert.equal(r.status, 400);

  assert.equal(JSON.stringify(db.hotels[0].inventory), invBefore); // no room deducted
  assert.equal(db.bookings.find((b) => b.razorpay_order_id === s.json.razorpay.order_id).status, 'pending');
  // e-mail / voucher cannot be obtained without a receipt token
  r = await call('POST', '/bookings/voucher', { receiptToken: s.json.startToken });
  assert.equal(r.status, 400);
  r = await call('POST', '/bookings/email', { receiptToken: s.json.startToken });
  assert.equal(r.status, 400);
});

test('ATTACK: paying a cheap order and presenting it for a bigger booking fails', async () => {
  const big = await start();
  const cheap = await start({ selection: { ...sel(), numRooms: 1 } });
  globalThis.__orders[cheap.json.razorpay.order_id].paid = true; // attacker really pays the small one
  // swap in the cheap order's proof
  let r = await call('POST', '/bookings/confirm', { startToken: big.json.startToken, payment: payFor(cheap.json.razorpay.order_id) });
  assert.equal(r.status, 400);
  // the order Razorpay holds for the big booking is only partially paid
  const o = globalThis.__orders[big.json.razorpay.order_id];
  o.paid = true; o.amount = 100; // pretend a ₹1 order slipped in through the public edge function
  r = await call('POST', '/bookings/confirm', { startToken: big.json.startToken, payment: payFor(big.json.razorpay.order_id) });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /amount does not match/);
});

test('paid booking: confirm once, replay does not double-deduct, email + PDF work', async () => {
  const s = await start();
  globalThis.__orders[s.json.razorpay.order_id].paid = true;
  const invDeluxe = () => db.hotels[0].inventory['2030-01-10'].DELUXE;
  const before = invDeluxe();

  const conf = await call('POST', '/bookings/confirm', { startToken: s.json.startToken, payment: payFor(s.json.razorpay.order_id) });
  assert.equal(conf.json.ok, true);
  assert.equal(invDeluxe(), before - 2);
  assert.equal(db.bookings.find((b) => b.razorpay_order_id === s.json.razorpay.order_id).status, 'confirmed');
  assert.equal(conf.json.voucher.totalGuests, 4);

  const again = await call('POST', '/bookings/confirm', { startToken: s.json.startToken, payment: payFor(s.json.razorpay.order_id) });
  assert.equal(again.json.ok, true);
  assert.equal(invDeluxe(), before - 2); // unchanged

  // a tampered startToken is rejected
  const bad = await call('POST', '/bookings/confirm', { startToken: s.json.startToken.slice(0, -3) + 'abc', payment: payFor(s.json.razorpay.order_id) });
  assert.equal(bad.status, 400);

  const emailsBefore = globalThis.__emails || 0;
  const mail = await call('POST', '/bookings/email', { receiptToken: conf.json.receiptToken });
  assert.equal(mail.json.message, 'Voucher sent to guest and hotel admin!');
  assert.equal((globalThis.__emails || 0) - emailsBefore, 2);
  const p = globalThis.__lastEmail;
  assert.equal(p.room_type, 'DELUXE');
  assert.equal(p.room_summary, 'DELUXE × 2');
  assert.match(p.room_details, /Room 1: DELUXE - 2 adults - Room Only \(EP\)\nRoom 2: DELUXE - 2 adults/);
  assert.match(p.rooms_html, /<table/);
  assert.equal(p.guest_summary, '4 adults');

  const v = await call('POST', '/bookings/voucher', { receiptToken: conf.json.receiptToken });
  assert.equal(v.json.file.kind, 'pdf');
  assert.equal(Buffer.from(v.json.file.data, 'base64').slice(0, 5).toString(), '%PDF-');
});

test('add-ons stored as an object / JSON string are normalised to an array', async () => {
  const h = db.hotels[0];
  const original = h.addons;
  h.inventory = { '2030-01-10': { DELUXE: 3, SUITE: 1 }, '2030-01-11': { DELUXE: 2, SUITE: 1 } };
  const selection = { hotelId: 1, checkin: ci, checkout: co, roomType: 'DELUXE', numRooms: 1, mealPlan: 'ep', occupancy: { adults: 1, childrenAbove6: 0, childrenBelow6: 0 } };
  for (const shape of [{ a: original[0], b: original[1] }, JSON.stringify(original), null]) {
    h.addons = shape;
    const r = await call('POST', '/rooms/select', { selection });
    assert.equal(r.json.ok, true);
    assert.ok(Array.isArray(r.json.addons), `addons not an array for ${typeof shape}`);
    assert.equal(r.json.addons.length, shape ? 2 : 0);
  }
  h.addons = original;
});

test('the gateway fee cannot be skipped by the browser', async () => {
  const r = await start({ feeMethod: '' });
  assert.equal(r.json.ok, true);
  assert.ok(db.bookings.at(-1).convenience_fee > 0);
});

test('gateway fee cannot be skipped by omitting or faking fields', async () => {
  const total = async (extra) => {
    const r = await start(extra);
    return globalThis.__orders[r.json.razorpay.order_id].amount;
  };
  const normal = await total({});
  assert.equal(await total({ feeMethod: '' }), normal);
  assert.equal(await total({ feeMethod: 'none', fee: 0, convenience_fee: 0 }), normal);
  assert.ok(normal > (await call('POST', '/booking/quote', { selection: sel(), addons: [] })).json.quote.charges.totalAmount * 100);
});

test('email room details for a multi-room, multi-type booking with children', async () => {
  const { buildEmailRoomDetails } = await import('../src/services/voucherService.js');
  const d = buildEmailRoomDetails({
    num_rooms: 3, num_adults: 5, num_children_above_6: 1, num_children_below_6: 1,
    room_configuration: [
      { roomType: 'DELUXE', adults: 2, childrenAbove6: 1, childrenBelow6: 0, mealPlan: 'cp' },
      { roomType: 'DELUXE', adults: 1, childrenAbove6: 0, childrenBelow6: 1, mealPlan: 'ep' },
      { roomType: 'SUITE', adults: 2, childrenAbove6: 0, childrenBelow6: 0, mealPlan: 'ep' },
    ],
  });
  assert.equal(d.room_summary, 'DELUXE × 2, SUITE × 1');
  assert.match(d.room_details, /Room 1: DELUXE - 2 adults, 1 child \(6\+ yrs\) - Breakfast Included \(CP\)/);
  assert.match(d.room_details, /Room 2: DELUXE - 1 adult, 1 child \(under 6\) - Room Only \(EP\)/);
  assert.match(d.room_details, /Room 3: SUITE - 2 adults/);
  assert.equal(d.guest_summary, '5 adults, 1 child (6+ yrs), 1 child (under 6)');
  assert.equal(d.total_children, 2);
});
