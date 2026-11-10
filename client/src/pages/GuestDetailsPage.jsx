import { Navigate, useNavigate } from 'react-router-dom';
import { useBooking } from '../context/BookingContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import useQuote from '../components/useQuote';
import GuestBreakdown from '../components/GuestBreakdown';
import FocusField from '../components/FocusField';
import { css } from '../utils/css';
import { money } from '../utils/format';

const label = 'display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;';
const star = <span style={css('color: #ef4444;')}> *</span>;

/** Page 3 - booking summary, add-ons and contact details (original #guest-section). */
export default function GuestDetailsPage() {
  const b = useBooking();
  const toast = useToast();
  const navigate = useNavigate();
  const { selection, selectedAddons, guest, setGuest } = b;
  const hotelAddons = Array.isArray(b.hotelAddons) ? b.hotelAddons : [];
  const quote = useQuote(selection, selectedAddons);

  if (!selection) return <Navigate to="/" replace />;

  const set = (patch) => setGuest((g) => ({ ...g, ...patch }));

  const toggleAddon = (index) =>
    b.setSelectedAddons((list) => (list.includes(index) ? list.filter((i) => i !== index) : [...list, index]));

  const continueToPayment = async () => {
    try {
      const res = await api.validateGuest(guest);
      if (!res.ok) { toast.showAll(res.toasts); return; }
      setGuest(res.guest);
      b.setPaymentMethod('');
      b.setFeeMethod('');
      navigate('/payment');
    } catch (e) { toast.show(e.message, 'error'); }
  };

  const s = quote?.summary;

  return (
    <div id="guest-section">
      <div style={css('background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); padding: 24px;')}>
        <div style={css('display: flex; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;')}>
          <button onClick={() => navigate('/rooms')} style={css('display: flex; align-items: center; color: #1976d2; background: none; border: none; cursor: pointer; margin-right: 16px;')}>
            <i className="fas fa-arrow-left" style={css('margin-right: 8px;')} />Back
          </button>
          <h2 style={css('font-size: 20px; font-weight: 700; color: #1f2937; margin: 0;')}>Guest Details</h2>
        </div>

        <div style={css('display: grid; grid-template-columns: 1fr 1fr; gap: 24px;')}>
          {/* Left Column: Booking Summary */}
          <div>
            <div style={css('display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;')}>
              <h3 style={css('font-size: 16px; font-weight: 600; color: #374151;')}>Booking Summary</h3>
              <div style={css('background: #f0f9ff; color: #0369a1; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500;')}>
                Booking ID: <span id="summary-booking-id">{s?.previewBookingId}</span>
              </div>
            </div>

            <div style={css('background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;')}>
              <div style={css('margin-bottom: 16px;')}>
                <div style={css('display: flex; align-items: start; margin-bottom: 8px;')}>
                  <i className="fas fa-hotel" style={css('color: #6b7280; margin-right: 12px; margin-top: 2px; width: 16px;')} />
                  <div style={css('flex: 1;')}>
                    <div style={css('font-weight: 600; color: #1f2937; margin-bottom: 2px;')} id="summary-hotel">{s?.hotelName}</div>
                    <div style={css('font-size: 13px; color: #6b7280;')}>
                      <span id="summary-room">{s?.guestRoomText}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={css('display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;')}>
                <div>
                  <div style={css('font-size: 12px; color: #6b7280; margin-bottom: 4px;')}>Dates</div>
                  <div style={css('font-weight: 500; color: #1f2937;')} id="summary-dates">{s?.guestDatesText}</div>
                </div>
                <div>
                  <div style={css('font-size: 12px; color: #6b7280; margin-bottom: 4px;')}>Guests</div>
                  <div style={css('font-weight: 500; color: #1f2937;')} id="summary-guests">{s?.guestGuestsText}</div>
                </div>
              </div>

              <div style={css('border-top: 1px solid #e5e7eb; padding-top: 16px;')}>
                <div id="guest-detailed-breakdown" style={css('font-size: 14px;')}>
                  {quote && <GuestBreakdown quote={quote} />}
                </div>

                <div style={css('display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 16px; border-top: 2px solid #e5e7eb;')}>
                  <span style={css('font-size: 16px; font-weight: 600; color: #1f2937;')}>Total Amount</span>
                  <span style={css('font-size: 24px; font-weight: 700; color: #059669;')} id="summary-total">
                    {quote && `₹${money(quote.charges.totalAmount)}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Add-ons */}
            <div>
              <h3 style={css('font-size: 16px; font-weight: 600; color: #374151; margin-bottom: 16px;')}>Add Extra Services</h3>
              <div id="addons-container" style={css('display: grid; gap: 8px;')}>
                {hotelAddons.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No additional services available</p>
                )}
                {hotelAddons.map((addon, index) => (
                  <div
                    key={index}
                    className={`addon-item${selectedAddons.includes(index) ? ' selected' : ''}`}
                    onClick={() => toggleAddon(index)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold">{addon.name}</h4>
                        <p className="text-sm text-gray-600">{addon.description || ''}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">₹{addon.price}</div>
                        <div className="text-xs text-gray-500">{String(addon.type || '').replace('_', ' ')}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Guest Form */}
          <div>
            <div style={css('margin-bottom: 24px;')}>
              <h3 style={css('font-size: 16px; font-weight: 600; color: #374151; margin-bottom: 16px;')}>
                <i className="fas fa-user-circle" style={css('margin-right: 8px;')} />Contact Information
              </h3>

              <div style={css('display: grid; gap: 16px;')}>
                <div>
                  <label style={css(label)}>Full Name{star}</label>
                  <FocusField type="text" id="guest-name" placeholder="Enter your full name" required
                    value={guest.name} onChange={(e) => set({ name: e.target.value })} />
                </div>
                <div>
                  <label style={css(label)}>Email Address{star}</label>
                  <FocusField type="email" id="guest-email" placeholder="your.email@example.com" required
                    value={guest.email} onChange={(e) => set({ email: e.target.value })} />
                </div>
                <div>
                  <label style={css(label)}>Phone Number{star}</label>
                  <FocusField type="tel" id="guest-phone" placeholder="10-digit mobile number" required
                    value={guest.phone} onChange={(e) => set({ phone: e.target.value })} />
                </div>
              </div>
            </div>

            <div>
              <h3 style={css('font-size: 16px; font-weight: 600; color: #374151; margin-bottom: 12px;')}>
                <i className="fas fa-sticky-note" style={css('margin-right: 8px;')} />Special Requests (Optional)
              </h3>
              <FocusField as="textarea" id="special-requests"
                extraStyle="min-height: 100px; resize: vertical;"
                placeholder="Early check-in, extra bed, dietary requirements, etc."
                value={guest.specialRequests} onChange={(e) => set({ specialRequests: e.target.value })} />
            </div>

            <button
              onClick={continueToPayment}
              style={css('width: 100%; background: linear-gradient(to right, #059669, #047857); color: white; padding: 16px; border: none; border-radius: 12px; font-weight: 600; font-size: 16px; margin-top: 32px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;')}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(5, 150, 105, 0.3)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <i className="fas fa-arrow-right" />
              Continue to Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
