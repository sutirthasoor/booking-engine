# Kakkson Booking – React + Node.js

The single `kakkson_booking.html` page has been split into

```
kakkson-booking/
├─ client/   React (Vite + Tailwind) – UI only, one component per page
└─ server/   Node.js (Express) – ALL business logic, DB access, payments, e-mail, PDF
```

## Run it

```bash
npm run install:all          # installs server + client (and `npm i` once in the root for `concurrently`)
cp server/.env.example server/.env   # (already provided with the values from the original page)
npm run dev                  # API on :5000, React on http://localhost:5173
```

Production: `npm run build && npm start` – Express serves the built React app and the API on one port.
Tests: `npm test` (server API tests + a full browser-flow test of the React app against the real server).

## Pages (client/src/pages)

| Route              | Page                  | Original section        |
|--------------------|-----------------------|-------------------------|
| `/` (`/kakkson_booking`) | `HotelsPage`    | `#hotels-section`       |
| `/rooms`           | `RoomsPage`           | `#rooms-section`        |
| `/guest-details`   | `GuestDetailsPage`    | `#guest-section`        |
| `/payment`         | `PaymentPage`         | `#payment-section`      |
| `/confirmation`    | `ConfirmationPage`    | `#confirmation-section` |

Shared: `Layout` (header / mini header, progress bar, filter sidebar, footer) and the dialogs
`OccupancyModal`, `MultiRoomModal`, `AmenitiesModal`, `UpgradeModal`, `BackToHotelsModal`.
`styles/legacy.css` is the original stylesheet, unchanged; Tailwind is now built instead of loaded from the CDN.
`?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD` in the URL still pre-fills and searches.

## Where the old JS went (server/src)

| Old browser code                                                    | Now                                   |
|---------------------------------------------------------------------|---------------------------------------|
| Supabase client, `loadHotelData`, room details                      | `services/hotelService.js`            |
| `getMaxAvailable`, `checkHotelAvailability`, multi-room limits      | `services/availabilityService.js`     |
| `calculateRoomRate`, extra adult rate, offers, tax slab, gateway fee| `services/pricingService.js`          |
| `updateGuestSummary…`, `updatePaymentSummary…` (totals, add-ons…)   | `services/quoteService.js` (one source of truth) |
| occupancy dialog rules, multi-room dialog rules, upgrade suggestions, Book Now validation | `services/roomService.js` |
| `createBookingRecord`, `updateHotelInventory`                       | `services/bookingService.js`          |
| Razorpay order edge-function call, gateway status                   | `services/paymentService.js`          |
| EmailJS (guest + hotel admin)                                       | `services/emailService.js`            |
| `generateVoucher` data, jsPDF voucher, text fallback                | `services/voucherService.js`          |
| validation, date helpers                                            | `utils/`                              |

The browser keeps only what must stay there: rendering, the controlled form fields, and opening the Razorpay checkout widget.
The browser **never** receives the Razorpay secret (the original page downloaded `razorpay_key_secret` into the browser).

### API
```
POST /api/hotels/search            POST /api/hotels/select           GET /api/hotels/:id/rooms
GET  /api/hotels/:id/payment-config
POST /api/rooms/rate               POST /api/rooms/select
POST /api/rooms/occupancy/{init,update,apply}
POST /api/rooms/multi/{init,update}   POST /api/rooms/upgrade
POST /api/booking/quote            POST /api/booking/guest/validate
POST /api/bookings/start           POST /api/bookings/confirm
POST /api/bookings/email           POST /api/bookings/voucher
```
`/bookings/start` returns a signed token (HMAC, `TOKEN_SECRET`) that `/confirm`, `/email` and `/voucher` require, so a
browser cannot change prices, rooms or e-mail recipients after the booking was created.

## Payment security
1. `/bookings/start` recalculates the price on the server (the browser sends no amount), creates the Razorpay order with that
   amount and saves the booking as **`pending`** (with the order id).
2. After paying, the browser sends Razorpay's `order_id / payment_id / signature` to `/bookings/confirm`. The server checks the
   HMAC signature with the hotel's secret **and** asks Razorpay whether that order is `paid` for at least the expected amount.
3. Only then is the booking set to `confirmed`, rooms deducted (once - replays are ignored) and the voucher issued.
4. Closing the Razorpay window confirms nothing. Voucher/e-mail endpoints need the receipt token issued in step 3.

**Do these in Supabase as well** (the old page shipped the anon key, so treat it as public):
- Enable Row Level Security on `hotels` and `bookings`: no anon `insert/update/select` on `bookings`, no anon `update` on `hotels`,
  and the anon role must not be able to read `razorpay_key_secret`. Put the service-role key in `server/.env`
  (`SUPABASE_SERVICE_ROLE_KEY`) and keep it server-only.
- Rotate the Razorpay key secret (the old page exposed it in the browser).
- Make the edge functions (`razorpay-order`, `verify-payment`, `send-voucher-email`) reject calls that don't come from your server.
- Take the old `kakkson_booking.html` offline.
- Recommended: add a Razorpay webhook (`payment.captured`) so a guest who pays but closes the tab is still confirmed.
- Bookings are now `pending` until paid; check that your extranet treats `pending` / `processing` /
  `payment_received_needs_review` sensibly.

## Configuration
See `server/.env.example`. Set a real `TOKEN_SECRET` in production.
**EmailJS:** server-side sending only works if *Account → Security → "Allow EmailJS API for non-browser applications"* is
enabled (add `EMAILJS_PRIVATE_KEY` as well if you use it).
