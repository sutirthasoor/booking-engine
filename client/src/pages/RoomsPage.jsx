import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useBooking } from '../context/BookingContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import RoomCard from '../components/RoomCard';
import { css } from '../utils/css';

function RoomSkeleton() {
  return (
    <div className="room-card-container animate-pulse">
      <div className="room-card-grid">
        <div className="room-photo-carousel bg-gray-200" />
        <div className="room-info-section">
          <div className="room-header">
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-4" />
          </div>
          <div className="occupancy-section bg-gray-100">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
            <div className="occupancy-grid">
              <div className="text-center">
                <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mb-2" />
                <div className="flex justify-center gap-2">
                  <div className="w-8 h-8 bg-gray-300 rounded-full" />
                  <div className="w-8 h-8 bg-gray-300 rounded-full" />
                  <div className="w-8 h-8 bg-gray-300 rounded-full" />
                </div>
              </div>
            </div>
          </div>
          <div className="room-pricing">
            <div className="price-section">
              <div className="h-8 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-32" />
            </div>
            <div className="h-10 bg-gray-300 rounded w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Page 2 - choose room type, meal plan, occupancy (original #rooms-section). */
export default function RoomsPage() {
  const b = useBooking();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  const hotel = b.selectedHotel;
  const dates = b.committed;

  useEffect(() => {
    if (!hotel || !dates) return undefined;
    let alive = true;
    setData(null);
    api.getRooms(hotel.id, dates.checkin, dates.checkout)
      .then((d) => alive && setData(d))
      .catch((e) => { toast.show(e.message, 'error'); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotel?.id, b.roomsReloadKey]);

  if (!hotel || !dates) return <Navigate to="/" replace />;

  return (
    <div id="rooms-section">
      <div className="flex items-center mb-6">
        <button onClick={() => b.setBackModalOpen(true)} className="flex items-center text-blue-600 hover:text-blue-800 mr-4">
          <i className="fas fa-arrow-left mr-2" />Back to Hotels
        </button>
        <h2 className="text-xl font-bold text-gray-800">Select Your Room</h2>
      </div>

      <button
        onClick={() => b.setMultiModalOpen(true)}
        className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-5 rounded-lg transition-all duration-200 shadow hover:shadow-lg flex items-center gap-2"
      >
        <span>Select Multiple Rooms Types</span>
        <span id="multi-room-badge" className="bg-white text-green-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold ml-1" style={css('display: none;')}>0</span>
      </button>

      <div id="rooms-container" style={css('margin-top:100px;')}>
        {!data && Array.from({ length: hotel.roomTypeCount || 1 }, (_, i) => <RoomSkeleton key={i} />)}
        {data && data.rooms.map((room) => (
          <RoomCard
            key={room.roomType}
            room={room}
            offerBanner={data.offerBanner}
            onBooked={() => navigate('/guest-details')}
          />
        ))}
      </div>
    </div>
  );
}
