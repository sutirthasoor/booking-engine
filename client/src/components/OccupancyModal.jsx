import { useEffect, useState } from 'react';
import { useBooking } from '../context/BookingContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import { css } from '../utils/css';
import useBodyLock from './useBodyLock';

const selectStyle = css('width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;');
const labelStyle = css('display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 8px;');

/** "Step 1. Fill Up Occupancy (Guests Per Room)" dialog. All capacity rules come from the server. */
export default function OccupancyModal() {
  const b = useBooking();
  const toast = useToast();
  const { occupancyModal, setOccupancyModal, selectedHotel } = b;
  const { open, roomType, numRooms } = occupancyModal;
  const [state, setState] = useState(null); // { rooms, view }
  useBodyLock(open);

  useEffect(() => {
    if (!open) { setState(null); return; }
    let alive = true;
    api.occupancyInit({
      hotelId: selectedHotel.id, roomType, numRooms, base: b.occupancyByRoomType[roomType],
    }).then((d) => alive && setState(d)).catch((e) => toast.show(e.message, 'error'));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roomType, numRooms]);

  const close = () => setOccupancyModal({ open: false, roomType: null, numRooms: 1 });

  const change = async (index, field, value) => {
    try {
      const d = await api.occupancyUpdate({ hotelId: selectedHotel.id, roomType, rooms: state.rooms, index, field, value });
      setState(d);
    } catch (e) { toast.show(e.message, 'error'); }
  };

  const apply = async () => {
    try {
      const res = await api.occupancyApply({ roomType, rooms: state.rooms, mealPlan: b.mealPlans[roomType] || 'ep' });
      if (res.mode === 'single') {
        b.setOccupancy(roomType, res.occupancy);
        b.setMultiRoomConfig([]);
        b.setSummaryRoomType(null);
      } else {
        b.setMultiRoomConfig(res.multiRoomConfig);
        b.setSelectedNumRooms(res.multiRoomConfig.length);
        b.setSummaryRoomType(roomType);
      }
      close();
      toast.showAll(res.toasts);
    } catch (e) { toast.show(e.message, 'error'); }
  };

  const view = state?.view;

  return (
    <div id="room-occupancy-modal" className={`multi-room-modal${open ? ' active' : ''}`}>
      <div className="multi-room-modal-content" style={css('max-width: 800px;')}>
        <div className="multi-room-modal-header">
          <h3 className="multi-room-modal-title">Configure Room Occupancy</h3>
          <button className="amenities-close-btn" onClick={close}><i className="fas fa-times" /></button>
        </div>

        <div id="occupancy-modal-body" style={css('max-height: 60vh; overflow-y: auto; padding: 10px;')}>
          {state && state.rooms.map((room, i) => {
            const d = view.rooms[i];
            return (
              <div key={i} className="room-config-card"
                style={css(`border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: ${i % 2 === 0 ? '#f9fafb' : 'white'};`)}>
                <div style={css('display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;')}>
                  <h4 style={css('font-weight: 600; color: #1f2937;')}>Room {i + 1}</h4>
                  <span style={css('font-size: 12px; color: #6b7280;')}>Max: {view.maxAdults} adults, {view.maxOccupants} total</span>
                </div>

                <div style={css('display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;')}>
                  <div>
                    <label style={labelStyle}>Adults</label>
                    <select id={`room-${i}-adults`} value={room.adults} style={selectStyle}
                      onChange={(e) => change(i, 'adults', e.target.value)}>
                      {d.adultsOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Children (6+)</label>
                    <select id={`room-${i}-children-above`} value={room.childrenAbove6} style={selectStyle}
                      onChange={(e) => change(i, 'childrenAbove6', e.target.value)}>
                      {d.childrenAbove6Options.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <div style={css('font-size: 11px; color: #6b7280; margin-top: 4px;')}>Max: {d.maxChildrenAbove6Possible}</div>
                  </div>
                  <div>
                    <label style={labelStyle}>Children (&lt;6)</label>
                    <select id={`room-${i}-children-below`} value={room.childrenBelow6} style={selectStyle}
                      onChange={(e) => change(i, 'childrenBelow6', e.target.value)}>
                      {d.childrenBelow6Options.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <div style={css('font-size: 11px; color: #6b7280; margin-top: 4px;')}>Max: {d.maxChildrenBelow6Possible}</div>
                  </div>
                </div>

                <div style={css('margin-top: 12px; padding-top: 12px; border-top: 1px dashed #e5e7eb;')}>
                  <div style={css('display: flex; justify-content: space-between; font-size: 14px;')}>
                    <span>Total guests:</span>
                    <span className="font-semibold" id={`room-${i}-total`}>{d.totalGuests}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="multi-room-summary" style={css('margin-top: 20px;')}>
          <div className="summary-grid" style={css('grid-template-columns: repeat(3, 1fr);')}>
            <div className="summary-item">
              <div className="summary-label">Total Adults</div>
              <div className="summary-value" id="modal-total-adults">{view?.totals.adults ?? 0}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Children (6+)</div>
              <div className="summary-value" id="modal-total-children-above">{view?.totals.childrenAbove6 ?? 0}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Children (&lt;6)</div>
              <div className="summary-value" id="modal-total-children-below">{view?.totals.childrenBelow6 ?? 0}</div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={close} className="flex-1 py-3 px-6 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={apply} disabled={!state} className="flex-1 py-3 px-6 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition">
            <i className="fas fa-check mr-2" />
            Apply Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
