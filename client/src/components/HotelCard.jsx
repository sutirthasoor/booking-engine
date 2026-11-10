import { useState } from 'react';
import { useBooking } from '../context/BookingContext';
import { useToast } from '../context/ToastContext';
import { css } from '../utils/css';

const FALLBACK = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=250&fit=crop';

function HotelCarousel({ hotel }) {
  const [index, setIndex] = useState(0);
  const photos = hotel.photos;
  return (
    <div className="hotel-carousel auto-rotate" style={css('height: 260px; min-height: 260px;')}>
      <div
        className="hotel-carousel-inner"
        style={{ ...css('height: 260px; min-height: 260px;'), transform: `translateX(-${index * 100}%)` }}
      >
        {photos.map((photo, i) => (
          <div className="hotel-carousel-item" key={i} style={css('height: 260px; min-height: 260px;')}>
            <img
              src={photo} loading="lazy" alt={`${hotel.name} - Image ${i + 1}`}
              className="w-full h-full object-cover" style={css('height: 260px; min-height: 260px;')}
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK; }}
            />
          </div>
        ))}
      </div>
      {photos.length > 1 && (
        <div className="hotel-carousel-indicators">
          {photos.map((_, i) => (
            <button
              key={i} className={`hotel-carousel-indicator${i === index ? ' active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setIndex(i); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HotelCard({ hotel }) {
  const { selectHotel } = useBooking();
  const toast = useToast();
  const available = hotel.hasAvailableRooms;
  const rooms = hotel.availableRooms;

  const onCardClick = () => {
    if (available) selectHotel(hotel);
    else toast.show('No rooms available for selected dates. Please try different dates.', 'warning');
  };

  return (
    <div
      className="hotel-card bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 mb-6 cursor-pointer"
      onClick={onCardClick}
    >
      <div className="flex">
        <div className="w-1/3 min-w-[120px] relative">
          <HotelCarousel hotel={hotel} />
        </div>

        <div className="w-2/3 p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 mb-1">{hotel.name}</h3>
              <div className="flex items-center text-gray-600 text-sm mb-2">
                <i className="fas fa-map-marker-alt mr-2 text-gray-400" />
                <span>{hotel.location || 'City Center'}</span>
              </div>
            </div>

            <div className="text-right ml-4">
              <div className="mb-1">
                <div className="text-sm font-bold text-green-600 mb-1" />
                <div className="text-xs text-gray-700 font-medium">
                  {available ? 'Best Price Guaranteed!' : 'Check other dates'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs ${available ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'} px-2 py-1 rounded`}>
              <i className={`fas ${available ? 'fa-check' : 'fa-times'} mr-1`} />
              {available ? `${rooms} room${rooms !== 1 ? 's' : ''} available` : 'No rooms available'}
            </span>
            {hotel.roomTypeCount > 0 && (
              <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                <i className="fas fa-bed mr-1" />
                {hotel.roomTypeCount} room type{hotel.roomTypeCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
            {available ? (
              <button
                onClick={(e) => { e.stopPropagation(); selectHotel(hotel); }}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-2.5 px-5 rounded-lg transition-all duration-200 shadow hover:shadow-lg text-sm flex items-center"
              >
                <i className="fas fa-bolt mr-2" />
                Book Now
              </button>
            ) : (
              <button className="bg-gray-400 text-white font-semibold py-2.5 px-5 rounded-lg cursor-not-allowed text-sm flex items-center" disabled>
                <i className="fas fa-times mr-2" />
                Not Available
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
