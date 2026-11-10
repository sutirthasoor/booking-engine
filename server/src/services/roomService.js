import { calculateNights } from '../utils/dates.js';
import { toast } from '../utils/errors.js';
import {
  getMaxAvailable,
  getMaxRoomsForMultiRoom,
} from './availabilityService.js';
import { calculateRoomRate, getExtraAdultRate } from './pricingService.js';

export const DEFAULT_OCCUPANCY = Object.freeze({ adults: 1, childrenAbove6: 0, childrenBelow6: 0 });
export const FALLBACK_ROOM_PHOTO =
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=250&fit=crop';
const DEFAULT_AMENITIES = ['Free WiFi', 'Air Conditioning', 'TV', 'Private Bathroom', 'Toiletries'];
const HARD_ROOM_CAP = 10; // "Maximum 10 rooms allowed" in the multi-room dialog

// The original script used different fallback capacities in different places when a room
// has no maxAdults / maxOccupants configured. They are kept per context.
const CAPS = {
  card: { adults: 2, occupants: 4 }, // room cards + multi-room table rendering
  occupancyModal: { adults: 4, occupants: 5 }, // single room occupancy dialog
  rules: { adults: 4, occupants: 5 }, // multi-room edits + Book Now validation
  upgrade: { adults: 3, occupants: 4 },
};

function capacity(hotel, roomType, ctx) {
  const detail = hotel.roomDetails?.[roomType] || {};
  return {
    maxAdults: detail.maxAdults || CAPS[ctx].adults,
    maxOccupants: detail.maxOccupants || CAPS[ctx].occupants,
    detail,
  };
}

const range = (from, to) => (to < from ? [] : Array.from({ length: to - from + 1 }, (_, i) => from + i));
const toInt = (v, fallback = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function cleanOccupancy(o) {
  return {
    adults: toInt(o?.adults, 1),
    childrenAbove6: toInt(o?.childrenAbove6, 0),
    childrenBelow6: toInt(o?.childrenBelow6, 0),
  };
}

// ---------------------------------------------------------------------------
// Rooms page
// ---------------------------------------------------------------------------
export function buildRoomsView(hotel, checkin, checkout) {
  const nights = calculateNights(checkin, checkout);

  const rooms = (hotel.roomTypes || []).map((roomType) => {
    const { maxAdults, maxOccupants, detail } = capacity(hotel, roomType, 'card');
    const maxRooms = getMaxAvailable(hotel, roomType, checkin, checkout);
    return {
      roomType,
      maxAdults,
      maxOccupants,
      childAgeLimit: detail.childAgeLimit || 6,
      amenities: detail.amenities || DEFAULT_AMENITIES,
      photos: detail.photos || [FALLBACK_ROOM_PHOTO],
      singleEpRate: calculateRoomRate(hotel, roomType, checkin, checkout, 'ep', 1, 0, 0),
      singleCpRate: calculateRoomRate(hotel, roomType, checkin, checkout, 'cp', 1, 0, 0),
      extraAdultRate: getExtraAdultRate(hotel, roomType, checkin, checkout),
      maxRooms,
      isAvailable: maxRooms > 0,
    };
  });

  const offerBanner =
    hotel.offers && hotel.offers.length > 0
      ? hotel.offers[0].description || 'Special discount available!'
      : null;

  return { nights, rooms, offerBanner };
}

/** Rate (per night, ONE room) shown on a room card for the current occupancy / meal plan. */
export function roomRateFor(hotel, roomType, checkin, checkout, mealPlan, occupancy) {
  const o = cleanOccupancy(occupancy || DEFAULT_OCCUPANCY);
  return calculateRoomRate(hotel, roomType, checkin, checkout, mealPlan === 'cp' ? 'cp' : 'ep', o.adults, o.childrenAbove6, o.childrenBelow6);
}

// ---------------------------------------------------------------------------
// Occupancy dialog ("Step 1. Fill Up Occupancy")
// ---------------------------------------------------------------------------
function describeOccupancyRoom(room, maxAdults, maxOccupants) {
  const maxChildrenAbove6Possible = Math.max(0, maxAdults - room.adults);
  const maxChildrenBelow6Possible = Math.max(0, maxOccupants - (room.adults + room.childrenAbove6));
  return {
    adultsOptions: range(1, maxAdults),
    childrenAbove6Options: range(0, maxChildrenAbove6Possible),
    childrenBelow6Options: range(0, maxChildrenBelow6Possible),
    maxChildrenAbove6Possible,
    maxChildrenBelow6Possible,
    totalGuests: room.adults + room.childrenAbove6 + room.childrenBelow6,
  };
}

function occupancyView(hotel, roomType, rooms) {
  const { maxAdults, maxOccupants } = capacity(hotel, roomType, 'occupancyModal');
  const totals = rooms.reduce(
    (t, r) => ({
      adults: t.adults + r.adults,
      childrenAbove6: t.childrenAbove6 + r.childrenAbove6,
      childrenBelow6: t.childrenBelow6 + r.childrenBelow6,
    }),
    { adults: 0, childrenAbove6: 0, childrenBelow6: 0 }
  );
  return {
    maxAdults,
    maxOccupants,
    rooms: rooms.map((r) => describeOccupancyRoom(r, maxAdults, maxOccupants)),
    totals,
  };
}

export function occupancyInit(hotel, roomType, numRooms, base) {
  const baseOccupancy = cleanOccupancy(base || DEFAULT_OCCUPANCY);
  const count = Math.min(Math.max(1, toInt(numRooms, 1)), 50);
  const rooms = Array.from({ length: count }, () => ({ ...baseOccupancy }));
  return { rooms, view: occupancyView(hotel, roomType, rooms) };
}

const OCCUPANCY_FIELDS = ['adults', 'childrenAbove6', 'childrenBelow6'];

export function occupancyUpdate(hotel, roomType, rooms, index, field, value) {
  const next = (rooms || []).map(cleanOccupancy);
  const room = next[index];
  if (!room || !OCCUPANCY_FIELDS.includes(field)) return { rooms: next, view: occupancyView(hotel, roomType, next) };

  const { maxAdults, maxOccupants } = capacity(hotel, roomType, 'occupancyModal');

  room[field] = toInt(value, room[field]);

  // Auto-adjust other fields if they exceed limits
  const totalAdultEquivalents = room.adults + room.childrenAbove6;
  const totalOccupants = totalAdultEquivalents + room.childrenBelow6;

  if (room.childrenAbove6 > maxAdults - room.adults) {
    room.childrenAbove6 = Math.max(0, maxAdults - room.adults);
  }
  if (totalOccupants > maxOccupants) {
    room.childrenBelow6 = Math.max(0, maxOccupants - (room.adults + room.childrenAbove6));
  }

  return { rooms: next, view: occupancyView(hotel, roomType, next) };
}

/** "Apply Configuration" in the occupancy dialog. */
export function occupancyApply(roomType, rooms, mealPlan) {
  const cleaned = (rooms || []).map(cleanOccupancy);
  const plan = mealPlan === 'cp' ? 'cp' : 'ep';
  const numRooms = cleaned.length || 1;
  const toasts = [toast('success', `Configuration applied for ${numRooms} room${numRooms > 1 ? 's' : ''}`)];

  if (numRooms === 1) {
    return { mode: 'single', occupancy: cleaned[0] || { ...DEFAULT_OCCUPANCY }, toasts };
  }
  return {
    mode: 'multi',
    multiRoomConfig: cleaned.map((config, i) => ({ roomType, ...config, mealPlan: plan, roomIndex: i })),
    toasts,
  };
}

// ---------------------------------------------------------------------------
// Multi-room dialog ("Select Multiple Rooms Types")
// ---------------------------------------------------------------------------
function availableRoomTypes(hotel, checkin, checkout) {
  return (hotel.roomTypes || []).filter((rt) => getMaxAvailable(hotel, rt, checkin, checkout) > 0);
}

function cleanMultiConfig(config) {
  return (config || []).map((r, i) => ({
    roomType: r.roomType,
    ...cleanOccupancy(r),
    mealPlan: r.mealPlan === 'cp' ? 'cp' : 'ep',
    roomIndex: i,
  }));
}

function multiView(hotel, checkin, checkout, config) {
  const types = availableRoomTypes(hotel, checkin, checkout);
  const nights = calculateNights(checkin, checkout);
  const maxAvailable = getMaxRoomsForMultiRoom(hotel, checkin, checkout);
  const remaining = maxAvailable - config.length;

  const rows = config.map((room) => {
    const { maxAdults, maxOccupants } = capacity(hotel, room.roomType, 'card');
    const maxChildrenAbove6 = Math.max(0, maxAdults - room.adults);
    const maxChildrenBelow6 = Math.max(0, maxOccupants - (room.adults + room.childrenAbove6));

    const epRate = calculateRoomRate(hotel, room.roomType, checkin, checkout, 'ep', room.adults, room.childrenAbove6, room.childrenBelow6);
    const cpRate = calculateRoomRate(hotel, room.roomType, checkin, checkout, 'cp', room.adults, room.childrenAbove6, room.childrenBelow6);
    const priceDifference = cpRate - epRate;

    return {
      maxAdults,
      maxOccupants,
      adultsOptions: range(1, maxAdults),
      childrenAbove6Options: range(0, maxChildrenAbove6),
      childrenBelow6Options: range(0, maxChildrenBelow6),
      roomTypeOptions: types.map((type) => {
        const available = getMaxAvailable(hotel, type, checkin, checkout);
        const selectedCount = config.filter((r) => r.roomType === type).length;
        return { value: type, disabled: !(selectedCount < available) };
      }),
      priceDifference,
      totalDifference: priceDifference * nights,
      totalGuests: room.adults + room.childrenAbove6 + room.childrenBelow6,
    };
  });

  return {
    hotelName: hotel.name,
    maxAvailable,
    rows,
    warning:
      config.length > maxAvailable
        ? `Only ${maxAvailable} rooms available for selected dates. Please reduce room count or select different dates.`
        : null,
    addRoom: {
      disabled: remaining <= 0,
      text: remaining > 0 ? `Add Another Room (${remaining} left)` : 'Maximum Rooms Reached',
      badge: remaining > 0 ? `${remaining} more available` : 'No availability',
      badgeAvailable: remaining > 0,
    },
  };
}

export function multiInit(hotel, checkin, checkout, config, selectedNumRooms) {
  if (!hotel || !hotel.roomTypes) {
    return { ok: false, toasts: [toast('error', 'Please select a hotel first')] };
  }
  const maxAvailableRooms = getMaxRoomsForMultiRoom(hotel, checkin, checkout);
  if (maxAvailableRooms === 0) {
    return { ok: false, toasts: [toast('error', `No rooms available for ${hotel.name} on selected dates`)] };
  }
  const types = availableRoomTypes(hotel, checkin, checkout);
  if (types.length === 0) {
    return { ok: false, toasts: [toast('error', 'No rooms available for selected dates')] };
  }

  let cfg = cleanMultiConfig(config);
  let numRooms = toInt(selectedNumRooms, 1);

  // Initialise configuration if empty or the number of rooms changed
  if (cfg.length !== numRooms) {
    cfg = [];
    const initialRoomCount = Math.max(1, numRooms);
    for (let i = 0; i < initialRoomCount; i += 1) {
      const roomTypeIndex = Math.min(i, types.length - 1);
      cfg.push({ roomType: types[roomTypeIndex], adults: 1, childrenAbove6: 0, childrenBelow6: 0, mealPlan: 'ep', roomIndex: i });
    }
    numRooms = initialRoomCount;
  }

  return { ok: true, config: cfg, numRooms, view: multiView(hotel, checkin, checkout, cfg), toasts: [] };
}

function validateRoomOccupancy(hotel, room) {
  const { maxAdults, maxOccupants } = capacity(hotel, room.roomType, 'rules');
  if (room.adults < 1) room.adults = 1;
  if (room.adults > maxAdults) room.adults = maxAdults;

  const maxChildrenAbove6 = maxAdults - room.adults;
  if (room.childrenAbove6 > maxChildrenAbove6) room.childrenAbove6 = Math.max(0, maxChildrenAbove6);

  const maxChildrenBelow6 = maxOccupants - (room.adults + room.childrenAbove6);
  if (room.childrenBelow6 > maxChildrenBelow6) room.childrenBelow6 = Math.max(0, maxChildrenBelow6);
  return room;
}

/**
 * One edit inside the multi-room dialog.
 * action: { type: 'setRoomType'|'setOccupancy'|'setMealPlan'|'addRoom'|'removeRoom', ... }
 */
export function multiUpdate(hotel, checkin, checkout, configIn, action) {
  const config = cleanMultiConfig(configIn);
  const types = availableRoomTypes(hotel, checkin, checkout);
  const toasts = [];
  const { index } = action;

  switch (action.type) {
    case 'setRoomType': {
      const roomType = action.roomType;
      if (!config[index] || !(hotel.roomTypes || []).includes(roomType)) break;

      const availableForThisRoom = getMaxAvailable(hotel, roomType, checkin, checkout);
      const currentCountOfThisType = config.filter((r) => r.roomType === roomType).length;

      if (currentCountOfThisType >= availableForThisRoom && config[index].roomType !== roomType) {
        toasts.push(toast('warning', `Only ${availableForThisRoom} ${roomType} rooms available`));

        const alternative = types.find((type) => {
          const altAvailable = getMaxAvailable(hotel, type, checkin, checkout);
          const altCurrentCount = config.filter((r) => r.roomType === type).length;
          return altAvailable > altCurrentCount;
        });

        if (alternative) {
          toasts.push(toast('info', `Auto-selecting ${alternative} instead`));
          config[index].roomType = alternative;
        } else {
          return { config, numRooms: config.length, view: multiView(hotel, checkin, checkout, config), toasts };
        }
      } else {
        config[index].roomType = roomType;
      }

      // Reset occupancy to defaults for the new room type, then validate
      Object.assign(config[index], { adults: 1, childrenAbove6: 0, childrenBelow6: 0 });
      validateRoomOccupancy(hotel, config[index]);
      break;
    }

    case 'setOccupancy': {
      const room = config[index];
      if (!room || !OCCUPANCY_FIELDS.includes(action.field)) break;
      const { maxAdults, maxOccupants } = capacity(hotel, room.roomType, 'rules');

      room[action.field] = toInt(action.value, room[action.field]);

      const totalAdultEquivalents = room.adults + room.childrenAbove6;
      const totalOccupants = totalAdultEquivalents + room.childrenBelow6;

      if (room.childrenAbove6 > maxAdults - room.adults) {
        room.childrenAbove6 = Math.max(0, maxAdults - room.adults);
      }
      if (totalOccupants > maxOccupants) {
        room.childrenBelow6 = Math.max(0, maxOccupants - totalAdultEquivalents);
      }
      break;
    }

    case 'setMealPlan': {
      if (!config[index]) break;
      const plan = action.mealPlan === 'cp' ? 'cp' : 'ep';
      config[index].mealPlan = plan;
      toasts.push(
        toast('success', `Room ${index + 1}: Meal plan set to ${plan === 'cp' ? 'Breakfast Included' : 'Room Only'}`)
      );
      break;
    }

    case 'addRoom': {
      const maxAvailable = getMaxRoomsForMultiRoom(hotel, checkin, checkout);

      if (config.length >= maxAvailable) {
        toasts.push(toast('warning', `Maximum ${maxAvailable} rooms available for selected dates`));
        break;
      }
      if (config.length >= HARD_ROOM_CAP) {
        toasts.push(toast('warning', `Maximum ${HARD_ROOM_CAP} rooms allowed`));
        break;
      }
      if (types.length === 0) {
        toasts.push(toast('error', 'No room types available'));
        break;
      }

      const selectedCounts = {};
      config.forEach((room) => {
        selectedCounts[room.roomType] = (selectedCounts[room.roomType] || 0) + 1;
      });

      let selectedRoomType = null;
      for (const roomType of types) {
        const totalAvailable = getMaxAvailable(hotel, roomType, checkin, checkout);
        if ((selectedCounts[roomType] || 0) < totalAvailable) {
          selectedRoomType = roomType;
          break;
        }
      }

      if (!selectedRoomType) {
        let availabilityMessage = '';
        types.forEach((roomType) => {
          const totalAvailable = getMaxAvailable(hotel, roomType, checkin, checkout);
          if ((selectedCounts[roomType] || 0) >= totalAvailable && totalAvailable > 0) {
            availabilityMessage += `${roomType}: ${totalAvailable} available (all selected)\n`;
          }
        });
        toasts.push(toast('error', `No room types available. Please adjust existing rooms.\n${availabilityMessage}`));
        break;
      }

      const newRoomIndex = config.length;
      config.push({ roomType: selectedRoomType, adults: 1, childrenAbove6: 0, childrenBelow6: 0, mealPlan: 'ep', roomIndex: newRoomIndex });
      toasts.push(toast('success', `Added Room ${newRoomIndex + 1}: ${selectedRoomType}`));
      break;
    }

    case 'removeRoom': {
      if (config.length <= 1) {
        toasts.push(toast('warning', 'At least one room is required'));
        break;
      }
      const [removed] = config.splice(index, 1);
      config.forEach((r, i) => { r.roomIndex = i; });
      if (removed) toasts.push(toast('info', `Room ${index + 1} (${removed.roomType}) removed`));
      break;
    }

    default:
      break;
  }

  return { config, numRooms: config.length, view: multiView(hotel, checkin, checkout, config), toasts };
}

// ---------------------------------------------------------------------------
// Capacity upgrade suggestions
// ---------------------------------------------------------------------------
export function findUpgradeRooms(hotel, checkin, checkout, currentRoomType, totalAdultEquivalents, totalOccupants) {
  const current = capacity(hotel, currentRoomType, 'upgrade');
  const upgradeRooms = [];

  (hotel.roomTypes || []).forEach((roomType) => {
    if (roomType === currentRoomType) return;

    const { maxAdults, maxOccupants, detail } = capacity(hotel, roomType, 'upgrade');

    // Rule 1: strictly higher capacity in at least one dimension
    const hasHigherAdultCapacity = maxAdults > current.maxAdults;
    const hasHigherTotalCapacity = maxOccupants > current.maxOccupants;
    // Rule 2: must fit the requested occupancy
    const canFitAdults = maxAdults >= totalAdultEquivalents;
    const canFitOccupants = maxOccupants >= totalOccupants;

    if (!((hasHigherAdultCapacity || hasHigherTotalCapacity) && canFitAdults && canFitOccupants)) return;

    const singleEpRate = calculateRoomRate(hotel, roomType, checkin, checkout, 'ep', 1, 0, 0);
    const amenities = detail.amenities
      ? Array.isArray(detail.amenities) ? detail.amenities.join(', ') : detail.amenities
      : 'Standard amenities';

    const improvement = [];
    if (hasHigherAdultCapacity) {
      const d = maxAdults - current.maxAdults;
      improvement.push(`${d} more adult${d > 1 ? 's' : ''}`);
    }
    if (hasHigherTotalCapacity) {
      const d = maxOccupants - current.maxOccupants;
      improvement.push(`${d} more total occupant${d > 1 ? 's' : ''}`);
    }

    upgradeRooms.push({
      name: roomType,
      maxAdults,
      maxOccupants,
      singleEpRate,
      amenities: `${String(amenities).substring(0, 100)}...`,
      improvement: improvement.join(' and '),
      comparison: `${maxAdults} adults vs ${current.maxAdults} adults, ${maxOccupants} total vs ${current.maxOccupants} total`,
    });
  });

  return upgradeRooms.sort((a, b) => a.singleEpRate - b.singleEpRate);
}

/** Everything the "Room Capacity Exceeded" dialog needs. */
export function buildUpgradeView(hotel, checkin, checkout, roomType, category, occupancyIn) {
  const occupancy = cleanOccupancy(occupancyIn || DEFAULT_OCCUPANCY);
  const totalAdultEquivalents = occupancy.adults + occupancy.childrenAbove6;
  const totalOccupants = totalAdultEquivalents + occupancy.childrenBelow6;

  const upgradeRooms = findUpgradeRooms(
    hotel,
    checkin,
    checkout,
    roomType,
    totalAdultEquivalents + (category === 'adults' || category === 'childrenAbove6' ? 1 : 0),
    totalOccupants + (category === 'childrenBelow6' ? 1 : 0)
  );

  const adults = occupancy.adults + (category === 'adults' ? 1 : 0);
  const above = occupancy.childrenAbove6 + (category === 'childrenAbove6' ? 1 : 0);
  const below = occupancy.childrenBelow6 + (category === 'childrenBelow6' ? 1 : 0);

  return {
    title: 'Room Capacity Exceeded',
    roomType,
    groupSize: totalOccupants + (category === 'childrenBelow6' ? 1 : 0),
    group: { adults, childrenAbove6: above, childrenBelow6: below },
    upgradeRooms,
  };
}

// ---------------------------------------------------------------------------
// Selection ("Step 2. Book Now")
// ---------------------------------------------------------------------------
/**
 * Turn the (untrusted) selection sent by the browser into the canonical shape the
 * pricing / booking code works with. Guest totals and the representative nightly rate are
 * always recomputed here, never taken from the client.
 */
export function normalizeSelection(hotel, raw) {
  const checkin = raw.checkin;
  const checkout = raw.checkout;
  const nights = calculateNights(checkin, checkout);
  const isMulti = Array.isArray(raw.multiRoomConfig) && raw.multiRoomConfig.length > 1;

  if (isMulti) {
    const rooms = cleanMultiConfig(raw.multiRoomConfig);
    const totals = rooms.reduce(
      (t, r) => ({
        adults: t.adults + r.adults,
        childrenAbove6: t.childrenAbove6 + r.childrenAbove6,
        childrenBelow6: t.childrenBelow6 + r.childrenBelow6,
      }),
      { adults: 0, childrenAbove6: 0, childrenBelow6: 0 }
    );
    const totalRoomRates = rooms.reduce(
      (sum, r) => sum + calculateRoomRate(hotel, r.roomType, checkin, checkout, r.mealPlan, r.adults, r.childrenAbove6, r.childrenBelow6),
      0
    );
    return {
      hotelId: hotel.id,
      hotelName: hotel.name,
      checkin,
      checkout,
      nights,
      isMulti: true,
      roomType: rooms[0].roomType,
      numRooms: rooms.length,
      mealPlan: rooms[0].mealPlan,
      occupancy: null,
      multiRoomConfig: rooms,
      totals,
      rate: Math.round(totalRoomRates / rooms.length), // average nightly rate
    };
  }

  const occupancy = cleanOccupancy(raw.occupancy || DEFAULT_OCCUPANCY);
  const numRooms = Math.min(Math.max(1, toInt(raw.numRooms, 1)), 50);
  const mealPlan = raw.mealPlan === 'cp' ? 'cp' : 'ep';

  return {
    hotelId: hotel.id,
    hotelName: hotel.name,
    checkin,
    checkout,
    nights,
    isMulti: false,
    roomType: raw.roomType,
    numRooms,
    mealPlan,
    occupancy,
    multiRoomConfig: [],
    totals: {
      adults: occupancy.adults * numRooms,
      childrenAbove6: occupancy.childrenAbove6 * numRooms,
      childrenBelow6: occupancy.childrenBelow6 * numRooms,
    },
    rate: calculateRoomRate(hotel, raw.roomType, checkin, checkout, mealPlan, occupancy.adults, occupancy.childrenAbove6, occupancy.childrenBelow6),
  };
}

/** Everything the original selectRoomWithEnhancedSummary() checked before opening the guest page. */
export function validateSelection(hotel, raw) {
  const refresh = true; // tell the browser to reload the rooms page (availability changed)
  const fail = (toasts, opts = {}) => ({ ok: false, toasts, ...opts });
  const { checkin, checkout } = raw;
  const isMulti = Array.isArray(raw.multiRoomConfig) && raw.multiRoomConfig.length > 1;

  if (!(hotel.roomTypes || []).includes(raw.roomType) && !isMulti) {
    return fail([toast('error', 'Room type not found')]);
  }

  if (isMulti) {
    const rooms = cleanMultiConfig(raw.multiRoomConfig);
    if (rooms.some((r) => !(hotel.roomTypes || []).includes(r.roomType))) {
      return fail([toast('error', 'Room type not found')]);
    }

    const maxAvailableRooms = getMaxRoomsForMultiRoom(hotel, checkin, checkout);
    if (rooms.length > maxAvailableRooms) {
      return fail([toast('error', `Only ${maxAvailableRooms} total rooms available for selected dates`)]);
    }

    const errors = [];
    const counts = {};
    rooms.forEach((room, index) => {
      const { maxAdults, maxOccupants } = capacity(hotel, room.roomType, 'rules');
      const totalOccupants = room.adults + room.childrenAbove6 + room.childrenBelow6;

      if (room.adults > maxAdults) {
        errors.push(toast('error', `Room ${index + 1}: Maximum ${maxAdults} adults allowed in ${room.roomType}`));
        return;
      }
      if (totalOccupants > maxOccupants) {
        errors.push(toast('error', `Room ${index + 1}: Maximum ${maxOccupants} total guests allowed in ${room.roomType}`));
        return;
      }
      counts[room.roomType] = (counts[room.roomType] || 0) + 1;
    });

    if (errors.length > 0) {
      return fail([...errors, toast('error', 'Please adjust room configurations to fit capacity limits')]);
    }

    for (const [roomType, count] of Object.entries(counts)) {
      const available = getMaxAvailable(hotel, roomType, checkin, checkout);
      if (available < count) {
        return fail(
          [
            toast('error', `Only ${available} ${roomType} rooms available for selected dates`),
            toast('error', 'Not enough rooms available for selected configuration'),
          ],
          { refresh }
        );
      }
    }
  } else {
    const occupancy = cleanOccupancy(raw.occupancy || DEFAULT_OCCUPANCY);
    const numRooms = Math.min(Math.max(1, toInt(raw.numRooms, 1)), 50);
    const { maxAdults, maxOccupants } = capacity(hotel, raw.roomType, 'rules');

    if (occupancy.adults < 1) return fail([toast('error', 'Please select at least 1 adult per room')]);
    if (occupancy.adults > maxAdults) {
      return fail([toast('error', `Maximum ${maxAdults} adults allowed per ${raw.roomType}`)]);
    }
    const perRoom = occupancy.adults + occupancy.childrenAbove6 + occupancy.childrenBelow6;
    if (perRoom > maxOccupants) {
      return fail([toast('error', `Maximum ${maxOccupants} total guests allowed per ${raw.roomType}`)]);
    }

    const currentAvailability = getMaxAvailable(hotel, raw.roomType, checkin, checkout);
    if (currentAvailability < numRooms) {
      return fail(
        [toast('error', `Sorry, only ${currentAvailability} ${raw.roomType} room${currentAvailability !== 1 ? 's' : ''} available`)],
        { refresh }
      );
    }
  }

  const selection = normalizeSelection(hotel, raw);

  // success message with the meal plan summary (same wording as before)
  let mealPlanMessage;
  if (selection.isMulti) {
    const cp = selection.multiRoomConfig.filter((r) => r.mealPlan === 'cp').length;
    const ep = selection.multiRoomConfig.filter((r) => r.mealPlan === 'ep').length;
    mealPlanMessage = ` (${ep} Room Only, ${cp} Breakfast)`;
  } else {
    mealPlanMessage = selection.mealPlan === 'cp' ? ' (Breakfast Included)' : ' (Room Only)';
  }

  return {
    ok: true,
    selection,
    addons: hotel.addons || [],
    toasts: [toast('success', `Room selection confirmed!${mealPlanMessage}`)],
  };
}
