// End-to-end: the real React app talking to the real Express server (in-memory Supabase).
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import crypto from 'node:crypto';
import { BrowserRouter } from 'react-router-dom';
import { createApp } from '../../server/src/index.js';
import { db, installFakeSupabase } from '../../server/test/fakeSupabase.js';
import App from '../src/App';
import { ToastProvider } from '../src/context/ToastContext';
import { BookingProvider } from '../src/context/BookingContext';

let server;
const realFetch = globalThis.fetch;
const emails = [];
const orders = {};

beforeAll(async () => {
  installFakeSupabase();
  process.env.CACHE_TTL_MS = '0';
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, r); });
  const base = `http://127.0.0.1:${server.address().port}`;

  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u.startsWith('/api')) return realFetch(base + u, opts);
    if (u.includes('razorpay-order')) {
      orders.order_e2e = { amount: JSON.parse(opts.body).amount, paid: false };
      return new Response(JSON.stringify({ id: 'order_e2e' }), { status: 200 });
    }
    if (u.startsWith('https://api.razorpay.com/v1/orders/')) {
      const o = orders[u.split('/').pop()];
      return new Response(JSON.stringify({ status: o.paid ? 'paid' : 'created', amount: o.amount, amount_paid: o.paid ? o.amount : 0 }));
    }
    if (u.includes('emailjs')) { emails.push(JSON.parse(opts.body).template_id); return new Response('OK'); }
    return realFetch(url, opts);
  };

  // jsdom lacks these
  window.HTMLElement.prototype.scrollIntoView = () => {};
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  HTMLAnchorElement.prototype.click = vi.fn();
});
afterEach(() => cleanup());
afterAll(() => { server.close(); globalThis.fetch = realFetch; cleanup(); });

const mount = () => render(
  <BrowserRouter><ToastProvider><BookingProvider><App /></BookingProvider></ToastProvider></BrowserRouter>
);

describe('booking flow', () => {
  it('search -> rooms -> guest -> payment -> confirmation', async () => {
    window.history.pushState({}, '', '/?checkin=2030-01-10&checkout=2030-01-12');
    const user = userEvent.setup();
    let razorpayOptions = null;
    window.Razorpay = class {
      constructor(o) { razorpayOptions = o; }
      on() {}
      open() {
        // the guest "pays": Razorpay marks the order paid and returns a signed proof
        orders[razorpayOptions.order_id].paid = true;
        const sig = crypto.createHmac('sha256', 'SECRET').update(`${razorpayOptions.order_id}|pay_1`).digest('hex');
        setTimeout(() => razorpayOptions.handler({ razorpay_order_id: razorpayOptions.order_id, razorpay_payment_id: 'pay_1', razorpay_signature: sig }), 0);
      }
    };

    mount();

    // ---- Page 1: hotels (progress 20%) --------------------------------------------------
    expect(await screen.findByText('Kakkson Patia')).toBeTruthy();
    expect(screen.getByText('3 rooms available')).toBeTruthy();
    expect(screen.getByText('No rooms available')).toBeTruthy(); // hotel 2
    await waitFor(() => expect(document.getElementById('progress-fill').style.width).toBe('20%'));
    expect(document.getElementById('checkin').value).toBe('2030-01-10');

    // filters re-query the server
    await user.click(document.querySelector('input[name="location-filter"][value="Puri"]'));
    await waitFor(() => expect(screen.queryByText('Kakkson Patia')).toBeNull());
    await user.click(screen.getByText('Clear all'));
    expect(await screen.findByText('Kakkson Patia')).toBeTruthy();

    // ---- Page 2: rooms --------------------------------------------------------------------
    await user.click(screen.getAllByText('Book Now')[0]);
    expect(await screen.findByText('Select Your Room')).toBeTruthy();
    expect(await screen.findByText('DELUXE')).toBeTruthy();
    expect(document.getElementById('progress-fill').style.width).toBe('40%');
    expect(document.getElementById('room-rate-DELUXE').textContent).toContain('2100');
    expect(screen.getAllByText('Ten percent off').length).toBe(2); // one banner per room card

    // meal plan changes the price (server-side rate)
    const deluxe = document.querySelector('[data-room-type="DELUXE"]');
    await user.click(within(deluxe).getByText('Breakfast (CP)'));
    await waitFor(() => expect(document.getElementById('room-rate-DELUXE').textContent).toContain('2400'));
    await user.click(within(deluxe).getByText('Room Only (EP)'));

    // occupancy dialog: 2 adults
    await user.click(within(deluxe).getByText(/Step 1/));
    const adults = await waitFor(() => { const el = document.getElementById('room-0-adults'); if (!el) throw new Error('no modal'); return el; });
    await user.selectOptions(adults, '2');
    await user.click(within(document.getElementById('room-occupancy-modal')).getByText(/Apply Configuration/));
    await waitFor(() => expect(document.getElementById('room-rate-DELUXE').textContent).toContain('2600'));

    // book
    await user.click(within(deluxe).getByText(/Step 2/));

    // ---- Page 3: guest -------------------------------------------------------------------
    expect(await screen.findByRole('heading', { name: 'Guest Details' })).toBeTruthy();
    await waitFor(() => expect(document.getElementById('summary-total').textContent).toBe('₹4914'));
    expect(document.getElementById('summary-room').textContent).toBe('DELUXE • 1 Room');
    expect(document.getElementById('summary-guests').textContent).toBe('2 Guests');
    expect(document.getElementById('progress-fill').style.width).toBe('60%');

    // add-on (per-room 500) updates total
    await user.click(screen.getByText('Airport pickup'));
    await waitFor(() => expect(document.getElementById('summary-total').textContent).toBe('₹5439'));

    // validation toast
    await user.click(screen.getByText('Continue to Payment'));
    expect(await screen.findByText('Please fill in all guest details')).toBeTruthy();

    await user.type(document.getElementById('guest-name'), 'Asha Rao');
    await user.type(document.getElementById('guest-email'), 'asha@example.com');
    await user.type(document.getElementById('guest-phone'), '9876543210');
    await user.click(screen.getByText('Continue to Payment'));

    // ---- Page 4: payment -------------------------------------------------------------------
    expect(await screen.findByText('Payment Method')).toBeTruthy();
    expect(await screen.findByText('Online Payments Available')).toBeTruthy();
    await waitFor(() => expect(document.getElementById('payment-summary-total').textContent).toBe('₹5439'));
    expect(document.getElementById('payment-summary-room').textContent).toBe('DELUXE (1 room(s), Room Only)');

    // must choose a method first
    await user.click(screen.getByText(/Confirm Booking/));
    expect(await screen.findByText('Please select a payment method')).toBeTruthy();

    await user.click(screen.getByText('Credit/Debit Card'));
    await waitFor(() => expect(document.getElementById('convenience-fee-notice').style.display).toBe('block'));
    await waitFor(() => expect(Number(document.getElementById('payment-summary-total').textContent.replace('₹', ''))).toBeGreaterThan(5439));

    await user.click(screen.getByText(/Confirm Booking/));

    // ---- Page 5: confirmation ----------------------------------------------------------------
    expect(await screen.findByText('Booking Confirmed!')).toBeTruthy();
    expect(razorpayOptions.key).toBe('rzp_test_abc');
    expect(razorpayOptions.order_id).toBe('order_e2e');
    expect(document.getElementById('progress-fill').style.width).toBe('100%');
    const voucher = document.getElementById('voucher-content');
    expect(voucher.textContent).toContain('Asha Rao');
    expect(voucher.textContent).toContain('Single Room');
    await waitFor(() => expect(document.getElementById('email-status-text').textContent).toBe('Voucher sent to guest and hotel admin!'));
    expect(emails.length).toBe(2);

    // booking + inventory persisted by the server
    expect(db.bookings.length).toBe(1);
    expect(db.bookings[0].status).toBe('confirmed');
    expect(db.bookings[0].guest_name).toBe('Asha Rao');
    expect(db.bookings[0].addons_data[0].name).toBe('Airport pickup');
    expect(db.hotels[0].inventory['2030-01-10'].DELUXE).toBe(2); // 3 - 1 room

    // download voucher hits the server PDF endpoint
    await user.click(screen.getByText('Download Voucher'));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());

    // new booking returns to the search page
    await user.click(screen.getByText('New Booking'));
    expect(await screen.findByText(/List Of Hotels/)).toBeTruthy();
  });

  it('multi-room dialog adds rooms through the server rules', async () => {
    cleanup();
    window.history.pushState({}, '', '/?checkin=2030-01-10&checkout=2030-01-12');
    const user = userEvent.setup();
    mount();
    await screen.findByText('Kakkson Patia');
    await user.click(screen.getAllByText('Book Now')[0]);
    await screen.findByText('Select Your Room');
    await user.click(screen.getByText('Select Multiple Rooms Types'));
    const addBtn = await waitFor(() => { const el = document.getElementById('add-room-btn'); if (!el || el.disabled) throw new Error('not ready'); return el; });
    expect(document.getElementById('add-room-text').textContent).toMatch(/Add Another Room/);
    await user.click(addBtn);
    await waitFor(() => expect(document.querySelectorAll('#multi-room-config-body tr').length).toBe(3)); // header + 2 rooms
    await user.click(document.getElementById('apply-config-btn'));
    await user.click(screen.getAllByText(/Step 2/)[0]);
    expect(await screen.findByRole('heading', { name: 'Guest Details' })).toBeTruthy();
    await waitFor(() => expect(document.getElementById('summary-room').textContent).toMatch(/^2 Rooms • /));
  });
});
