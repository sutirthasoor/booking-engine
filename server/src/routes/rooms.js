import { Router } from 'express';
import { asyncHandler, assertValidDates, ok, refuse } from '../utils/http.js';
import { getFullHotel } from '../services/hotelService.js';
import {
  buildUpgradeView,
  multiInit,
  multiUpdate,
  occupancyApply,
  occupancyInit,
  occupancyUpdate,
  roomRateFor,
  validateSelection,
} from '../services/roomService.js';

const router = Router();

router.post('/rate', asyncHandler(async (req, res) => {
  const { hotelId, roomType, checkin, checkout, mealPlan, occupancy } = req.body || {};
  assertValidDates(checkin, checkout);
  const hotel = await getFullHotel(hotelId);
  ok(res, { rate: roomRateFor(hotel, roomType, checkin, checkout, mealPlan, occupancy) });
}));

// --- single room-type occupancy dialog ---
router.post('/occupancy/init', asyncHandler(async (req, res) => {
  const { hotelId, roomType, numRooms, base } = req.body || {};
  const hotel = await getFullHotel(hotelId);
  ok(res, occupancyInit(hotel, roomType, numRooms, base));
}));

router.post('/occupancy/update', asyncHandler(async (req, res) => {
  const { hotelId, roomType, rooms, index, field, value } = req.body || {};
  const hotel = await getFullHotel(hotelId);
  ok(res, occupancyUpdate(hotel, roomType, rooms, index, field, value));
}));

router.post('/occupancy/apply', asyncHandler(async (req, res) => {
  const { roomType, rooms, mealPlan } = req.body || {};
  ok(res, occupancyApply(roomType, rooms, mealPlan));
}));

// --- multi room dialog ---
router.post('/multi/init', asyncHandler(async (req, res) => {
  const { hotelId, checkin, checkout, config, numRooms } = req.body || {};
  assertValidDates(checkin, checkout);
  const hotel = await getFullHotel(hotelId);
  const result = multiInit(hotel, checkin, checkout, config, numRooms);
  if (!result.ok) return refuse(res, result.toasts);
  ok(res, result);
}));

router.post('/multi/update', asyncHandler(async (req, res) => {
  const { hotelId, checkin, checkout, config, action } = req.body || {};
  assertValidDates(checkin, checkout);
  const hotel = await getFullHotel(hotelId);
  ok(res, multiUpdate(hotel, checkin, checkout, config, action || {}));
}));

// --- capacity upgrade suggestions ---
router.post('/upgrade', asyncHandler(async (req, res) => {
  const { hotelId, checkin, checkout, roomType, category, occupancy } = req.body || {};
  assertValidDates(checkin, checkout);
  const hotel = await getFullHotel(hotelId);
  ok(res, { upgrade: buildUpgradeView(hotel, checkin, checkout, roomType, category, occupancy) });
}));

// --- "Step 2. Book Now" ---
router.post('/select', asyncHandler(async (req, res) => {
  const selection = req.body?.selection || {};
  assertValidDates(selection.checkin, selection.checkout);
  const hotel = await getFullHotel(selection.hotelId, { fresh: true });
  const result = validateSelection(hotel, selection);
  if (!result.ok) return refuse(res, result.toasts, { refresh: !!result.refresh });
  ok(res, { selection: result.selection, addons: result.addons, toasts: result.toasts });
}));

export default router;
