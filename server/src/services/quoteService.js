import { config } from '../config.js';
import { formatDateForDisplay } from '../utils/dates.js';
import { round2 } from '../utils/money.js';
import {
  calculateConvenienceFee,
  calculateRoomRate,
  getApplicableOffers,
  getExtraAdultRate,
} from './pricingService.js';
import { normalizeSelection } from './roomService.js';

/** Number of "extra adult" equivalents charged for one room (display breakdown). */
function extraAdultEquivalents(adults, childrenAbove6) {
  const totalAdultEquivalents = adults + childrenAbove6;
  if (adults === 1 && childrenAbove6 >= 1) return childrenAbove6;
  if (adults === 2 && childrenAbove6 >= 1) return childrenAbove6;
  if (totalAdultEquivalents > 2) return totalAdultEquivalents - 2;
  return 0;
}

function addonAmount(addon, sel) {
  let price = Number(addon.price) || 0;
  if (addon.type === 'per_night') {
    price *= sel.nights * sel.numRooms;
  } else if (addon.type === 'per_person') {
    price *= sel.totals.adults + sel.totals.childrenAbove6 + sel.totals.childrenBelow6;
  }
  // per_room (and unknown types) are charged once, as before
  return price;
}

/**
 * Full price breakdown for a selection. This is the single source of truth used by the
 * guest-details page, the payment page, the booking record, the Razorpay order and the voucher.
 */
export function buildQuote(hotel, rawSelection, { addons = [], paymentMethod = '' } = {}) {
  const sel = normalizeSelection(hotel, rawSelection);
  const { checkin, checkout, nights, numRooms, isMulti } = sel;

  const rows = [];
  let roomCharges = 0;
  let extraPersonCharges = 0;
  let mealPlanSurcharge = 0;

  if (isMulti) {
    sel.multiRoomConfig.forEach((room, index) => {
      const args = [hotel, room.roomType, checkin, checkout];
      const epRate = calculateRoomRate(...args, 'ep', room.adults, room.childrenAbove6, room.childrenBelow6);
      const cpRate = calculateRoomRate(...args, 'cp', room.adults, room.childrenAbove6, room.childrenBelow6);
      const roomRate = room.mealPlan === 'cp' ? cpRate : epRate;
      const charges = roomRate * nights;
      roomCharges += charges;
      if (room.mealPlan === 'cp') mealPlanSurcharge += (cpRate - epRate) * nights;

      const eq = extraAdultEquivalents(room.adults, room.childrenAbove6);
      const extraRate = getExtraAdultRate(hotel, room.roomType, checkin, checkout);
      const extraCharge = eq * extraRate * nights;
      extraPersonCharges += extraCharge;

      rows.push({
        roomNumber: index + 1,
        roomType: room.roomType,
        mealPlan: room.mealPlan,
        roomCharges: charges,
        extraPersonCharge: extraCharge,
        extraAdultEquivalents: eq,
        extraAdultRate: extraRate,
      });
    });
  } else {
    const o = sel.occupancy;
    const args = [hotel, sel.roomType, checkin, checkout];
    const epRate = calculateRoomRate(...args, 'ep', o.adults, o.childrenAbove6, o.childrenBelow6);
    const cpRate = calculateRoomRate(...args, 'cp', o.adults, o.childrenAbove6, o.childrenBelow6);
    const roomRate = sel.mealPlan === 'cp' ? cpRate : epRate;
    roomCharges = roomRate * nights * numRooms;
    if (sel.mealPlan === 'cp') mealPlanSurcharge = (cpRate - epRate) * nights * numRooms;

    const eq = extraAdultEquivalents(o.adults, o.childrenAbove6);
    const extraRate = getExtraAdultRate(hotel, sel.roomType, checkin, checkout);
    extraPersonCharges = eq * extraRate * nights * numRooms;

    rows.push({
      roomNumber: 1,
      roomType: sel.roomType,
      mealPlan: sel.mealPlan,
      roomCharges,
      extraPersonCharge: extraPersonCharges,
      extraAdultEquivalents: eq,
      extraAdultRate: extraRate,
    });
  }

  // Add-ons
  let addonsCharges = 0;
  const addonLines = [];
  (addons || []).forEach((index) => {
    const addon = (hotel.addons || [])[index];
    if (!addon) return;
    addonsCharges += addonAmount(addon, sel);
    addonLines.push({ name: addon.name, price: addon.price });
  });

  // Offers (those valid today for the first selected room type)
  const applicableOffers = getApplicableOffers(hotel, sel.roomType);
  let offerDiscount = 0;
  const offerDetails = [];
  applicableOffers.forEach((offer) => {
    let discount = 0;
    if (offer.type === 'percentage') {
      discount = (roomCharges * offer.value) / 100;
    } else if (offer.type === 'fixed') {
      discount = offer.value;
    } else if (offer.type === 'free_night') {
      const nightsToDiscount = Math.min(offer.value, nights);
      discount = sel.rate * numRooms * nightsToDiscount;
    }
    offerDiscount += discount;
    offerDetails.push({ name: offer.name, discount: round2(discount) });
  });
  offerDiscount = Math.min(offerDiscount, roomCharges);

  // Tax
  const { highTaxThresholdPerNight, highTaxRate, lowTaxRate } = config.business;
  const taxRate = sel.rate >= highTaxThresholdPerNight ? highTaxRate : lowTaxRate;
  const taxableAmount = roomCharges + addonsCharges - offerDiscount;
  const taxAmount = Math.round(taxableAmount * taxRate);

  // Gateway convenience fee for online payments
  let convenienceFee = 0;
  let commission = 0;
  let gstOnCommission = 0;
  if (paymentMethod && String(paymentMethod).startsWith('razorpay')) {
    const fee = calculateConvenienceFee(taxableAmount + taxAmount);
    convenienceFee = fee.totalConvenienceFee;
    commission = fee.commission;
    gstOnCommission = fee.gstOnCommission;
  }

  const totalAmount = taxableAmount + taxAmount + convenienceFee;

  const cpRooms = isMulti
    ? sel.multiRoomConfig.filter((r) => r.mealPlan === 'cp').length
    : sel.mealPlan === 'cp' ? numRooms : 0;
  const epRooms = isMulti ? sel.multiRoomConfig.length - cpRooms : numRooms - cpRooms;

  const totalGuests = sel.totals.adults + sel.totals.childrenAbove6 + sel.totals.childrenBelow6;
  const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

  return {
    selection: sel,
    applicableOfferCount: applicableOffers.length,
    taxRate,
    rows,
    cpRooms,
    epRooms,
    charges: {
      roomCharges: round2(roomCharges),
      baseRoomCharges: round2(roomCharges - mealPlanSurcharge - extraPersonCharges),
      mealPlanSurcharge: round2(mealPlanSurcharge),
      extraPersonCharges: round2(extraPersonCharges),
      addonsCharges: round2(addonsCharges),
      offerDiscount: round2(offerDiscount),
      taxAmount,
      convenienceFee: round2(convenienceFee),
      commission: round2(commission),
      gstOnCommission: round2(gstOnCommission),
      totalAmount: round2(totalAmount),
    },
    addonLines,
    offerDetails,
    // single-room extras line on the payment page
    extraPersons: isMulti ? rows.reduce((s, r) => s + r.extraAdultEquivalents, 0) : rows[0].extraAdultEquivalents * numRooms,
    extraAdultRate: rows[0].extraAdultRate,
    summary: {
      hotelName: hotel.name,
      previewBookingId: `KAK-${Date.now().toString().slice(-6)}`,
      guestRoomText: isMulti
        ? `${plural(sel.multiRoomConfig.length, 'Room')} • ${sel.multiRoomConfig.map((r) => r.roomType).join(', ')}`
        : `${sel.roomType} • ${plural(numRooms, 'Room')}`,
      guestDatesText: `${formatDateForDisplay(checkin)} - ${formatDateForDisplay(checkout)} (${plural(nights, 'night')})`,
      guestGuestsText: plural(totalGuests, 'Guest'),
      paymentRoomText: isMulti
        ? `${sel.multiRoomConfig.length} rooms (${epRooms} EP, ${cpRooms} CP)`
        : `${sel.roomType} (${numRooms} room(s), ${sel.mealPlan === 'cp' ? 'Breakfast Included' : 'Room Only'})`,
      paymentDatesText: `${checkin} to ${checkout} ${nights} nights`,
      paymentGuestsText: `${sel.totals.adults} Adults, ${sel.totals.childrenAbove6} (6+), ${sel.totals.childrenBelow6} Children (<6)`,
    },
  };
}
