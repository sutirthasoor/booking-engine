import { useBooking } from '../context/BookingContext';
import useBodyLock from './useBodyLock';

export default function BackToHotelsModal() {
  const { backModalOpen, setBackModalOpen, confirmBackToHotels, selectedHotel, selection } = useBooking();
  useBodyLock(backModalOpen);

  const sel = selection;
  const adults = sel?.totals.adults ?? 1;
  const above = sel?.totals.childrenAbove6 ?? 0;
  const below = sel?.totals.childrenBelow6 ?? 0;

  return (
    <div id="back-to-hotels-modal" className={`back-to-hotels-modal${backModalOpen ? ' active' : ''}`}>
      <div className="back-to-hotels-modal-content">
        <div className="back-to-hotels-modal-header">
          <div className="warning-icon"><i className="fas fa-exclamation-triangle" /></div>
          <div>
            <h2>Clear Selection?</h2>
            <p>Your current selection will be lost</p>
          </div>
        </div>

        <div className="back-to-hotels-modal-body">
          <div className="selection-details">
            <p>Going back to hotels will clear:</p>
            {selectedHotel && (
              <div className="detail-item"><span>Selected Hotel:</span><strong>{selectedHotel.name}</strong></div>
            )}
            {sel?.roomType && (
              <div className="detail-item"><span>Room Type:</span><strong>{sel.roomType}</strong></div>
            )}
            {sel && sel.numRooms > 1 && (
              <div className="detail-item"><span>Number of Rooms:</span><strong>{sel.numRooms}</strong></div>
            )}
            {(adults > 1 || above > 0 || below > 0) && (
              <div className="detail-item">
                <span>Guest Configuration:</span>
                <strong>
                  {adults} adult{adults > 1 ? 's' : ''}
                  {above > 0 ? `, ${above} child${above > 1 ? 'ren' : ''} 6+` : ''}
                  {below > 0 ? `, ${below} child${below > 1 ? 'ren' : ''} <6` : ''}
                </strong>
              </div>
            )}
          </div>
        </div>

        <div className="back-to-hotels-modal-actions">
          <button onClick={() => setBackModalOpen(false)} className="cancel-btn">Cancel</button>
          <button onClick={confirmBackToHotels} className="confirm-btn">Continue</button>
        </div>
      </div>
    </div>
  );
}
