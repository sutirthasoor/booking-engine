import { useEffect } from 'react';
import { useBooking } from '../context/BookingContext';
import HotelCard from '../components/HotelCard';
import { css } from '../utils/css';

/** Page 1 - search results (original #hotels-section). */
export default function HotelsPage() {
  const { init, retryLoad, refresh, results } = useBooking();

  useEffect(() => {
    // first visit: load; coming back from another page: re-render for the searched dates
    if (results.status === 'idle') init();
    else refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { status, hotels, error } = results;

  return (
    <div id="hotels-section">
      <div className="flex justify-between items-center mb-6" style={css('width: 400px; margin-left: -13px;')}>
        <h2 className="text-xl font-bold text-gray-900">
          List Of Hotels. &nbsp;&nbsp;
          <span style={css('color:#16a34a; font-weight:600; font-size:16px;')}>Enter Dates To Get Availability</span>
        </h2>
      </div>

      <div id="hotels-container" className="space-y-6">
        {(status === 'idle' || status === 'loading') && (
          <div className="text-center py-12">
            <div className="loading-spinner mb-4" />
            <p className="text-gray-500 text-lg">Loading hotels...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-12">
            <i className="fas fa-exclamation-triangle text-red-300 text-6xl mb-4" />
            <p className="text-gray-500 text-lg">Failed to load hotels</p>
            <p className="text-gray-400 text-sm mt-2">{error}</p>
            <button onClick={retryLoad} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
              Retry Loading
            </button>
          </div>
        )}

        {status === 'empty' && (
          <div className="text-center py-12">
            <i className="fas fa-hotel text-gray-300 text-6xl mb-4" />
            <p className="text-gray-500 text-lg">No hotels found in database</p>
            <p className="text-gray-400 text-sm mt-2">Please add hotels to your Supabase database</p>
          </div>
        )}

        {status === 'ready' && hotels.length === 0 && (
          <div className="text-center py-12">
            <i className="fas fa-hotel text-gray-300 text-6xl mb-4" />
            <p className="text-gray-500 text-lg">Loading</p>
          </div>
        )}

        {status === 'ready' && hotels.map((h) => <HotelCard key={h.id} hotel={h} />)}
      </div>
    </div>
  );
}
