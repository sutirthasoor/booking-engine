import { getDatesBetween } from '../utils/dates.js';

/** Minimum rooms of one type free on every night of the stay. */
export function getMaxAvailable(hotel, roomType, checkinStr, checkoutStr) {
  if (!checkinStr || !checkoutStr) return 0;

  const dates = getDatesBetween(checkinStr, checkoutStr);
  let minAvailable = Infinity;

  dates.forEach((dateStr) => {
    const available = hotel.inventory?.[dateStr]?.[roomType] || 0;
    minAvailable = Math.min(minAvailable, available);
  });

  return minAvailable === Infinity ? 0 : minAvailable;
}

/** Is at least one room type bookable for every night of the stay? */
export function checkHotelAvailability(hotel, checkinStr, checkoutStr) {
  if (!hotel.roomTypes || hotel.roomTypes.length === 0) return false;
  if (!hotel.inventory || Object.keys(hotel.inventory).length === 0) return false;

  const dates = getDatesBetween(checkinStr, checkoutStr);

  // Quick check: if there is no inventory data for any date, assume unavailable
  if (!dates.some((date) => hotel.inventory[date])) return false;

  for (const roomType of hotel.roomTypes) {
    let isAvailable = true;
    for (const date of dates) {
      const available = hotel.inventory[date]?.[roomType] || 0;
      if (available <= 0) {
        isAvailable = false;
        break;
      }
    }
    if (isAvailable) return true;
  }
  return false;
}

export const hasAvailableRooms = checkHotelAvailability;

/** Sum of the per-type availability across all room types. */
export function getTotalAvailableRooms(hotel, checkinStr, checkoutStr) {
  if (!hotel.roomTypes || hotel.roomTypes.length === 0) return 0;
  let total = 0;
  hotel.roomTypes.forEach((roomType) => {
    total += getMaxAvailable(hotel, roomType, checkinStr, checkoutStr);
  });
  return total;
}

/** Total number of rooms that could be booked together (used by the multi-room rules). */
export function getMaxRoomsForMultiRoom(hotel, checkinStr, checkoutStr) {
  if (!hotel || !checkinStr || !checkoutStr) return 0;

  if (!hotel.inventory || Object.keys(hotel.inventory).length === 0) {
    return hotel.roomTypes?.length || 0;
  }

  const dates = getDatesBetween(checkinStr, checkoutStr);
  if (dates.length === 0) return 0;

  let totalAvailableRooms = 0;
  hotel.roomTypes?.forEach((roomType) => {
    let minAvailable = Infinity;
    dates.forEach((dateStr) => {
      const available = hotel.inventory[dateStr]?.[roomType] || 0;
      minAvailable = Math.min(minAvailable, available);
    });
    if (minAvailable !== Infinity && minAvailable > 0) {
      totalAvailableRooms += minAvailable;
    }
  });
  return totalAvailableRooms;
}
