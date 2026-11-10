import { useEffect } from 'react';
import { useBooking } from '../context/BookingContext';
import useBodyLock from './useBodyLock';

export default function AmenitiesModal() {
  const { amenitiesModal, setAmenitiesModal } = useBooking();
  const { open, amenities } = amenitiesModal;
  const close = () => setAmenitiesModal({ open: false, amenities: [] });
  useBodyLock(open);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setAmenitiesModal((m) => ({ ...m, open: false })); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setAmenitiesModal]);

  return (
    <div id="amenities-modal" className={`amenities-modal${open ? ' active' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="amenities-modal-content">
        <div className="amenities-modal-header">
          <h3 className="amenities-modal-title" id="amenities-modal-title">Room Amenities</h3>
          <button className="amenities-close-btn" onClick={close}><i className="fas fa-times" /></button>
        </div>
        <div className="amenities-grid" id="amenities-list">
          {Array.isArray(amenities) && amenities.length > 0 ? amenities.map((a, i) => (
            <div className="amenity-item" key={`${a}-${i}`}>
              <div className="amenity-icon"><i className="fas fa-check" /></div>
              <span className="amenity-name">{a}</span>
            </div>
          )) : <p className="text-gray-500 text-center py-4">No amenities listed</p>}
        </div>
      </div>
    </div>
  );
}
