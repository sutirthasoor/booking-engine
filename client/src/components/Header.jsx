import { useRef } from 'react';
import { useBooking } from '../context/BookingContext';
import { todayLocal } from '../utils/format';
import { css } from '../utils/css';

/** Full search header (shown on the hotel list page). */
export default function Header() {
  const b = useBooking();
  const { form, setForm, results } = b;
  const checkinRef = useRef(null);
  const checkoutRef = useRef(null);
  const min = todayLocal();
  const locations = results.locations;

  const openPicker = (ref) => ref.current?.showPicker?.();
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  return (
    <header className="bg-orange shadow-sm" style={css('background-color:orange;')}>
      <div className="container mx-auto px-4 py-3">
        {/* Mobile-first layout */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center space-x-2 mb-2 sm:mb-0" style={css('margin-left:100px;')}>
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
              <img src="https://i.ibb.co/bgwV3S3J/download.png" className="w-20 h-10" alt="K" />
            </div>
            <h1 className="text-xl font-bold text-gray-800">
              <span className="text-orange-500" style={css('color:white;')}>Kakkson</span>
              <span className="text-gray-600" style={css('color:white;')}> Hotels</span>
            </h1>
          </div>

          {/* Desktop: Search Form + Room Selector */}
          <div className="hidden sm:block flex-1 min-w-0">
            <div className="flex items-center gap-4">
              {/* Form Fields */}
              <div className="flex-1 flex gap-2">
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-medium text-gray-700 mb-1" style={css('color:white;')}>Destination</label>
                  <select
                    id="location-search"
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm h-10"
                    value={form.location}
                    onChange={(e) => set({ location: e.target.value })}
                  >
                    <option value="">All Locations</option>
                    {locations.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-0 relative">
                  <label className="block text-xs font-medium text-gray-700 mb-1" style={css('color:white;')}>Check-in</label>
                  <div className="relative">
                    <input
                      type="date" id="checkin" ref={checkinRef}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm h-10 pr-8"
                      min={min} value={form.checkin} onChange={(e) => set({ checkin: e.target.value })}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-black-400 hover:text-black-600"
                      onClick={() => openPicker(checkinRef)}
                    >
                      <i className="fas fa-calendar-alt" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 min-w-0 relative">
                  <label className="block text-xs font-medium text-gray-700 mb-1" style={css('color:white;')}>Check-out</label>
                  <div className="relative">
                    <input
                      type="date" id="checkout" ref={checkoutRef}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm h-10 pr-8"
                      value={form.checkout} onChange={(e) => set({ checkout: e.target.value })}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-black-400 hover:text-black-600"
                      onClick={() => openPicker(checkoutRef)}
                    >
                      <i className="fas fa-calendar-alt" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Room Selector (Desktop) - hidden in the original as well */}
              <div className="flex flex-col items-center min-w-[100px]" style={css('display: none;')}>
                <label className="block text-xs font-medium text-gray-700 mb-1" style={css('color:white;')}>Multiple Families</label>
                <div className="flex items-center space-x-2">
                  <button
                    id="decrease-rooms"
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                    style={css('background-color:white;')}
                    onClick={() => b.setSelectedNumRooms((n) => Math.max(1, n - 1))}
                  >
                    <i className="fas fa-minus text-gray-600 text-sm" />
                  </button>
                  <span id="room-count" className="w-8 text-center font-semibold text-gray-800 text-base" style={css('color:white;')}>
                    {b.selectedNumRooms}
                  </span>
                  <button
                    id="increase-rooms"
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                    style={css('background-color:white;')}
                    onClick={() => b.setSelectedNumRooms((n) => n + 1)}
                  >
                    <i className="fas fa-plus text-gray-600 text-sm" />
                  </button>
                </div>
                <div id="room-config-info" className="text-xs text-blue-600 mt-1 hidden">
                  <i className="fas fa-cog" /> Configured
                </div>
              </div>

              {/* Search Button */}
              <div className="flex flex-col justify-end">
                <button
                  onClick={() => b.searchFromForm('desktop')}
                  className="bg-white text-black px-4 py-2 rounded-lg font-semibold h-10 flex items-center justify-center flex-shrink-0 transition-all hover:shadow-md"
                  title="Search Hotels"
                >
                  <i className="fas fa-search" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Search Form (visibility handled by the stylesheet's media queries) */}
        <div id="mobile-search-form" className="mt-4 bg-white p-4 rounded-lg shadow-md">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
              <select
                id="mobile-location-search"
                className="w-full p-3 border border-gray-300 rounded-lg text-base"
                value={form.mLocation}
                onChange={(e) => set({ mLocation: e.target.value })}
              >
                <option value="">All Locations</option>
                {locations.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-in</label>
                <input
                  type="date" id="mobile-checkin"
                  className="w-full p-3 border border-gray-300 rounded-lg text-base"
                  min={min} value={form.mCheckin} onChange={(e) => set({ mCheckin: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-out</label>
                <input
                  type="date" id="mobile-checkout"
                  className="w-full p-3 border border-gray-300 rounded-lg text-base"
                  value={form.mCheckout} onChange={(e) => set({ mCheckout: e.target.value })}
                />
              </div>
            </div>

            <button
              onClick={() => b.searchFromForm('mobile')}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-3 rounded-lg font-semibold text-base mt-2 hover:from-orange-600 hover:to-orange-700 transition-all"
            >
              <i className="fas fa-search mr-2" />
              Search Hotels
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
