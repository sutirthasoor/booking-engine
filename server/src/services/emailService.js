import { config } from '../config.js';
import { formatDateForDisplay } from '../utils/dates.js';
import { ApiError } from '../utils/errors.js';
import { buildEmailRoomDetails } from './voucherService.js';

async function emailjsSend(templateId, templateParams) {
  const { apiUrl, serviceId, publicKey, privateKey } = config.emailjs;
  const body = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: templateParams,
  };
  if (privateKey) body.accessToken = privateKey;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    const err = new ApiError(502, text || 'Unknown error');
    err.emailText = text;
    throw err;
  }
  return { status: response.status, text };
}

const rType = (r) => r.room_type || r.roomType;
const rPlan = (r) => r.meal_plan || r.mealPlan;

/**
 * Send the confirmation e-mail to the guest and (if the hotel has an admin e-mail) to the hotel.
 * `hotel` is the list-level hotel record ({ admin_email, logo, ... }).
 */
export async function sendVoucherEmails({ booking, hotel }) {
  const hotelAdminEmail = hotel?.admin_email || '';
  const hotelLogo = hotel?.logo || 'https://i.ibb.co/rKH8BQr9/images-3.png';
  const hotelAddress = hotel?.address || 'Hotel Address Not Specified';
  const hotelPhone = hotel?.contact_phone || 'N/A';

  // num_* columns already contain the totals for all rooms
  const totalAdults = booking.num_adults || 0;
  const totalChildrenAbove6 = booking.num_children_above_6 || 0;
  const totalChildrenBelow6 = booking.num_children_below_6 || 0;
  const totalGuests = totalAdults + totalChildrenAbove6 + totalChildrenBelow6;

  let roomTypesDisplay;
  let mealPlanDisplay;
  if (Array.isArray(booking.room_configuration) && booking.room_configuration.length > 1) {
    const types = new Set();
    const plans = new Set();
    booking.room_configuration.forEach((room) => {
      if (rType(room)) types.add(rType(room));
      if (rPlan(room)) plans.add(rPlan(room));
    });
    roomTypesDisplay = Array.from(types).join(', ');
    mealPlanDisplay = Array.from(plans).map((mp) => (mp === 'cp' ? 'Breakfast Included' : 'Room Only')).join(', ');
  } else {
    roomTypesDisplay = booking.room_type || 'Standard Room';
    mealPlanDisplay = booking.meal_plan === 'cp' ? 'Breakfast Included' : 'Room Only';
  }

  const guestEmailData = {
    email: booking.guest_email,
    to_email: booking.guest_email,
    reply_to: booking.guest_email,

    guest_name: booking.guest_name,
    guest_email: booking.guest_email,
    guest_phone: booking.guest_phone || 'Not provided',

    booking_number: booking.booking_number,
    hotel_name: booking.hotel,
    hotel_logo: hotelLogo,
    hotel_address: hotelAddress,
    hotel_phone: hotelPhone,

    checkin: formatDateForDisplay(booking.checkin),
    checkout: formatDateForDisplay(booking.checkout),
    total_nights: booking.total_nights,
    total_amount: booking.total_amount,

    room_type: roomTypesDisplay,
    room_types: roomTypesDisplay,
    ...buildEmailRoomDetails(booking),
    num_rooms: booking.num_rooms,

    num_adults: totalAdults,
    num_children_above_6: totalChildrenAbove6,
    num_children_below_6: totalChildrenBelow6,
    total_guests: totalGuests,

    meal_plan: mealPlanDisplay,
    special_requests: booking.special_requests || 'None',
    payment_method: booking.payment_method,

    booking_date: formatDateForDisplay(booking.created_at || new Date().toISOString()),
    checkin_time: '2:00 PM',
    checkout_time: '12:00 PM',

    room_charges: (booking.total_amount * 0.8).toFixed(2),
    tax_amount: (booking.total_amount * 0.05).toFixed(2),
    tax_rate: 5,
    status: 'CONFIRMED',
  };

  await emailjsSend(config.emailjs.guestTemplateId, guestEmailData);

  let adminSent = false;
  if (hotelAdminEmail && hotelAdminEmail.includes('@')) {
    // identical parameters, recipient swapped to the hotel admin
    const { to_email, reply_to, ...rest } = guestEmailData; // eslint-disable-line no-unused-vars
    await emailjsSend(config.emailjs.adminTemplateId, { ...rest, email: hotelAdminEmail });
    adminSent = true;
  }

  return { adminSent };
}
