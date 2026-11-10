import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useBooking } from '../context/BookingContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import useQuote from '../components/useQuote';
import PaymentBreakdown from '../components/PaymentBreakdown';
import { css } from '../utils/css';
import { money } from '../utils/format';

const methodCard = 'margin-bottom: 12px; padding: 16px; border: 2px solid #e5e7eb; border-radius: 12px; cursor: pointer; transition: all 0.2s;';
const hoverIn = (e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.backgroundColor = '#f8fafc'; };
const hoverOut = (e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = 'transparent'; };

const ONLINE_OPTIONS = [
  ['razorpay_card', 'Credit/Debit Card', 'Visa, Mastercard, RuPay, American Express'],
  ['razorpay_upi', 'UPI & Net Banking', 'Instant payment via UPI ID or Net Banking'],
  ['razorpay_wallet', 'Wallets', 'Paytm, PhonePe, MobiKwik, and more'],
];

const STATUS = {
  available: { cls: 'mb-6 p-4 bg-green-50 border border-green-200 rounded-lg', icon: 'fa-check-circle', title: 'Online Payments Available' },
  issue: { cls: 'mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg', icon: 'fa-exclamation-triangle', title: 'Payment Gateway Issue' },
  soon: { cls: 'mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg', icon: 'fa-clock', title: 'Payment Options Coming Soon' },
};

/** Page 4 - payment summary, method and Razorpay checkout (original #payment-section). */
export default function PaymentPage() {
  const b = useBooking();
  const toast = useToast();
  const navigate = useNavigate();
  const { selection, selectedAddons, guest, paymentMethod, selectedHotel } = b;
  const quote = useQuote(selection, selectedAddons, paymentMethod);
  const [config, setConfig] = useState(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!selectedHotel) return;
    api.getPaymentConfig(selectedHotel.id).then((d) => setConfig(d.paymentConfig)).catch((e) => toast.show(e.message, 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHotel?.id]);

  if (!selection || !selectedHotel) return <Navigate to="/" replace />;

  const select = (method) => {
    b.setPaymentMethod(method);
    b.setFeeMethod(method); // gateway fee is charged only for the option the guest clicked
  };

  const finalize = async (startToken, payment) => {
    try {
      const res = await api.confirmBooking({ startToken, payment });
      toast.showAll(res.toasts);
      b.setReceipt({ receiptToken: res.receiptToken, voucher: res.voucher, emailRequested: false });
      navigate('/confirmation');
    } catch (error) {
      toast.show(error.message, 'error');
    }
  };

  const processRazorpayPayment = async () => {
    toast.show('Creating secure payment...', 'info');
    const res = await api.startBooking({
      selection, addons: selectedAddons, guest, paymentMethod, feeMethod: b.feeMethod,
    });
    if (!res.ok) {
      toast.showAll(res.toasts);
      if (res.refresh) navigate('/rooms');
      return;
    }

    let done = false;
    const rzp = new window.Razorpay({
      ...res.razorpay,
      // the server verifies this proof of payment with Razorpay before confirming anything
      handler: async (payment) => {
        if (done) return;
        done = true;
        toast.show('Payment completed! Confirming booking...', 'success');
        await finalize(res.startToken, payment);
      },
      modal: {
        ondismiss: () => {
          if (!done) toast.show('Payment cancelled. You can try again.', 'info');
        },
      },
    });

    rzp.open();
  };

  const processPayment = async () => {
    if (!paymentMethod) { toast.show('Please select a payment method', 'error'); return; }
    if (paymentMethod === 'upi') {
      toast.show('UPI QR payments are coming soon. Please select another payment method.', 'error');
      return;
    }
    if (busy.current) return;
    busy.current = true;
    try {
      toast.show('Processing payment...', 'info');
      if (paymentMethod.startsWith('razorpay')) await processRazorpayPayment();
    } catch (error) {
      toast.show(`Payment failed: ${error.message}`, 'error');
    } finally {
      busy.current = false;
    }
  };

  const st = config ? STATUS[config.status] : null;
  const s = quote?.summary;
  const online = paymentMethod.startsWith('razorpay');

  return (
    <div id="payment-section">
      <div style={css('background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); padding: 24px;')}>
        <div style={css('display: flex; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;')}>
          <button onClick={() => navigate('/guest-details')} style={css('display: flex; align-items: center; color: #1976d2; background: none; border: none; cursor: pointer; margin-right: 16px;')}>
            <i className="fas fa-arrow-left" style={css('margin-right: 8px;')} />Back
          </button>
          <h2 style={css('font-size: 20px; font-weight: 700; color: #1f2937; margin: 0;')}>Payment Method</h2>
        </div>

        {/* Payment Configuration Status */}
        <div id="payment-config-status" className={st?.cls}
          style={css('margin-bottom: 24px; padding: 16px; background: #f0f9ff; border: 1px solid #dbeafe; border-radius: 12px;')}>
          <div style={css('display: flex; align-items: center;')}>
            <i className="fas fa-credit-card" style={css('color: #1d4ed8; margin-right: 12px; font-size: 18px;')} />
            <div style={css('flex: 1;')}>
              <h4 style={css('font-weight: 600; color: #1e40af; margin-bottom: 4px;')} id="config-status-title">
                {st ? (<><i className={`fas ${st.icon} mr-2`} />{st.title}</>) : 'Checking payment options...'}
              </h4>
              <p style={css('color: #3b82f6; font-size: 13px; margin: 0;')} id="config-status-desc">
                {!config && (<>We're checking available payment methods for <strong id="current-hotel-name">{selectedHotel.name}</strong></>)}
                {config?.status === 'available' && (<>All payment methods are available for <strong>{selectedHotel.name}</strong></>)}
                {config?.status === 'issue' && 'Online payments temporarily unavailable. UPI QR payments coming soon.'}
                {config?.status === 'soon' && (<>UPI QR payments coming soon for <strong>{selectedHotel.name}</strong></>)}
              </p>
            </div>
          </div>
        </div>

        {/* Convenience Fee Notice */}
        <div id="convenience-fee-notice"
          style={css(`display: ${online ? 'block' : 'none'}; margin-bottom: 24px; padding: 16px; background: #fef3c7; border: 1px solid #fbbf24; border-radius: 12px;`)}>
          <div style={css('display: flex; align-items: start;')}>
            <i className="fas fa-info-circle" style={css('color: #d97706; margin-right: 12px; margin-top: 2px;')} />
            <div style={css('flex: 1;')}>
              <h4 style={css('font-weight: 600; color: #92400e; font-size: 13px; margin-bottom: 4px;')}>Convenience Fee Applied</h4>
              <p style={css('color: #92400e; font-size: 12px; margin: 0;')}>
                A convenience fee of 2% + 18% GST is applied for online payments to cover payment gateway charges.
                No convenience fee for UPI QR code payments.
              </p>
            </div>
          </div>
        </div>

        <div style={css('display: grid; grid-template-columns: 1fr 1fr; gap: 24px;')}>
          {/* Left Column: Payment Summary */}
          <div>
            <h3 style={css('font-size: 16px; font-weight: 600; color: #374151; margin-bottom: 16px;')}>Payment Summary</h3>

            <div style={css('background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;')}>
              <div style={css('margin-bottom: 20px;')}>
                <div style={css('display: flex; align-items: start; margin-bottom: 12px;')}>
                  <i className="fas fa-hotel" style={css('color: #6b7280; margin-right: 12px; margin-top: 2px; width: 16px;')} />
                  <div style={css('flex: 1;')}>
                    <div style={css('font-weight: 600; color: #1f2937; margin-bottom: 2px;')} id="payment-summary-hotel">{s?.hotelName}</div>
                    <div style={css('font-size: 13px; color: #6b7280;')} id="payment-summary-room">{s?.paymentRoomText}</div>
                  </div>
                </div>

                <div style={css('display: grid; grid-template-columns: 1fr 1fr; gap: 12px;')}>
                  <div>
                    <div style={css('font-size: 12px; color: #6b7280; margin-bottom: 4px;')}>Dates</div>
                    <div style={css('font-weight: 500; color: #1f2937;')} id="payment-summary-dates">{s?.paymentDatesText}</div>
                  </div>
                  <div>
                    <div style={css('font-size: 12px; color: #6b7280; margin-bottom: 4px;')}>Guests</div>
                    <div style={css('font-weight: 500; color: #1f2937;')} id="payment-summary-guests">{s?.paymentGuestsText}</div>
                  </div>
                </div>
              </div>

              <div style={css('border-top: 1px solid #e5e7eb; padding-top: 16px;')}>
                <div id="detailed-payment-breakdown" style={css('font-size: 14px;')}>
                  {quote && <PaymentBreakdown quote={quote} />}
                </div>

                <div style={css('display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 16px; border-top: 2px solid #e5e7eb;')}>
                  <span style={css('font-size: 16px; font-weight: 600; color: #1f2937;')}>Total Amount</span>
                  <span style={css('font-size: 24px; font-weight: 700; color: #059669;')} id="payment-summary-total">
                    {quote && `₹${money(quote.charges.totalAmount)}`}
                  </span>
                </div>
              </div>
            </div>

            <div id="payment-gateway-info" style={css('padding: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px;')}>
              <div style={css('display: flex; align-items: start;')}>
                <i className="fas fa-shield-alt" style={css('color: #6b7280; margin-right: 12px; margin-top: 2px;')} />
                <div style={css('flex: 1;')}>
                  <h4 style={css('font-weight: 600; color: #374151; font-size: 13px; margin-bottom: 4px;')}>Secure Payment</h4>
                  <p style={css('color: #6b7280; font-size: 12px; margin: 0;')}>
                    All payments are secured and encrypted. Your financial information is never stored on our servers.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Payment Methods */}
          <div>
            <h3 style={css('font-size: 16px; font-weight: 600; color: #374151; margin-bottom: 16px;')}>Select Payment Method</h3>

            {/* UPI QR Payment - disabled (coming soon), still clickable like the original */}
            <div onClick={() => select('upi')}
              style={css('margin-bottom: 12px; padding: 16px; border: 2px solid #e5e7eb; border-radius: 12px; cursor: not-allowed; opacity: 0.6; background: #f9fafb;')}>
              <div style={css('display: flex; align-items: center;')}>
                <input type="radio" name="payment-method" value="upi" style={css('margin-right: 12px;')} disabled
                  checked={paymentMethod === 'upi'} readOnly />
                <div style={css('flex: 1;')}>
                  <div style={css('display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;')}>
                    <div>
                      <h4 style={css('font-weight: 600; color: #374151; margin-bottom: 2px;')}>UPI QR Code Payment</h4>
                      <p style={css('color: #6b7280; font-size: 13px; margin: 0;')}>Scan QR code to pay instantly - No convenience fee</p>
                    </div>
                    <div style={css('color: #059669; font-weight: 600; font-size: 14px;')}>No Extra Charges</div>
                  </div>
                  <div style={css('margin-top: 8px;')}>
                    <span style={css('background: #fef3c7; color: #92400e; font-size: 11px; padding: 4px 8px; border-radius: 4px; font-weight: 500;')}>Coming Soon</span>
                  </div>
                </div>
              </div>
              <div id="upi-qr-container" style={css(`display: ${paymentMethod === 'upi' ? 'block' : 'none'}; margin-top: 16px; text-align: center;`)}>
                <img id="hotel-qr-code" src={config?.qrCode || ''} alt="UPI QR Code" style={css('max-width: 200px; margin: 0 auto 12px; display: block;')} />
                <p style={css('color: #6b7280; font-size: 13px; margin-bottom: 8px;')}>Scan this QR code with any UPI app to pay</p>
                <div style={css('padding: 12px; background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px;')}>
                  <p style={css('font-weight: 600; font-size: 14px; color: #92400e; margin: 0;')}>
                    Amount to pay: ₹<span id="upi-amount">{quote ? money(quote.charges.totalAmount) : 0}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Razorpay Online Payment Options */}
            <div id="razorpay-options" style={{ display: config?.status === 'available' ? 'block' : 'none' }}>
              <div style={css('margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;')}>
                <h4 style={css('font-weight: 600; color: #374151; font-size: 15px; margin-bottom: 16px; display: flex; align-items: center;')}>
                  <i className="fas fa-lock" style={css('color: #059669; margin-right: 8px;')} />
                  Secure Online Payment
                </h4>

                {ONLINE_OPTIONS.map(([value, title, desc]) => (
                  <div key={value} onClick={() => select(value)} style={css(methodCard)} onMouseOver={hoverIn} onMouseOut={hoverOut}>
                    <div style={css('display: flex; align-items: center;')}>
                      <input type="radio" name="payment-method" value={value} style={css('margin-right: 12px;')}
                        checked={paymentMethod === value} onChange={() => select(value)} />
                      <div>
                        <h4 style={css('font-weight: 600; color: #374151; margin-bottom: 4px;')}>{title}</h4>
                        <p style={css('color: #6b7280; font-size: 13px; margin: 0;')}>{desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={processPayment}
              style={css('width: 100%; background: linear-gradient(to right, #059669, #047857); color: white; padding: 16px; border: none; border-radius: 12px; font-weight: 600; font-size: 16px; margin-top: 32px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;')}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(5, 150, 105, 0.3)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <i className="fas fa-lock" />
              Confirm Booking &amp; Pay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
