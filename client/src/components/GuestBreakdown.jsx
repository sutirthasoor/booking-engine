import { css } from '../utils/css';
import { money } from '../utils/format';

/** Detailed charges shown on the guest-details page (original #guest-detailed-breakdown). */
export default function GuestBreakdown({ quote }) {
  const c = quote.charges;
  return (
    <div style={css('display: grid; gap: 12px; font-size: 14px;')}>
      {quote.rows.map((room) => {
        const cp = room.mealPlan === 'cp';
        const color = cp ? '#f97316' : '#1976d2';
        return (
          <div key={room.roomNumber} style={css('background: #f9fafb; border-radius: 8px; padding: 12px; margin-bottom: 8px;')}>
            <div style={css('display: flex; justify-content: space-between; margin-bottom: 6px;')}>
              <span style={css('font-weight: 500; color: #374151;')}>
                {room.roomNumber > 1 ? `Room ${room.roomNumber}: ` : ''}{room.roomType}
                <span style={{ ...css('margin-left: 8px; font-size: 12px; padding: 2px 8px; border-radius: 12px;'), background: `${color}20`, color }}>
                  <i className={`fas ${cp ? 'fa-utensils' : 'fa-bed'} mr-1`} />
                  {cp ? 'CP' : 'EP'}
                </span>
              </span>
              <span style={css('font-weight: 500; color: #059669;')}>₹{money(room.roomCharges)}</span>
            </div>

            <div style={css('font-size: 12px; color: #6b7280; margin-left: 8px;')}>
              {room.extraPersonCharge > 0 && (
                <div style={css('color: #dc2626; margin-bottom: 4px;')}>
                  <i className="fas fa-user-plus mr-1" />
                  Extra person{room.extraAdultEquivalents > 1 ? 's' : ''}: ₹{money(room.extraPersonCharge)} ({room.extraAdultEquivalents} × ₹{room.extraAdultRate}/night)
                </div>
              )}
              <div style={css('margin-top: 6px; padding-top: 6px; border-top: 1px solid #e5e7eb; font-weight: 500;')}>
                Room total: ₹{money(room.roomCharges)}
              </div>
            </div>
          </div>
        );
      })}

      <div style={css('background: #f0f9ff; border-radius: 8px; padding: 12px; margin: 12px 0;')}>
        <div style={css('display: flex; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid #dbeafe;')}>
          <span style={css('color: #0369a1; font-weight: 500;')}>Base Room Charges</span>
          <span style={css('font-weight: 600; color: #0369a1;')}>₹{money(c.baseRoomCharges)}</span>
        </div>

        {c.extraPersonCharges > 0 && (
          <div style={css('display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dbeafe;')}>
            <span style={css('color: #6b7280;')}>Extra Person Charges</span>
            <span style={css('font-weight: 500; color: #1f2937;')}>₹{money(c.extraPersonCharges)}</span>
          </div>
        )}

        {c.mealPlanSurcharge > 0 && (
          <div style={css('display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dbeafe;')}>
            <span style={css('color: #f97316; font-weight: 500;')}>
              <i className="fas fa-utensils mr-1" />
              Breakfast Surcharge ({quote.cpRooms} rooms)
            </span>
            <span style={css('font-weight: 600; color: #f97316;')}>₹{money(c.mealPlanSurcharge)}</span>
          </div>
        )}

        <div style={css('display: flex; justify-content: space-between; padding-top: 8px; font-weight: 600; color: #1f2937;')}>
          <span>Subtotal</span>
          <span>₹{money(c.roomCharges)}</span>
        </div>
      </div>

      {c.addonsCharges > 0 && (
        <div style={css('display: flex; justify-content: space-between;')}>
          <span style={css('color: #6b7280;')}>Additional Services</span>
          <span style={css('font-weight: 500; color: #1f2937;')}>₹{money(c.addonsCharges)}</span>
        </div>
      )}

      {c.offerDiscount > 0 && (
        <div style={css('display: flex; justify-content: space-between; color: #10b981;')}>
          <span>Special Offers Discount</span>
          <span style={css('font-weight: 600;')}>-₹{money(c.offerDiscount)}</span>
        </div>
      )}

      <div style={css('display: flex; justify-content: space-between;')}>
        <span style={css('color: #6b7280;')}>Taxes &amp; Fees ({Math.round(quote.taxRate * 100)}%)</span>
        <span style={css('font-weight: 600; color: #1f2937;')}>₹{money(c.taxAmount)}</span>
      </div>

      {c.convenienceFee > 0 && (
        <div style={css('display: flex; justify-content: space-between; font-size: 13px;')}>
          <span style={css('color: #6b7280;')}>Payment Gateway Charges</span>
          <span style={css('color: #1f2937;')}>₹{money(c.convenienceFee)}</span>
        </div>
      )}
    </div>
  );
}
