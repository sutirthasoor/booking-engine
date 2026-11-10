import { Router } from 'express';
import { asyncHandler, assertValidDates, ok, refuse } from '../utils/http.js';
import { ApiError, toast } from '../utils/errors.js';
import { validateEmail, validatePhone } from '../utils/validation.js';
import { signPayload, verifyPayload } from '../utils/signedToken.js';
import { getFullHotel, listHotels } from '../services/hotelService.js';
import { validateSelection } from '../services/roomService.js';
import { buildQuote } from '../services/quoteService.js';
import {
  claimPendingBooking, createBookingRecord, generateBookingNumber, getBooking, setBookingStatus, updateHotelInventory,
} from '../services/bookingService.js';
import { createRazorpayOrder, getPaymentConfig, verifyRazorpayPayment } from '../services/paymentService.js';
import { sendVoucherEmails } from '../services/emailService.js';
import { buildVoucherDownload, buildVoucherView } from '../services/voucherService.js';

const router = Router();

const cleanAddons = (a) => (Array.isArray(a) ? a.map(Number).filter((n) => Number.isInteger(n) && n >= 0) : []);

function validateGuest(guest = {}) {
  const name = String(guest.name || '').trim();
  const email = String(guest.email || '').trim();
  const phone = String(guest.phone || '').trim();
  const specialRequests = String(guest.specialRequests || '').trim();

  if (!name || !email || !phone) return { error: 'Please fill in all guest details' };
  if (!validateEmail(email)) return { error: 'Please enter a valid email address' };
  if (!validatePhone(phone)) return { error: 'Please enter a valid phone number' };
  return { guest: { name, email, phone, specialRequests } };
}

const pricingOf = (quote) => ({
  roomCharges: quote.charges.roomCharges,
  addonsCharges: quote.charges.addonsCharges,
  offerDiscount: quote.charges.offerDiscount,
  taxAmount: quote.charges.taxAmount,
  taxRate: quote.taxRate,
  convenienceFee: quote.charges.convenienceFee,
  totalAmount: quote.charges.totalAmount,
  selectedRate: quote.selection.rate,
});

// Price breakdown for the guest-details and payment pages
router.post('/quote', asyncHandler(async (req, res) => {
  const { selection = {}, addons, paymentMethod = '' } = req.body || {};
  assertValidDates(selection.checkin, selection.checkout);
  const hotel = await getFullHotel(selection.hotelId);
  ok(res, { quote: buildQuote(hotel, selection, { addons: cleanAddons(addons), paymentMethod }) });
}));

// Guest form validation ("Continue to Payment")
router.post('/guest/validate', asyncHandler(async (req, res) => {
  const result = validateGuest(req.body?.guest);
  if (result.error) return refuse(res, [toast('error', result.error)]);
  ok(res, { guest: result.guest });
}));

// Create booking record + Razorpay order
router.post('/start', asyncHandler(async (req, res) => {
  // feeMethod = the option the guest explicitly clicked. As in the original page the gateway
  // convenience fee is only charged once an option was clicked (the auto-selected default has no fee).
  const { selection = {}, addons, guest: rawGuest, paymentMethod, feeMethod = '' } = req.body || {};

  if (!paymentMethod) return refuse(res, [toast('error', 'Please select a payment method')]);
  if (paymentMethod === 'upi') {
    return refuse(res, [toast('error', 'UPI QR payments are coming soon. Please select another payment method.')]);
  }
  if (!String(paymentMethod).startsWith('razorpay')) {
    return refuse(res, [toast('error', 'Please select a payment method')]);
  }

  const checked = validateGuest(rawGuest);
  if (checked.error) return refuse(res, [toast('error', checked.error)]);

  assertValidDates(selection.checkin, selection.checkout);
  const hotel = await getFullHotel(selection.hotelId, { fresh: true });

  const paymentConfig = getPaymentConfig(hotel);
  if (!paymentConfig.razorpayEnabled) {
    return refuse(res, [toast('error', 'Online payments are temporarily unavailable for this hotel.')]);
  }

  const validation = validateSelection(hotel, selection);
  if (!validation.ok) return refuse(res, validation.toasts, { refresh: !!validation.refresh });

  const addonIdx = cleanAddons(addons);
  const quote = buildQuote(hotel, validation.selection, { addons: addonIdx, paymentMethod: feeMethod });

  // order first (its id is stored on the booking), then the booking row as 'pending'
  const bookingNumber = generateBookingNumber();
  const order = await createRazorpayOrder({
    hotelName: hotel.name,
    amountRupees: quote.charges.totalAmount,
    receipt: bookingNumber,
    guestName: checked.guest.name,
  });
  const booking = await createBookingRecord({
    hotel, quote, guest: checked.guest, paymentMethod, addons: addonIdx, bookingNumber, orderId: order.id,
  });

  const startToken = signPayload({
    kind: 'start',
    hotelId: hotel.id,
    razorpayOrderId: order.id,
    selection: quote.selection,
    booking,
    pricing: pricingOf(quote),
  });

  ok(res, {
    startToken,
    razorpay: {
      key: hotel.razorpay_key_id,
      amount: Math.round(quote.charges.totalAmount * 100),
      currency: 'INR',
      order_id: order.id,
      name: hotel.name,
      description: `Booking ${booking.booking_number}`,
      image: hotel.logo || 'https://via.placeholder.com/100x100?text=Hotel',
      prefill: { name: checked.guest.name, email: checked.guest.email, contact: checked.guest.phone },
      notes: { booking_id: booking.booking_number, hotel: hotel.name },
      theme: { color: '#F37254' },
    },
  });
}));

// Payment finished -> VERIFY the payment, then confirm booking, deduct rooms and issue the voucher data
router.post('/confirm', asyncHandler(async (req, res) => {
  const { startToken, payment = {} } = req.body || {};
  const start = verifyPayload(startToken);
  if (start.kind !== 'start') throw new ApiError(400, 'Invalid booking token');

  const bookingNumber = start.booking.booking_number;
  if (payment.razorpay_order_id !== start.razorpayOrderId) {
    throw new ApiError(400, 'Payment verification failed');
  }

  const hotel = await getFullHotel(start.hotelId, { fresh: true });
  await verifyRazorpayPayment({
    hotel,
    orderId: payment.razorpay_order_id,
    paymentId: payment.razorpay_payment_id,
    signature: payment.razorpay_signature,
    expectedAmountPaise: Math.round(start.pricing.totalAmount * 100),
  });

  const issue = (extraToasts = []) => {
    const receipt = { booking: { ...start.booking, status: 'confirmed' }, pricing: start.pricing };
    const receiptToken = signPayload({ kind: 'receipt', hotelId: start.hotelId, receipt });
    return { receiptToken, receipt, voucher: buildVoucherView(receipt), toasts: extraToasts };
  };

  // replaying the same confirmation never deducts rooms twice
  const existing = await getBooking(bookingNumber);
  if (existing?.status === 'confirmed') return ok(res, issue());

  const claimed = await claimPendingBooking(bookingNumber);
  if (!claimed) throw new ApiError(409, 'This booking is already being processed');

  const inv = await updateHotelInventory({ hotelId: start.hotelId, selection: start.selection, bookingNumber });
  if (!inv.success) {
    await setBookingStatus(bookingNumber, 'payment_received_needs_review');
    return res.status(409).json({
      ok: false,
      error: `Your payment was received but the rooms could not be finalised. Please contact the hotel with booking number ${bookingNumber}.`,
      toasts: inv.toasts,
    });
  }

  ok(res, issue(inv.toasts));
}));

// Voucher e-mail (guest + hotel admin)
router.post('/email', asyncHandler(async (req, res) => {
  const token = verifyPayload(req.body?.receiptToken);
  if (token.kind !== 'receipt') throw new ApiError(400, 'Invalid token');

  const { booking } = token.receipt;
  const hotel = (await listHotels()).find((h) => h.name === booking.hotel);

  try {
    const { adminSent } = await sendVoucherEmails({ booking, hotel });
    ok(res, {
      message: adminSent ? 'Voucher sent to guest and hotel admin!' : 'Voucher sent to guest!',
      toasts: [toast('success', 'Booking confirmed! Voucher emailed successfully.')],
    });
  } catch (error) {
    console.error('Email sending failed:', error.message);
    res.status(502).json({ ok: false, error: `Email failed: ${error.emailText || error.message || 'Unknown error'}` });
  }
}));

// PDF (or text fallback) voucher download
router.post('/voucher', asyncHandler(async (req, res) => {
  const token = verifyPayload(req.body?.receiptToken);
  if (token.kind !== 'receipt') throw new ApiError(400, 'Invalid token');
  const file = buildVoucherDownload(token.receipt);
  ok(res, {
    file,
    toasts: [
      file.kind === 'pdf'
        ? toast('success', 'PDF voucher downloaded successfully!')
        : toast('warning', 'PDF download failed. Text voucher downloaded instead.'),
    ],
  });
}));

export default router;
