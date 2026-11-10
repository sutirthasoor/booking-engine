import { config } from '../config.js';
import { getDatesBetween, todayUtc } from '../utils/dates.js';

const { defaultEpPrice, defaultCpPrice } = config.business;

/** Average "extra adult" rate across the nights of the stay. */
export function getExtraAdultRate(hotel, roomType, checkinStr, checkoutStr) {
  if (!checkinStr || !checkoutStr) return 0;

  const dates = getDatesBetween(checkinStr, checkoutStr);
  let totalRate = 0;
  const nights = dates.length;

  dates.forEach((dateStr) => {
    totalRate += hotel.rates?.[dateStr]?.[roomType]?.extra_adult || 0;
  });

  return nights > 0 ? Math.round(totalRate / nights) : 0;
}

/** Price from the room-details record (used when the extranet has no rate for a date). */
function roomDetailPrice(roomDetail, mealPlan, adults) {
  const ep = mealPlan === 'ep';
  if (adults === 1) {
    return ep
      ? roomDetail.singlePrice || roomDetail.basePrice || defaultEpPrice
      : roomDetail.singleCpPrice || roomDetail.cpPrice || defaultCpPrice;
  }
  if (adults === 2) {
    return ep
      ? roomDetail.doublePrice || (roomDetail.basePrice || defaultEpPrice) * 1.5
      : roomDetail.doubleCpPrice || (roomDetail.cpPrice || defaultCpPrice) * 1.5;
  }
  return ep ? roomDetail.basePrice || defaultEpPrice : roomDetail.cpPrice || defaultCpPrice;
}

/**
 * Per-night rate for ONE room.
 * Uses the extranet rate table (single/double/extra adult, EP/CP) and falls back to the
 * room details / hard-coded defaults, exactly like the original calculateRoomRate().
 */
export function calculateRoomRate(
  hotel,
  roomType,
  checkinStr,
  checkoutStr,
  mealPlan,
  adults,
  childrenAbove6,
  childrenBelow6 // eslint-disable-line no-unused-vars
) {
  const roomDetail = hotel.roomDetails?.[roomType] || {};
  const hasRates = hotel.rates && Object.keys(hotel.rates).length > 0;

  if (hasRates) {
    if (!checkinStr || !checkoutStr) {
      return roomDetailPrice(roomDetail, mealPlan, adults);
    }

    const dates = getDatesBetween(checkinStr, checkoutStr);
    let totalRate = 0;
    const nights = dates.length;
    const epMode = mealPlan === 'ep';
    const singleKey = epMode ? 'single_ep' : 'single_cp';
    const doubleKey = epMode ? 'double_ep' : 'double_cp';

    dates.forEach((dateStr) => {
      let rate = 0;

      if (hotel.rates[dateStr] && hotel.rates[dateStr][roomType]) {
        const roomRates = hotel.rates[dateStr][roomType];
        const totalAdultEquivalents = adults + childrenAbove6;

        if (totalAdultEquivalents === 1) {
          rate = roomRates[singleKey] || roomRates[mealPlan] || 0;
        } else if (totalAdultEquivalents === 2) {
          rate = roomRates[doubleKey] || roomRates[mealPlan] || 0;
        } else if (totalAdultEquivalents > 2) {
          // more than 2 adults: double rate + (extra adults * extra adult rate)
          const doubleRate = roomRates[doubleKey] || roomRates[mealPlan] || 0;
          const extraAdultRate = roomRates.extra_adult || 0;
          rate = doubleRate + (totalAdultEquivalents - 2) * extraAdultRate;
        }
      }

      // No usable extranet rate for this date -> room details logic
      if (rate === 0) {
        let basePrice = roomDetailPrice(roomDetail, mealPlan, adults);
        if (childrenAbove6 > 0) {
          basePrice += childrenAbove6 * getExtraAdultRate(hotel, roomType, checkinStr, checkoutStr);
        }
        rate = basePrice;
      }

      totalRate += rate;
    });

    return nights > 0 ? Math.round(totalRate / nights) : epMode ? defaultEpPrice : defaultCpPrice;
  }

  // Fallback: no extranet rates loaded at all
  let basePrice = roomDetailPrice(roomDetail, mealPlan, adults);
  if (childrenAbove6 > 0) {
    basePrice += childrenAbove6 * getExtraAdultRate(hotel, roomType, checkinStr, checkoutStr);
  }
  return basePrice;
}

/** Offers valid today and applicable to the room type. */
export function getApplicableOffers(hotel, roomType) {
  if (!hotel.offers || !Array.isArray(hotel.offers)) return [];

  const today = todayUtc();
  return hotel.offers.filter((offer) => {
    if (offer.start_date && offer.start_date > today) return false;
    if (offer.end_date && offer.end_date < today) return false;
    if (offer.room_types && offer.room_types.length > 0) {
      if (!offer.room_types.includes(roomType)) return false;
    }
    return true;
  });
}

/** Razorpay convenience fee: 2% commission (min 0.03) + 18% GST on that commission. */
export function calculateConvenienceFee(amount) {
  const { convenienceMinimumCommission, convenienceCommissionRate, convenienceGstRate } = config.business;

  const commission = Math.max(amount * convenienceCommissionRate, convenienceMinimumCommission);
  const gstOnCommission = commission * convenienceGstRate;
  const totalConvenienceFee = commission + gstOnCommission;

  return {
    commission,
    gstOnCommission,
    totalConvenienceFee,
    finalAmount: amount + totalConvenienceFee,
  };
}

/**
 * "From" price used by the price filter on the hotel list. The list query does not load
 * rates, so (as in the original) this resolves to the room-details base price fallback.
 */
export function getStartingPrice(hotel, checkinStr, checkoutStr) {
  if (!hotel.roomTypes || hotel.roomTypes.length === 0) return 0;

  let lowestPrice = Infinity;
  hotel.roomTypes.forEach((roomType) => {
    if (hotel.rates && Object.keys(hotel.rates).length > 0) {
      const singleEpRate = calculateRoomRate(hotel, roomType, checkinStr, checkoutStr, 'ep', 1, 0, 0);
      if (singleEpRate < lowestPrice) lowestPrice = singleEpRate;
    } else {
      const roomDetail = hotel.roomDetails?.[roomType] || {};
      const basePrice = roomDetail.basePrice || defaultEpPrice;
      if (basePrice < lowestPrice) lowestPrice = basePrice;
    }
  });

  return lowestPrice === Infinity ? 0 : lowestPrice;
}
