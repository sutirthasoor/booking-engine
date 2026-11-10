import crypto from 'node:crypto';
import { config } from '../config.js';
import { ApiError } from '../utils/errors.js';

/** What the payment page should say about the hotel's payment gateway (never exposes secrets). */
export function getPaymentConfig(hotel) {
  const hasValidRazorpay = !!(hotel.razorpay_key_id && String(hotel.razorpay_key_id).startsWith('rzp_'));
  const isRazorpayActive = hotel.active_payment_gateway === 'razorpay';

  let status;
  if (isRazorpayActive && hasValidRazorpay) status = 'available';
  else if (isRazorpayActive && !hasValidRazorpay) status = 'issue';
  else status = 'soon';

  return {
    status,
    hotelName: hotel.name,
    razorpayEnabled: status === 'available',
    qrCode: hotel.qr_code || '',
    // the first online option is pre-selected when online payment is available
    defaultMethod: status === 'available' ? 'razorpay_card' : '',
  };
}

/** Create a Razorpay order through the existing Supabase edge function (server -> server). */
export async function createRazorpayOrder({ hotelName, amountRupees, receipt, guestName }) {
  const orderData = {
    hotel_name: hotelName,
    amount: Math.round(amountRupees * 100),
    currency: 'INR',
    receipt,
    notes: { booking_id: receipt, hotel: hotelName, guest_name: guestName },
  };

  const response = await fetch(config.functions.razorpayOrder, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.supabase.anonKey}`,
    },
    body: JSON.stringify(orderData),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new ApiError(502, `Order creation failed: ${error}`);
  }
  const order = await response.json();
  if (!order.id) throw new ApiError(502, 'Payment order creation failed');
  return order;
}

/**
 * Proves that the guest really paid for THIS booking's order:
 *  1. the HMAC signature Razorpay returned matches order_id|payment_id (signed with the hotel's secret)
 *  2. Razorpay itself says the order is paid and the paid amount covers what the server calculated
 * Anything else is rejected, so calling the confirm endpoint without paying never works.
 */
export async function verifyRazorpayPayment({ hotel, orderId, paymentId, signature, expectedAmountPaise }) {
  if (!orderId || !paymentId || !signature) throw new ApiError(400, 'Payment details are missing');
  const keyId = hotel.razorpay_key_id;
  const secret = hotel.razorpay_key_secret;
  if (!keyId || !secret) throw new ApiError(500, 'Payment gateway is not configured for this hotel');

  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(String(signature));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new ApiError(400, 'Payment verification failed');
  }

  const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}` },
  });
  if (!response.ok) throw new ApiError(502, 'Could not confirm the payment with Razorpay. Please contact the hotel.');
  const order = await response.json();

  if (order.status !== 'paid' || Number(order.amount_paid) < expectedAmountPaise || Number(order.amount) < expectedAmountPaise) {
    throw new ApiError(400, 'Payment amount does not match the booking');
  }
  return true;
}

/** Optional: verify a payment signature through the existing edge function. */
export async function verifyPayment(payload) {
  const response = await fetch(config.functions.verifyPayment, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.supabase.anonKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new ApiError(502, `Payment verification failed: ${await response.text()}`);
  return response.json();
}
