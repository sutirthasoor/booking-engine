import { Router } from 'express';
import { asyncHandler, assertValidDates, ok, refuse } from '../utils/http.js';
import { toast } from '../utils/errors.js';
import { getFullHotel, listHotels, toPublicHotel } from '../services/hotelService.js';
import {
  checkHotelAvailability,
  getTotalAvailableRooms,
} from '../services/availabilityService.js';
import { getStartingPrice } from '../services/pricingService.js';
import { buildRoomsView } from '../services/roomService.js';
import { getPaymentConfig } from '../services/paymentService.js';

const router = Router();

const DEFAULT_PHOTO = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=250&fit=crop';
const validPhoto = (p) =>
  p && typeof p === 'string' && p.trim() !== '' &&
  (p.startsWith('http') || p.startsWith('data:') || p.startsWith('/'));

/** Always exactly 3 images for the card carousel (same rules as the original page). */
function displayPhotos(hotel) {
  let photos = [];
  if (Array.isArray(hotel.photos) && hotel.photos.length > 0) photos = hotel.photos;
  else if (hotel.photos && typeof hotel.photos === 'object') photos = Object.values(hotel.photos);

  const valid = photos.filter(validPhoto);
  if (valid.length === 2) return [valid[0], valid[1], valid[0]];
  if (valid.length === 1) return [valid[0], valid[0], valid[0]];
  if (valid.length >= 3) return valid.slice(0, 3);
  return [DEFAULT_PHOTO, `${DEFAULT_PHOTO}&auto=format`, `${DEFAULT_PHOTO}&auto=format&brightness=0.9`];
}

function matchesPrice(price, range) {
  if (!range) return true;
  if (range.endsWith('+')) return price >= parseInt(range, 10);
  const [min, max] = range.split('-').map((v) => parseInt(v, 10));
  return price >= min && price <= max;
}

// Search / filter the hotel list
router.post('/search', asyncHandler(async (req, res) => {
  const { checkin, checkout, location = '', sidebarLocation = '', price = '' } = req.body || {};
  assertValidDates(checkin, checkout);

  const hotels = await listHotels();
  const locations = [...new Set(hotels.map((h) => h.location).filter(Boolean))];

  // sidebar filter wins over the destination dropdown
  const selectedLocation = sidebarLocation || location;
  let filtered = hotels;
  if (selectedLocation) filtered = filtered.filter((h) => h.location === selectedLocation);
  if (price) filtered = filtered.filter((h) => matchesPrice(getStartingPrice(h, checkin, checkout), price));

  ok(res, {
    totalHotels: hotels.length,
    locations,
    hotels: filtered.map((hotel) => {
      const available = checkHotelAvailability(hotel, checkin, checkout);
      return {
        id: hotel.id,
        name: hotel.name,
        location: hotel.location || 'City Center',
        hasAvailableRooms: available,
        availableRooms: getTotalAvailableRooms(hotel, checkin, checkout),
        roomTypeCount: hotel.roomTypes?.length || 0,
        photos: displayPhotos(hotel),
      };
    }),
  });
}));

// Validate a hotel choice before moving to the rooms page
router.post('/select', asyncHandler(async (req, res) => {
  const { hotelId, checkin, checkout } = req.body || {};
  const hotel = (await listHotels()).find((h) => String(h.id) === String(hotelId));

  if (!hotel) return refuse(res, [toast('error', 'Hotel not found')]);
  if (!checkHotelAvailability(hotel, checkin, checkout)) {
    return refuse(res, [toast('error', 'This hotel has no available rooms for your selected dates. Please try different dates.')]);
  }
  if (!hotel.roomTypes || hotel.roomTypes.length === 0) {
    return refuse(res, [toast('error', 'No room types available for this hotel')]);
  }
  ok(res, { hotel: { id: hotel.id, name: hotel.name, roomTypeCount: hotel.roomTypes.length } });
}));

// Rooms page data
router.get('/:id/rooms', asyncHandler(async (req, res) => {
  const { checkin, checkout } = req.query;
  assertValidDates(checkin, checkout);
  const hotel = await getFullHotel(req.params.id);
  ok(res, { hotel: toPublicHotel(hotel), ...buildRoomsView(hotel, checkin, checkout) });
}));

// Payment page configuration (no secrets)
router.get('/:id/payment-config', asyncHandler(async (req, res) => {
  const hotel = await getFullHotel(req.params.id);
  ok(res, { paymentConfig: getPaymentConfig(hotel) });
}));

export default router;
