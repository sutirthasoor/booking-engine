const people = (adults, above, below) => (
  <>
    {adults} adult{adults > 1 ? 's' : ''}
    {above > 0 ? `, ${above} child${above > 1 ? 'ren' : ''} (6+)` : ''}
    {below > 0 ? `, ${below} child${below > 1 ? 'ren' : ''} (<6)` : ''}
  </>
);

const S = {
  card: {
    maxWidth: 440,
    margin: '0 auto',
    background: '#ffffff',
    color: '#111827',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontFamily: "'Inter', 'Segoe UI', Roboto, Arial, sans-serif",
    fontSize: 13,
    lineHeight: 1.5,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  header: {
    padding: '20px 24px 16px',
    textAlign: 'center',
    borderBottom: '1px solid #e5e7eb',
    background: '#ffffff',
  },
  brand: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: '#111827',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#6b7280',
  },
  badge: {
    display: 'inline-block',
    marginTop: 12,
    padding: '3px 12px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    color: '#047857',
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: 999,
  },
  body: { padding: '4px 24px 8px' },
  section: { padding: '16px 0', borderBottom: '1px solid #f3f4f6' },
  sectionLast: { padding: '16px 0' },
  sectionTitle: {
    margin: '0 0 10px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#6b7280',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    padding: '3px 0',
  },
  label: { color: '#6b7280', flexShrink: 0 },
  value: { color: '#111827', fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' },
  roomCard: {
    padding: '10px 12px',
    marginBottom: 8,
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
  },
  roomHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  roomTitle: { fontWeight: 600, color: '#111827' },
  roomMeta: { marginTop: 2, fontSize: 12, color: '#4b5563' },
  chip: {
    flexShrink: 0,
    padding: '2px 10px',
    fontSize: 11,
    fontWeight: 500,
    color: '#374151',
    background: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: 999,
  },
  total: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 10,
    borderTop: '1px solid #111827',
    fontSize: 15,
    fontWeight: 700,
    color: '#111827',
  },
  footer: {
    padding: '14px 24px 18px',
    textAlign: 'center',
    background: '#f9fafb',
    borderTop: '1px solid #e5e7eb',
  },
  thanks: { margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' },
  sub: { margin: '2px 0 0', fontSize: 12, color: '#6b7280' },
  stamp: { margin: '10px 0 0', fontSize: 10, color: '#9ca3af' },
};

const Row = ({ label, children, style }) => (
  <div style={S.row}>
    <span style={S.label}>{label}</span>
    <span style={{ ...S.value, ...style }}>{children}</span>
  </div>
);

/** On-screen booking voucher (original #voucher-content). Data comes from the server. */
export default function VoucherView({ voucher: v }) {
  const now = new Date();
  const p = v.payment;

  return (
    <div id="voucher-content" style={S.card}>
      <div style={S.header}>
        <h2 style={S.brand}>KAKKSON HOTELS</h2>
        <p style={S.subtitle}>Booking Confirmation Voucher</p>
        <span style={S.badge}>CONFIRMED</span>
      </div>

      <div style={S.body}>
        <div style={S.section}>
          <h4 style={S.sectionTitle}>Guest Information</h4>
          <Row label="Booking ID">{v.bookingNumber}</Row>
          <Row label="Guest Name">{v.guestName}</Row>
          <Row label="Email">{v.guestEmail}</Row>
          <Row label="Phone">{v.guestPhone}</Row>
        </div>

        <div style={S.section}>
          <h4 style={S.sectionTitle}>Stay Details</h4>
          <Row label="Hotel">{v.hotel}</Row>
          <Row label="Check-in">{v.checkin}</Row>
          <Row label="Check-out">{v.checkout}</Row>
          <Row label="Nights">{v.totalNights}</Row>
          <Row label="Total Rooms">{v.numRooms}</Row>
        </div>

        <div style={S.section}>
          <h4 style={S.sectionTitle}>
            Room Configuration ({v.isMultiRoom ? `${v.numRooms} Rooms` : 'Single Room'})
          </h4>

          {v.isMultiRoom ? v.rooms.map((room) => (
            <div key={room.index} style={S.roomCard}>
              <div style={S.roomTitle}>Room {room.index}: {room.roomType}</div>
              <div style={S.roomMeta}>
                {people(room.adults, room.childrenAbove6, room.childrenBelow6)}
              </div>
              <div style={S.roomMeta}>Meal Plan: {room.mealPlanText}</div>
            </div>
          )) : (() => {
            const room = v.rooms[0];
            return (
              <div style={S.roomCard}>
                <div style={S.roomHead}>
                  <div>
                    <div style={S.roomTitle}>{room.roomType}</div>
                    <div style={S.roomMeta}>
                      {people(room.adults, room.childrenAbove6, room.childrenBelow6)}
                    </div>
                  </div>
                  <span style={S.chip}>{room.mealPlanText}</span>
                </div>
              </div>
            );
          })()}
        </div>

        <div style={S.section}>
          <h4 style={S.sectionTitle}>Guest Summary</h4>
          <Row label="Total Guests">{v.totalGuests}</Row>
          <div style={{ ...S.roomMeta, textAlign: 'right' }}>
            {v.totalAdults} adult{v.totalAdults > 1 ? 's' : ''}
            {v.totalChildrenAbove6 > 0 ? `, ${v.totalChildrenAbove6} child${v.totalChildrenAbove6 > 1 ? 'ren' : ''} 6+` : ''}
            {v.totalChildrenBelow6 > 0 ? `, ${v.totalChildrenBelow6} child${v.totalChildrenBelow6 > 1 ? 'ren' : ''} <6` : ''}
          </div>
        </div>

        <div style={S.sectionLast}>
          <h4 style={S.sectionTitle}>Payment Summary</h4>
          <Row label="Room Charges">₹{p.roomCharges}</Row>
          {p.addonsCharges > 0 && <Row label="Additional Services">₹{p.addonsCharges}</Row>}
          {p.offerDiscount > 0 && (
            <Row label="Offer Discount" style={{ color: '#047857' }}>-₹{p.offerDiscount}</Row>
          )}
          <Row label="Taxes &amp; Fees">₹{p.taxAmount}</Row>
          {p.convenienceFee > 0 && <Row label="Payment Gateway Charges">₹{p.convenienceFee}</Row>}
          <div style={S.total}>
            <span>Total Amount</span>
            <span>₹{p.totalAmount}</span>
          </div>
        </div>
      </div>

      <div style={S.footer}>
        <p style={S.thanks}>Thank you for choosing Kakkson Hotels!</p>
        <p style={S.sub}>We look forward to welcoming you.</p>
        <p style={S.stamp}>
          Voucher generated on: {now.toLocaleDateString()} {now.toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}