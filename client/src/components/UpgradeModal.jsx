import { useBooking } from '../context/BookingContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import { css } from '../utils/css';
import useBodyLock from './useBodyLock';

/**
 * Hook that opens the "Room Capacity Exceeded" dialog. The server decides which rooms are
 * valid upgrades. (As in the original page nothing in the current UI calls this yet - the
 * +/- guest buttons that used to trigger it are not rendered - but the dialog is wired up.)
 */
export function useUpgradeModal() {
  const { selectedHotel, committed, setUpgradeModal } = useBooking();
  const toast = useToast();
  return async (roomType, category, occupancy) => {
    try {
      const { upgrade } = await api.upgrade({
        hotelId: selectedHotel.id, ...committed, roomType, category, occupancy,
      });
      setUpgradeModal({ open: true, data: upgrade });
    } catch (e) {
      toast.show(e.message, 'error');
    }
  };
}

export default function UpgradeModal() {
  const { upgradeModal, setUpgradeModal } = useBooking();
  const toast = useToast();
  const { open, data } = upgradeModal;
  useBodyLock(open);

  const close = () => setUpgradeModal({ open: false, data: null });

  const selectUpgradeRoom = (roomType) => {
    close();
    const roomCard = document.querySelector(`[data-room-type="${roomType}"]`);
    if (roomCard) {
      roomCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      roomCard.style.border = '3px solid #1976d2';
      roomCard.style.boxShadow = '0 0 20px rgba(25, 118, 210, 0.5)';
      setTimeout(() => { roomCard.style.border = ''; roomCard.style.boxShadow = ''; }, 3000);
    }
    toast.show(`Please select ${roomType} for your group size`, 'info');
  };

  const g = data?.group;

  return (
    <div id="upgradeModal" className={`upgrade-modal${open ? ' active' : ''}`}>
      <div className="upgrade-modal-content">
        <div className="upgrade-modal-header">
          <h3 className="upgrade-modal-title" id="upgradeModalTitle">{data?.title || 'Room Upgrade Required'}</h3>
          <p className="upgrade-modal-message" id="upgradeModalMessage">
            {data ? (
              <span className="font-bold mt-4 mb-2 text-gray-700" style={{ display: 'block' }}>Available rooms with higher capacity:</span>
            ) : 'Your selected occupancy exceeds the current room capacity.'}
          </p>
        </div>

        <div id="upgradeRoomSuggestions">
          {data && data.upgradeRooms.length > 0 && data.upgradeRooms.map((room) => (
            <div key={room.name} className="room-upgrade-suggestion mt-3 p-4 bg-white border border-blue-300 rounded-lg shadow-sm">
              <h4 className="font-bold text-lg text-blue-700">{room.name}</h4>
              <div className="flex justify-between items-center mb-3">
                <div className="text-sm">
                  <div><strong>Capacity:</strong> {room.maxAdults} adults, {room.maxOccupants} total</div>
                  <div className="text-gray-500 text-xs">{room.comparison}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-blue-600 text-xl">₹{room.singleEpRate}/night</div>
                  <div className="text-sm text-gray-500">Per room, per night</div>
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded mb-3">
                <p className="text-sm text-green-700 font-semibold">
                  <i className="fas fa-check-circle mr-2" />
                  {room.improvement ? `Provides ${room.improvement} capacity` : 'Higher capacity room'}
                </p>
              </div>
              <div className="bg-blue-50 p-3 rounded mb-3">
                <p className="text-sm text-blue-700">
                  <i className="fas fa-users mr-2" />
                  Can accommodate your group of {data.groupSize} people ({g.adults} adult{g.adults > 1 ? 's' : ''}
                  {g.childrenAbove6 > 0 ? `, ${g.childrenAbove6} child${g.childrenAbove6 > 1 ? 'ren' : ''} 6+` : ''}
                  {g.childrenBelow6 > 0 ? `, ${g.childrenBelow6} child${g.childrenBelow6 > 1 ? 'ren' : ''} <6` : ''})
                </p>
              </div>
              <ul className="room-upgrade-features text-sm text-gray-600 mb-3">
                <li><i className="fas fa-check text-green-500 mr-2" />{room.amenities || 'Standard amenities'}</li>
              </ul>
              <button
                onClick={() => selectUpgradeRoom(room.name)}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md"
              >
                <i className="fas fa-arrow-right mr-2" />Upgrade to {room.name}
              </button>
            </div>
          ))}
          {data && data.upgradeRooms.length === 0 && (
            <div className="mt-3 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
              <div className="flex items-start">
                <i className="fas fa-exclamation-triangle text-yellow-500 text-xl mr-3 mt-1" />
                <div>
                  <h4 className="font-bold text-yellow-700">No suitable upgrade rooms found</h4>
                  <p className="text-yellow-600 text-sm mt-1">
                    Unfortunately, no other rooms in this hotel have higher capacity than "{data.roomType}".
                  </p>
                  <ul className="mt-2 text-sm text-yellow-700">
                    <li><i className="fas fa-lightbulb mr-2" />Try selecting fewer guests</li>
                    <li><i className="fas fa-hotel mr-2" />Try booking multiple rooms</li>
                    <li><i className="fas fa-search mr-2" />Try selecting a different hotel</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="upgrade-modal-actions">
          <button onClick={close} className="btn-secondary" style={css('flex: 1; padding: 12px; background: #6b7280; color: white; border-radius: 8px;')}>
            Adjust Occupancy
          </button>
          <button
            onClick={() => { close(); window.alert('Please check other room types with higher capacity.'); }}
            className="btn-primary" style={css('flex: 1; padding: 12px; background: #1976d2; color: white; border-radius: 8px;')}
          >
            View Upgrade Options
          </button>
        </div>
      </div>
    </div>
  );
}
