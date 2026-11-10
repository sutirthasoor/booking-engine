import { css } from '../utils/css';
import { money } from '../utils/format';

const row = 'display: flex; justify-content: space-between; margin-bottom: 8px;';

/** Charges shown on the payment page (original #detailed-payment-breakdown). */
export default function PaymentBreakdown({ quote }) {
  const c = quote.charges;
  const single = !quote.selection.isMulti;
  return (
    <>
      <div style={css(row)}>
        <span style={css('color: #6b7280;')}>Room Charges:</span>
        <span style={css('font-weight: 500;')}>₹{money(c.roomCharges)}</span>
      </div>

      {quote.extraPersons > 0 && (
        <div style={css(row)}>
          <span style={css('color: #6b7280;')}>
            Extra Persons ({quote.extraPersons}{single ? ` × ₹${quote.extraAdultRate}/night` : ''}):
          </span>
          <span style={css('font-weight: 500;')}>₹{money(c.extraPersonCharges)}</span>
        </div>
      )}

      {c.addonsCharges > 0 && (
        <>
          <div style={css(row)}>
            <span style={css('color: #6b7280;')}>Additional Services:</span>
            <span style={css('font-weight: 500;')}>₹{money(c.addonsCharges)}</span>
          </div>
          {quote.addonLines.map((a, i) => (
            <div key={i} style={css('display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; color: #9ca3af; padding-left: 12px;')}>
              <span>{a.name}</span>
              <span>₹{a.price}</span>
            </div>
          ))}
        </>
      )}

      {c.offerDiscount > 0 && (
        <div style={css(`${row} color: #10b981;`)}>
          <span>Special Offers Discount:</span>
          <span style={css('font-weight: 600;')}>-₹{money(c.offerDiscount)}</span>
        </div>
      )}

      <div style={css(row)}>
        <span style={css('color: #6b7280;')}>Tax:</span>
        <span style={css('font-weight: 500;')}>₹{money(c.taxAmount)}</span>
      </div>

      {c.convenienceFee > 0 && (
        <div style={css(`${row} font-size: 13px;`)}>
          <span style={css('color: #6b7280;')}>Payment Gateway Charges:</span>
          <span style={css('color: #1f2937;')}>₹{money(c.convenienceFee)}</span>
        </div>
      )}
    </>
  );
}
