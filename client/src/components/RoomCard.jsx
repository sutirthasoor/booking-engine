import { useEffect, useRef, useState } from 'react';
import { useBooking, DEFAULT_OCCUPANCY } from '../context/BookingContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import { css } from '../utils/css';
import { slug } from '../utils/format';

const FALLBACK = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=250&fit=crop';

const mealBtn = (active) =>
  css(`flex: 1; padding: 10px 12px; border-radius: 4px; cursor: pointer; text-align: center; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 6px; ${
    active ? 'border: 2px solid #3b82f6; background: #eff6ff; color: #1d4ed8; font-weight: 600;' : 'border: 1px solid #d1d5db; background: white; color: #4b5563;'}`);

export default function RoomCard({ room, offerBanner, onBooked }) {
  const b = useBooking();
  const toast = useToast();
  const { roomType, isAvailable, maxRooms } = room;
  const id = slug(roomType);

  const mealPlan = b.mealPlans[roomType] || 'ep';
  const occupancy = b.occupancyByRoomType[roomType] || DEFAULT_OCCUPANCY;
  const isDefaultOcc = occupancy.adults === 1 && occupancy.childrenAbove6 === 0 && occupancy.childrenBelow6 === 0;

  const [roomCount, setRoomCount] = useState(1);
  const [rate, setRate] = useState(null); // null -> use the preloaded single rates
  const rateReq = useRef(0);

  // price shown on the card follows meal plan + configured occupancy (computed by the server)
  useEffect(() => {
    if (isDefaultOcc) { setRate(null); return; }
    const req = ++rateReq.current;
    api.roomRate({ hotelId: b.selectedHotel.id, roomType, ...b.committed, mealPlan, occupancy })
      .then((d) => { if (req === rateReq.current) setRate(d.rate); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealPlan, occupancy.adults, occupancy.childrenAbove6, occupancy.childrenBelow6]);

  const shownRate = rate ?? (mealPlan === 'cp' ? room.singleCpRate : room.singleEpRate);

  const changeMealPlan = (plan) => {
    b.setMealPlan(roomType, plan);
    toast.show(`Meal plan changed to ${plan === 'cp' ? 'Breakfast Included (CP)' : 'Room Only (EP)'}`, 'success');
  };

  const openOccupancy = () => b.setOccupancyModal({ open: true, roomType, numRooms: roomCount });

  const bookNow = async () => {
    if (!isAvailable) return;
    try {
      const res = await api.selectRoom({
        hotelId: b.selectedHotel.id,
        ...b.committed,
        roomType,
        numRooms: roomCount,
        mealPlan,
        occupancy,
        multiRoomConfig: b.multiRoomConfig,
      });
      toast.showAll(res.toasts);
      if (!res.ok) {
        if (res.refresh) b.reloadRooms();
        return;
      }
      b.setSelection(res.selection);
      b.setHotelAddons(res.addons);
      b.setSelectedAddons([]);
      onBooked();
    } catch (e) {
      toast.show(e.message, 'error');
    }
  };

  const photos = room.photos.slice(0, 3);
  const amenities = room.amenities;
  const showSummary = b.summaryRoomType === roomType && b.multiRoomConfig.length > 1;
  const cfg = b.multiRoomConfig;
  const tAdults = cfg.reduce((s, r) => s + r.adults, 0);
  const tAbove = cfg.reduce((s, r) => s + r.childrenAbove6, 0);
  const tBelow = cfg.reduce((s, r) => s + r.childrenBelow6, 0);

  return (
    <div
      className="room-card-container" data-room-type={roomType}
      style={css('border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px; padding: 16px; background: white;')}
    >
      {/* Room Name & Price - Top Row */}
      <div className="room-header" style={css('display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #f3f4f6;')}>
        <div>
          <h2 className="room-name" style={css('font-size: 20px; font-weight: 600; color: #1f2937; margin: 0;')}>{roomType}</h2>
          <div className="occupancy-rules" style={css('display: flex; gap: 16px; align-items: center; margin-top: 8px; flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px;')}>
            {[
              ['fa-user-friends', `Max ${room.maxAdults} Adults`],
              ['fa-users', `Max ${room.maxOccupants} Total`],
              ['fa-child', `Child age: ${room.childAgeLimit}+`],
            ].map(([icon, label]) => (
              <span key={icon} style={css('display: flex; align-items: center; gap: 4px; font-size: 13px; color: #6b7280; white-space: nowrap;')}>
                <i className={`fas ${icon}`} style={css('color: #4b5563;')} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="price-info" style={css('text-align: right;')}>
          <div className="price-display" style={css('display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px;')}>
            <span className="current-price" id={`room-rate-${id}`} style={css('font-size: 28px; font-weight: 700; color: #1f2937;')}>
              ₹{shownRate}
            </span>
            <span className="price-period" style={css('font-size: 14px; color: #6b7280;')}>per night</span>
          </div>
        </div>
      </div>

      {/* Main Content Row */}
      <div className="room-main-content" style={css('display: grid; grid-template-columns: 300px 1fr; gap: 24px;')}>
        <div className="room-carousel-section" style={css('height: 100%;')}>
          <div className="room-photo-carousel auto-rotate" style={css('position: relative; height: 200px; overflow: hidden; border-radius: 6px;')}>
            <div className="carousel-inner" style={css('display: flex; width: 100%; height: 100%;')}>
              {photos.map((photo, i) => (
                <div className="carousel-item" key={i} style={css('min-width: 100%; height: 100%; flex-shrink: 0;')}>
                  <img
                    src={photo} alt={`Room photo ${i + 1}`} loading="lazy"
                    style={css('width: 100%; height: 100%; object-fit: cover;')}
                    onError={(e) => { e.currentTarget.src = FALLBACK; }}
                  />
                </div>
              ))}
            </div>
            {room.photos.length > 1 && (
              <div className="carousel-indicators" style={css('position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; z-index: 10;')}>
                {photos.map((_, i) => (
                  <div key={i} className="carousel-indicator"
                    style={css(`width: 8px; height: 8px; border-radius: 50%; background: ${i === 0 ? '#3b82f6' : 'rgba(255,255,255,0.5)'}; cursor: pointer;`)} />
                ))}
              </div>
            )}
          </div>

          <div className="amenities-section" style={css('margin-top: 16px;')}>
            <div className="amenities-preview" style={css('display: flex; flex-wrap: wrap; gap: 8px;')}>
              {amenities.slice(0, 4).map((a) => (
                <span key={a} className="amenity-tag" style={css('background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #4b5563;')}>{a}</span>
              ))}
              {amenities.length > 4 && (
                <button
                  className="view-more-btn"
                  onClick={() => b.setAmenitiesModal({ open: true, amenities })}
                  style={css('background: none; border: none; color: #3b82f6; font-size: 12px; cursor: pointer; padding: 4px 8px;')}
                >
                  +{amenities.length - 4} more
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Controls */}
        <div className="room-controls-section" style={css('display: flex; flex-direction: column; height: 100%;')}>
          <div className="controls-section" style={css('flex: 1;')}>
            <div className="meal-plan-selector-box" style={css('margin-bottom: 20px;')}>
              <div className="section-title" style={css('font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px;')}>
                <i className="fas fa-utensils" style={css('margin-right: 8px;')} />Meal Plan
              </div>
              <div className="meal-plan-buttons" style={css('display: flex; gap: 8px;')}>
                <button className="meal-plan-btn" data-plan="ep" onClick={() => changeMealPlan('ep')} style={mealBtn(mealPlan === 'ep')}>
                  <span>Room Only (EP)</span>
                  {mealPlan === 'ep' && <i className="fas fa-check" style={css('color: #1d4ed8;')} />}
                </button>
                <button className="meal-plan-btn" data-plan="cp" onClick={() => changeMealPlan('cp')} style={mealBtn(mealPlan === 'cp')}>
                  <span>Breakfast (CP)</span>
                  {mealPlan === 'cp' && <i className="fas fa-check" style={css('color: #1d4ed8;')} />}
                </button>
              </div>
            </div>

            <div className="rooms-selector-box" style={css('margin-bottom: 20px;')}>
              <div className="section-title" style={css('font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px;')}>
                <i className="fas fa-door-closed" style={css('margin-right: 8px;')} />Number of Rooms
              </div>
              <select
                id={`room-count-${id}`} disabled={!isAvailable} value={roomCount}
                onChange={(e) => setRoomCount(parseInt(e.target.value, 10))}
                style={css('width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; background: white;')}
              >
                {Array.from({ length: Math.min(maxRooms, 20) }, (_, i) => (
                  <option key={i} value={i + 1}>{i + 1} Room{i > 0 ? 's' : ''}</option>
                ))}
                {maxRooms === 0 && <option value="0">Not available</option>}
              </select>
            </div>

            {offerBanner && (
              <div className="special-offer" style={css('padding: 12px; background: linear-gradient(to right, #fef3c7, #fef9c3); border: 1px solid #fcd34d; border-radius: 6px; margin-bottom: 20px;')}>
                <div style={css('display: flex; align-items: center; gap: 8px;')}>
                  <i className="fas fa-gift" style={css('color: #d97706;')} />
                  <span style={css('font-size: 14px; color: #92400e; font-weight: 500;')}>{offerBanner}</span>
                </div>
              </div>
            )}

            <div
              id={`room-summary-${id}`} className="selected-rooms-summary"
              style={css(`display: ${showSummary ? 'block' : 'none'}; margin-bottom: 20px; padding: 12px; background: #f0f9ff; border: 1px solid #dbeafe; border-radius: 6px;`)}
            >
              <div style={css('display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;')}>
                <span style={css('font-weight: 600; color: #0369a1;')}>
                  <i className="fas fa-info-circle mr-2" />Room Configuration
                </span>
                <button onClick={openOccupancy} style={css('background: none; border: none; color: #2563eb; font-size: 12px; cursor: pointer; text-decoration: underline;')}>
                  Edit
                </button>
              </div>
              <div id={`room-config-summary-${id}`} style={css('font-size: 13px; color: #1f2937;')}>
                {showSummary && (
                  <>
                    <div><strong>{cfg.length} Rooms</strong> configured</div>
                    <div style={css('margin-top: 8px; font-size: 12px;')}>
                      <span className="inline-block mr-4"><i className="fas fa-user text-blue-600 mr-1" />{tAdults} adults</span>
                      {tAbove > 0 && <span className="inline-block mr-4"><i className="fas fa-child text-green-600 mr-1" />{tAbove} children (6+)</span>}
                      {tBelow > 0 && <span className="inline-block"><i className="fas fa-baby text-pink-600 mr-1" />{tBelow} children (&lt;6)</span>}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="action-buttons-row" style={css('display: flex;gap: 12px;margin-top: auto;flex-direction: column;')}>
            <button
              onClick={openOccupancy} disabled={!isAvailable}
              style={css(`flex: 1; background: ${isAvailable ? '#3b82f6' : '#9ca3af'}; color: white; padding: 12px 16px; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: ${isAvailable ? 'pointer' : 'not-allowed'}; display: flex; align-items: center; justify-content: center; gap: 8px;`)}
            >
              <i className="fas fa-users" />
              Step 1. Fill Up Occupancy (Guests Per Room)
            </button>

            <button
              onClick={bookNow} className="book-now-btn" disabled={!isAvailable}
              style={css(`flex: 0.8; background: ${isAvailable ? '#10b981' : '#9ca3af'}; color: white; padding: 12px 24px; border: none; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: ${isAvailable ? 'pointer' : 'not-allowed'}; display: flex; align-items: center; justify-content: center; gap: 8px;`)}
            >
              <i className="fas fa-check-circle" />
              Step 2. Book Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
