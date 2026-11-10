import { supabase } from '../supabase.js';
import { ApiError, toast } from '../utils/errors.js';
import { getDatesBetween } from '../utils/dates.js';
import { getApplicableOffers } from './pricingService.js';
import { invalidateHotelCache } from './hotelService.js';

export function normalizeRoomType(str) {
  return String(str || '').toUpperCase().replace(/\s+/g, ' ').trim();
}

export function generateBookingNumber() {
  return `KAK-${Date.now().toString().slice(-6)}${Math.random().toString(36).substr(2, 3).toUpperCase()}`;
}

/** Insert the booking row (same columns and values as the original createBookingRecord). */
/** The booking is saved as 'pending'; it only becomes 'confirmed' after the payment is verified. */
export async function createBookingRecord({ hotel, quote, guest, paymentMethod, addons, bookingNumber, orderId }) {
  const sel = quote.selection;
  const { charges } = quote;

  const bookingData = {
    booking_number: bookingNumber,
    hotel: hotel.name,
    room_configuration: sel.isMulti
      ? sel.multiRoomConfig
      : [
          {
            room_type: sel.roomType,
            num_adults: sel.totals.adults,
            num_children_above_6: sel.totals.childrenAbove6,
            num_children_below_6: sel.totals.childrenBelow6,
          },
        ],
    total_rooms: sel.numRooms,
    tax_rate: quote.taxRate,
    room_type: sel.roomType,
    meal_plan: sel.mealPlan,
    num_rooms: sel.numRooms,
    num_adults: sel.totals.adults,
    num_children_above_6: sel.totals.childrenAbove6,
    num_children_below_6: sel.totals.childrenBelow6,
    guest_name: guest.name,
    guest_email: guest.email,
    guest_phone: guest.phone,
    special_requests: guest.specialRequests,
    checkin: sel.checkin,
    checkout: sel.checkout,
    total_nights: sel.nights,
    total_amount: charges.totalAmount,
    payment_method: paymentMethod,
    status: 'pending',
    offers_data: getApplicableOffers(hotel, sel.roomType),
    addons_data: (addons || []).map((i) => hotel.addons?.[i]).filter(Boolean),
    convenience_fee: charges.convenienceFee,
    commission: charges.commission,
    gst_on_commission: charges.gstOnCommission,
    razorpay_order_id: orderId || '',
  };

  const { data, error } = await supabase.from('bookings').insert([bookingData]).select();
  if (error) throw new ApiError(502, error.message);
  return data[0];
}

/**
 * Deduct the booked rooms from the hotel inventory for every night of the stay.
 * Faithful port of the original updateHotelInventory() (including partial deductions).
 * Returns { success, ... } and a list of toasts describing the outcome.
 */
export async function updateHotelInventory({ hotelId, selection, bookingNumber }) {
  const toasts = [];
  try {
    const { data: hotelData, error } = await supabase
      .from('hotels')
      .select('inventory')
      .eq('id', hotelId)
      .single();

    if (error || !hotelData?.inventory) throw new Error('Inventory not found');

    const updatedInventory = JSON.parse(JSON.stringify(hotelData.inventory));
    const dates = getDatesBetween(selection.checkin, selection.checkout);

    // Build room type counts for single and multi-room bookings
    const roomTypeCounts = {};
    const roomTypeDetails = {};

    if (selection.roomType && !selection.isMulti) {
      const t = normalizeRoomType(selection.roomType);
      roomTypeCounts[t] = selection.numRooms || 1;
      roomTypeDetails[t] = [{ roomIndex: 0, ...selection.occupancy, mealPlan: selection.mealPlan }];
    }

    if (selection.isMulti) {
      selection.multiRoomConfig.forEach((room, index) => {
        const t = normalizeRoomType(room.roomType);
        if (!t) return;
        roomTypeCounts[t] = (roomTypeCounts[t] || 0) + 1;
        (roomTypeDetails[t] ||= []).push({
          roomIndex: index,
          adults: room.adults,
          childrenAbove6: room.childrenAbove6,
          childrenBelow6: room.childrenBelow6,
          mealPlan: room.mealPlan || 'ep',
        });
      });
    }

    if (Object.keys(roomTypeCounts).length === 0) throw new Error('No room types to book');

    // Normalize inventory keys (same behaviour as before)
    for (const date of Object.keys(updatedInventory)) {
      const normalized = {};
      for (const rt in updatedInventory[date]) {
        normalized[normalizeRoomType(rt)] = Number(updatedInventory[date][rt]) || 0;
      }
      updatedInventory[date] = normalized;
    }

    const successfulDeductions = [];
    const failedDeductions = [];
    const partialDeductions = [];

    for (const [roomType, count] of Object.entries(roomTypeCounts)) {
      let maxAvailable = Infinity;
      for (const date of dates) {
        maxAvailable = Math.min(maxAvailable, updatedInventory[date]?.[roomType] || 0);
      }
      const roomsToDeduct = Math.min(count, maxAvailable);

      if (roomsToDeduct === 0) {
        failedDeductions.push({ roomType, requested: count, available: 0, message: `No ${roomType} rooms available for selected dates` });
        continue;
      }

      if (roomsToDeduct < count) {
        partialDeductions.push({
          roomType,
          requested: count,
          deducted: roomsToDeduct,
          failed: count - roomsToDeduct,
          available: maxAvailable,
          message: `Only ${roomsToDeduct} of ${count} ${roomType} rooms available`,
        });
      }

      for (const date of dates) {
        const before = updatedInventory[date]?.[roomType] || 0;
        updatedInventory[date][roomType] = Math.max(0, before - roomsToDeduct);
      }

      successfulDeductions.push({
        roomType,
        count: roomsToDeduct,
        bookedRooms: roomTypeDetails[roomType]?.slice(0, roomsToDeduct) || [],
        failedRooms: roomTypeDetails[roomType]?.slice(roomsToDeduct) || [],
      });
    }

    if (successfulDeductions.length === 0 && failedDeductions.length > 0) {
      throw new Error('No rooms could be deducted. Booking failed.');
    }

    const { error: updateError } = await supabase.from('hotels').update({ inventory: updatedInventory }).eq('id', hotelId);
    if (updateError) throw updateError;
    invalidateHotelCache(hotelId);

    // Mark the booking as confirmed
    if (bookingNumber) {
      const { error: statusError } = await supabase
        .from('bookings')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('booking_number', bookingNumber);
      if (statusError) console.error('Failed to update booking status:', statusError.message);
    }

    if (failedDeductions.length === 0 && partialDeductions.length === 0) {
      toasts.push(toast('success', `${selection.isMulti ? 'multiple rooms' : selection.roomType} booked successfully!`));
    } else if (partialDeductions.length > 0) {
      toasts.push(toast('warning', `Partial booking: ${partialDeductions.map((p) => p.message).join(', ')}`));
    } else {
      toasts.push(toast('error', `Booking issues: ${failedDeductions.map((f) => f.message).join(', ')}`));
    }

    return { success: true, successfulDeductions, partialDeductions, failedDeductions, toasts };
  } catch (err) {
    console.error('Inventory update failed:', err);
    toasts.push(
      err.message?.includes('No rooms could be deducted')
        ? toast('error', 'No rooms available for booking')
        : toast('error', `Inventory update failed: ${err.message}`)
    );
    return { success: false, error: err.message, message: 'Booking failed completely', toasts };
  }
}

export async function getBooking(bookingNumber) {
  const { data, error } = await supabase.from('bookings').select('*').eq('booking_number', bookingNumber).single();
  if (error) return null;
  return data;
}

/** Atomically take ownership of a pending booking so a payment can only be processed once. */
export async function claimPendingBooking(bookingNumber) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('booking_number', bookingNumber)
    .eq('status', 'pending')
    .select();
  if (error) throw new ApiError(502, error.message);
  return Array.isArray(data) && data.length > 0;
}

export async function setBookingStatus(bookingNumber, status) {
  await supabase
    .from('bookings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('booking_number', bookingNumber);
}
