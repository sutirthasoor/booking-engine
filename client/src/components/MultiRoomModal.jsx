import { useEffect, useState } from 'react';
import { useBooking } from '../context/BookingContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import useBodyLock from './useBodyLock';

/** "Configure Rooms & Occupancy" dialog (several room types in one booking). */
export default function MultiRoomModal() {
  const b = useBooking();
  const toast = useToast();
  const { multiModalOpen, setMultiModalOpen, selectedHotel, committed } = b;
  const [view, setView] = useState(null);
  useBodyLock(multiModalOpen);

  const base = { hotelId: selectedHotel?.id, ...committed };

  const accept = (res) => {
    b.setMultiRoomConfig(res.config); // edits persist even if the dialog is cancelled (as before)
    b.setSelectedNumRooms(res.numRooms);
    setView(res.view);
    toast.showAll(res.toasts);
  };

  useEffect(() => {
    if (!multiModalOpen) { setView(null); return; }
    let alive = true;
    api.multiInit({ ...base, config: b.multiRoomConfig, numRooms: b.selectedNumRooms })
      .then((res) => {
        if (!alive) return;
        if (!res.ok) { toast.showAll(res.toasts); setMultiModalOpen(false); return; }
        accept(res);
      })
      .catch((e) => { toast.show(e.message, 'error'); setMultiModalOpen(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiModalOpen]);

  const act = async (action) => {
    try {
      accept(await api.multiUpdate({ ...base, config: b.multiRoomConfig, action }));
    } catch (e) { toast.show(e.message, 'error'); }
  };

  const config = b.multiRoomConfig;
  const close = () => setMultiModalOpen(false);

  return (
    <div id="multi-room-modal" className={`multi-room-modal${multiModalOpen ? ' active' : ''}`}>
      <div className="multi-room-modal-content">
        <div className="multi-room-modal-header">
          <h3 className="multi-room-modal-title">Configure Rooms &amp; Occupancy</h3>
          <button className="amenities-close-btn" onClick={close}><i className="fas fa-times" /></button>
        </div>

        <div className="overflow-x-auto">
          <table className="room-config-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th style={{ minWidth: 200 }}>Room Type</th>
                <th style={{ minWidth: 120 }}>Adults</th>
                <th style={{ minWidth: 140 }}>Children (6+ years)</th>
                <th style={{ minWidth: 140 }}>Children (&lt;6 years)</th>
                <th style={{ minWidth: 150 }}>Meal Plan</th>
                <th style={{ minWidth: 120 }}>Total Guests</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody id="multi-room-config-body">
              {view && (
                <>
                  <tr>
                    <td colSpan={8} className="bg-blue-50 text-blue-800 text-sm p-3 border-b">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <i className="fas fa-hotel mr-2" />
                          <span>Configure {config.length} room{config.length > 1 ? 's' : ''} for {view.hotelName}</span>
                        </div>
                        <div className="text-xs font-medium">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">Max {view.maxAvailable} rooms available</span>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {config.map((room, index) => {
                    const row = view.rows[index];
                    if (!row) return null;
                    const cp = room.mealPlan === 'cp';
                    return (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td data-label="Room #" className="p-3 border">
                          <div className="font-bold text-lg text-center text-blue-700">{index + 1}</div>
                        </td>
                        <td data-label="Room Type" className="p-3 border">
                          <select
                            className="room-type-dropdown w-full p-2 border border-gray-300 rounded hover:border-blue-400 transition-colors"
                            value={room.roomType}
                            onChange={(e) => act({ type: 'setRoomType', index, roomType: e.target.value })}
                          >
                            {row.roomTypeOptions.map((o) => (
                              <option key={o.value} value={o.value} disabled={o.disabled}>{o.value}</option>
                            ))}
                          </select>
                          <div className="text-xs text-gray-500 mt-1">
                            <i className="fas fa-bed mr-1" />
                            Max: {row.maxAdults} adults, {row.maxOccupants} total
                          </div>
                        </td>
                        <td data-label="Adults" className="p-3 border">
                          <select
                            className="occupancy-dropdown adults w-full p-2 border border-gray-300 rounded hover:border-blue-400 transition-colors"
                            value={room.adults}
                            onChange={(e) => act({ type: 'setOccupancy', index, field: 'adults', value: e.target.value })}
                          >
                            {row.adultsOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>
                        <td data-label="Children (6+)" className="p-3 border">
                          <select
                            className="occupancy-dropdown children-above-6 w-full p-2 border border-gray-300 rounded hover:border-blue-400 transition-colors"
                            value={room.childrenAbove6}
                            onChange={(e) => act({ type: 'setOccupancy', index, field: 'childrenAbove6', value: e.target.value })}
                          >
                            {row.childrenAbove6Options.map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>
                        <td data-label="Children (<6)" className="p-3 border">
                          <select
                            className="occupancy-dropdown children-below-6 w-full p-2 border border-gray-300 rounded hover:border-blue-400 transition-colors"
                            value={room.childrenBelow6}
                            onChange={(e) => act({ type: 'setOccupancy', index, field: 'childrenBelow6', value: e.target.value })}
                          >
                            {row.childrenBelow6Options.map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>
                        <td data-label="Meal Plan" className="p-3 border">
                          <select
                            className="meal-plan-dropdown w-full p-2 border border-gray-300 rounded hover:border-blue-400 transition-colors"
                            value={room.mealPlan}
                            onChange={(e) => act({ type: 'setMealPlan', index, mealPlan: e.target.value })}
                          >
                            <option value="ep">Room Only (EP)</option>
                            <option value="cp">Breakfast Included (CP)</option>
                          </select>
                          <div className="text-xs mt-1">
                            <div className={cp ? 'text-orange-600 font-medium' : 'text-blue-600 font-medium'}>
                              <i className={`fas ${cp ? 'fa-utensils' : 'fa-bed'} mr-1`} />
                              {cp ? 'Breakfast Included' : 'Room Only'}
                            </div>
                            {cp && row.priceDifference > 0 && (
                              <div className="text-green-600 font-semibold mt-1">
                                +₹{row.priceDifference}/night
                                <div className="text-gray-500 text-xs">(+₹{row.totalDifference} total)</div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td data-label="Total Guests" className="p-3 border">
                          <div className="text-center">
                            <div className={`font-bold text-lg ${row.totalGuests > row.maxOccupants ? 'text-red-600' : 'text-green-600'}`}>
                              {row.totalGuests}
                            </div>
                            <div className={`text-xs text-gray-500 ${row.totalGuests > row.maxOccupants ? 'text-red-500' : ''}`}>
                              Max: {row.maxOccupants}
                            </div>
                          </div>
                        </td>
                        <td data-label="Action" className="p-3 border">
                          {config.length > 1 ? (
                            <button
                              className="remove-room-btn w-full bg-red-50 text-red-700 px-3 py-2 rounded text-sm hover:bg-red-100 transition-colors flex items-center justify-center"
                              onClick={() => act({ type: 'removeRoom', index })}
                            >
                              <i className="fas fa-trash mr-2" />
                              Remove
                            </button>
                          ) : (
                            <div className="text-center text-gray-400 text-sm">
                              <i className="fas fa-lock mr-1" />
                              Required
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>

        <div className="add-room-row">
          <button
            id="add-room-btn"
            className={`add-room-btn${view?.addRoom.disabled ? ' opacity-50 cursor-not-allowed' : ''}`}
            disabled={!view || view.addRoom.disabled}
            onClick={() => act({ type: 'addRoom' })}
          >
            <i className="fas fa-plus" />
            <span id="add-room-text">{view?.addRoom.text || 'Add Another Room'}</span>
            <span
              id="availability-count"
              className={view?.addRoom.badgeAvailable === false
                ? 'ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded'
                : 'ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded'}
            >
              {view?.addRoom.badge}
            </span>
          </button>
        </div>

        <div className="flex gap-3 mt-8">
          <button onClick={close} className="flex-1 py-3 px-6 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            id="apply-config-btn"
            onClick={() => { b.setSelectedNumRooms(config.length); close(); }}
            className="flex-1 py-3 px-6 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-check mr-2" />
            Apply Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
