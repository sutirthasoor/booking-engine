import { supabase } from '../supabase.js';
import { config } from '../config.js';
import { ApiError } from '../utils/errors.js';

// ---------------------------------------------------------------------------
// Tiny in-memory cache for READ-ONLY endpoints (hotel list / room pages).
// Booking writes always call the loaders with { fresh: true }.
// ---------------------------------------------------------------------------
const cache = new Map();

async function cached(key, fresh, loader) {
  const ttl = config.cacheTtlMs;
  const hit = cache.get(key);
  if (!fresh && ttl > 0 && hit && Date.now() - hit.at < ttl) return hit.value;
  const value = await loader();
  cache.set(key, { value, at: Date.now() });
  return value;
}

export function invalidateHotelCache(hotelId) {
  cache.delete('list');
  if (hotelId !== undefined) cache.delete(`full:${hotelId}`);
}

// ---------------------------------------------------------------------------
// Row mappers (identical field handling to the original loadHotelData / renderRooms)
// ---------------------------------------------------------------------------
function mapListRow(hotel) {
  const photos = hotel.photos
    ? Array.isArray(hotel.photos)
      ? hotel.photos.slice(0, 2)
      : Object.values(hotel.photos).slice(0, 2)
    : [];

  return {
    id: hotel.id,
    name: hotel.name,
    location: hotel.location || 'City Center',
    logo: hotel.logo || '',
    roomTypes: hotel.room_types || [],
    inventory: hotel.inventory || {},
    photos,
    admin_email: hotel.admin_email,
  };
}

/**
 * JSON columns are not always stored as arrays (an object keyed by id, a JSON string, null...).
 * Always hand the rest of the app a plain array; the order is kept because add-ons are
 * selected by their position.
 */
export function toArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { return toArray(JSON.parse(value)); } catch { return []; }
  }
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function mapDetailRow(data) {
  return {
    roomDetails: data.room_details || {},
    rates: data.rates || {},
    offers: toArray(data.offers),
    addons: toArray(data.addons),
    tax_rate: data.tax_rate || 5.0,
    active_payment_gateway: data.active_payment_gateway || 'upi',
    razorpay_key_id: data.razorpay_key_id || '',
    razorpay_key_secret: data.razorpay_key_secret || '',
    qr_code: data.qr_code || '',
  };
}

/** Hotels shown on the search page (max 12, ordered by name). */
export async function listHotels({ fresh = false } = {}) {
  return cached('list', fresh, async () => {
    const { data, error } = await supabase
      .from('hotels')
      .select('id, name, location, logo, room_types, inventory, photos, admin_email')
      .limit(config.business.maxHotels)
      .order('name', { ascending: true });
    if (error) throw new ApiError(502, error.message);
    return (data || []).map(mapListRow);
  });
}

/**
 * One hotel with everything needed for rooms / pricing / payment.
 * The returned object contains Razorpay secrets - it must never be sent to the browser
 * (use toPublicHotel()).
 */
export async function getFullHotel(hotelId, { fresh = false } = {}) {
  if (hotelId === undefined || hotelId === null || hotelId === '') {
    throw new ApiError(400, 'Hotel not found');
  }
  return cached(`full:${hotelId}`, fresh, async () => {
    const { data: base, error: baseError } = await supabase
      .from('hotels')
      .select('id, name, location, logo, room_types, inventory, photos, admin_email')
      .eq('id', hotelId)
      .single();
    if (baseError || !base) throw new ApiError(404, 'Hotel not found');

    const hotel = mapListRow(base);

    const { data: details, error: detailError } = await supabase
      .from('hotels')
      .select('room_details, rates, offers, addons, tax_rate, active_payment_gateway, razorpay_key_id, razorpay_key_secret, qr_code')
      .eq('id', hotelId)
      .single();

    if (detailError) {
      // Original behaviour: if details fail to load, fall back to defaults and keep going.
      console.error('Error loading room details:', detailError.message);
      Object.assign(hotel, mapDetailRow({}), { _detailsError: true });
    } else {
      Object.assign(hotel, mapDetailRow(details || {}));
    }
    return hotel;
  });
}

/** Remove server-only fields (payment secrets, raw inventory) before sending to the browser. */
export function toPublicHotel(hotel) {
  return {
    id: hotel.id,
    name: hotel.name,
    location: hotel.location,
    logo: hotel.logo,
    roomTypes: hotel.roomTypes,
    photos: hotel.photos,
  };
}
