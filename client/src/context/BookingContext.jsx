import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from './ToastContext';
import { todayLocal, tomorrowLocal } from '../utils/format';

const BookingContext = createContext(null);

export const DEFAULT_OCCUPANCY = { adults: 1, childrenAbove6: 0, childrenBelow6: 0 };

const emptyForm = () => ({ checkin: '', checkout: '', location: '', mCheckin: '', mCheckout: '', mLocation: '' });
const emptyGuest = () => ({ name: '', email: '', phone: '', specialRequests: '' });

export function BookingProvider({ children }) {
  const toast = useToast();
  const navigate = useNavigate();

  // ------------------------------------------------------------------ search page state
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ location: '', price: '' });
  const [committed, setCommitted] = useState(null); // dates the results were searched with
  const [results, setResults] = useState({ status: 'idle', hotels: [], locations: [], error: '' });
  const initialized = useRef(false);

  // ------------------------------------------------------------------ booking flow state
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [roomsReloadKey, setRoomsReloadKey] = useState(0);
  const [mealPlans, setMealPlans] = useState({}); // per room type: 'ep' | 'cp'
  const [occupancyByRoomType, setOccupancyByRoomType] = useState({});
  const [multiRoomConfig, setMultiRoomConfig] = useState([]);
  const [selectedNumRooms, setSelectedNumRooms] = useState(1);
  const [summaryRoomType, setSummaryRoomType] = useState(null); // card that shows "N Rooms configured"
  const [selection, setSelection] = useState(null);
  const [hotelAddons, setHotelAddonsRaw] = useState([]);
  const setHotelAddons = useCallback((list) => setHotelAddonsRaw(Array.isArray(list) ? list : []), []);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [guest, setGuest] = useState(emptyGuest);
  const [paymentMethod, setPaymentMethod] = useState(''); // option that is ticked
  const [feeMethod, setFeeMethod] = useState(''); // option the guest actually clicked (drives the gateway fee)
  const [receipt, setReceipt] = useState(null); // { receiptToken, voucher }

  // ------------------------------------------------------------------ modals
  const [amenitiesModal, setAmenitiesModal] = useState({ open: false, amenities: [] });
  const [backModalOpen, setBackModalOpen] = useState(false);
  const [occupancyModal, setOccupancyModal] = useState({ open: false, roomType: null, numRooms: 1 });
  const [multiModalOpen, setMultiModalOpen] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState({ open: false, data: null });

  // ------------------------------------------------------------------ search
  const runSearch = useCallback(async (params, { commit = false } = {}) => {
    try {
      const data = await api.searchHotels(params);
      if (commit) setCommitted({ checkin: params.checkin, checkout: params.checkout });
      setResults({
        status: data.totalHotels === 0 ? 'empty' : 'ready',
        hotels: data.hotels,
        locations: data.locations,
        error: '',
      });
      return true;
    } catch (e) {
      // validation errors keep the previous results on screen
      setResults((r) => (r.status === 'idle' || r.status === 'loading'
        ? { ...r, status: e.status === 400 ? 'ready' : 'error', error: e.message }
        : r));
      if (e.status === 400) toast.show(e.message, 'error');
      else toast.show(`Error loading hotel data: ${e.message}`, 'error');
      return false;
    }
  }, [toast]);

  /** First visit: dates from the URL (?checkin=&checkout=) or today -> tomorrow. */
  const init = useCallback(async () => {
    if (initialized.current) return;
    initialized.current = true;

    const params = new URLSearchParams(window.location.search);
    const urlIn = params.get('checkin');
    const urlOut = params.get('checkout');
    const checkin = urlIn || todayLocal();
    const checkout = urlOut || tomorrowLocal();

    setForm({ checkin, checkout, location: '', mCheckin: checkin, mCheckout: checkout, mLocation: '' });
    setResults({ status: 'loading', hotels: [], locations: [], error: '' });
    await runSearch({ checkin, checkout, location: '', sidebarLocation: '', price: '' }, { commit: true });
  }, [runSearch]);

  const retryLoad = useCallback(async () => {
    initialized.current = false;
    await init();
  }, [init]);

  /** Re-render the list for the already searched dates (returning from the rooms page, retry...). */
  const refresh = useCallback(async (override = {}) => {
    const dates = committed || { checkin: form.checkin, checkout: form.checkout };
    return runSearch({
      ...dates,
      location: form.location,
      sidebarLocation: filters.location,
      price: filters.price,
      ...override,
    });
  }, [committed, form, filters, runSearch]);

  const searchFromForm = useCallback(async (source = 'desktop') => {
    let { checkin, checkout, location } = form;
    if (source === 'mobile') {
      checkin = form.mCheckin;
      checkout = form.mCheckout;
      location = form.mLocation;
      setForm((f) => ({ ...f, checkin, checkout, location }));
    }
    await runSearch(
      { checkin, checkout, location, sidebarLocation: filters.location, price: filters.price },
      { commit: true }
    );
  }, [form, filters, runSearch]);

  const applyFilters = useCallback(async (next) => {
    if (!committed) {
      toast.show('Please search with dates first', 'warning');
      return;
    }
    setFilters(next);
    await runSearch({ ...committed, location: form.location, sidebarLocation: next.location, price: next.price });
  }, [committed, form.location, runSearch, toast]);

  const clearAllFilters = useCallback(async () => {
    setForm((f) => ({ ...f, location: '', mLocation: '' }));
    setFilters({ location: '', price: '' });
    if (committed) {
      await runSearch({ ...committed, location: '', sidebarLocation: '', price: '' });
    }
  }, [committed, runSearch]);

  // ------------------------------------------------------------------ flow actions
  const resetSelections = useCallback(() => {
    setSelectedHotel(null);
    setSelection(null);
    setMultiRoomConfig([]);
    setSelectedNumRooms(1);
    setMealPlans({});
    setOccupancyByRoomType({});
    setSummaryRoomType(null);
    setSelectedAddons([]);
    setHotelAddons([]);
    setPaymentMethod('');
    setFeeMethod('');
  }, []);

  const selectHotel = useCallback(async (hotel) => {
    if (!committed) return;
    try {
      const data = await api.selectHotel({ hotelId: hotel.id, checkin: committed.checkin, checkout: committed.checkout });
      if (!data.ok) {
        toast.showAll(data.toasts);
        return;
      }
      resetSelections();
      setSelectedHotel(data.hotel);
      navigate('/rooms');
    } catch (e) {
      toast.show(e.message, 'error');
    }
  }, [committed, navigate, resetSelections, toast]);

  /** "Continue" in the Clear Selection dialog. */
  const confirmBackToHotels = useCallback(() => {
    setBackModalOpen(false);
    resetSelections();
    navigate('/');
  }, [navigate, resetSelections]);

  const newBooking = useCallback(() => {
    resetSelections();
    setGuest(emptyGuest());
    setReceipt(null);
    initialized.current = false; // reload hotels to get the latest availability
    navigate('/');
    toast.show('Start a new booking!', 'info');
  }, [navigate, resetSelections, toast]);

  const value = useMemo(() => ({
    form, setForm, filters, committed, results,
    init, retryLoad, refresh, searchFromForm, applyFilters, clearAllFilters,
    selectedHotel, selectHotel, roomsReloadKey,
    reloadRooms: () => setRoomsReloadKey((k) => k + 1),
    mealPlans, setMealPlan: (roomType, plan) => setMealPlans((m) => ({ ...m, [roomType]: plan })),
    occupancyByRoomType,
    setOccupancy: (roomType, occ) => setOccupancyByRoomType((o) => ({ ...o, [roomType]: occ })),
    multiRoomConfig, setMultiRoomConfig,
    selectedNumRooms, setSelectedNumRooms,
    summaryRoomType, setSummaryRoomType,
    selection, setSelection, hotelAddons, setHotelAddons,
    selectedAddons, setSelectedAddons,
    guest, setGuest,
    paymentMethod, setPaymentMethod, feeMethod, setFeeMethod,
    receipt, setReceipt,
    amenitiesModal, setAmenitiesModal,
    backModalOpen, setBackModalOpen, confirmBackToHotels,
    occupancyModal, setOccupancyModal,
    multiModalOpen, setMultiModalOpen,
    upgradeModal, setUpgradeModal,
    newBooking,
  }), [form, filters, committed, results, init, retryLoad, refresh, searchFromForm, applyFilters, clearAllFilters,
    selectedHotel, selectHotel, roomsReloadKey, mealPlans, occupancyByRoomType, multiRoomConfig,
    selectedNumRooms, summaryRoomType, selection, hotelAddons, selectedAddons, guest, paymentMethod,
    feeMethod, receipt, amenitiesModal, backModalOpen, confirmBackToHotels, occupancyModal,
    multiModalOpen, upgradeModal, newBooking]);

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export const useBooking = () => useContext(BookingContext);
