import { jsPDF } from 'jspdf';
import { config } from '../config.js';
import { formatMoney } from '../utils/money.js';

/** room_configuration rows are saved in two shapes (snake_case for single, camelCase for multi). */
const rType = (r) => r.room_type || r.roomType;
const rPlan = (r) => r.meal_plan || r.mealPlan;
const isMultiRoom = (b) => Array.isArray(b.room_configuration) && b.room_configuration.length > 1;

const planText = (plan) => (plan === 'cp' ? 'Breakfast Included (CP)' : 'Room Only (EP)');

const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const guestsText = (adults, above, below) =>
  [
    `${adults} adult${adults === 1 ? '' : 's'}`,
    above > 0 ? `${above} child${above === 1 ? '' : 'ren'} (6+ yrs)` : '',
    below > 0 ? `${below} child${below === 1 ? '' : 'ren'} (under 6)` : '',
  ].filter(Boolean).join(', ');

/**
 * One row per booked room - same data the extranet shows (room type, guests per room, meal plan).
 * Multi-room bookings store every room; single-type bookings store totals, which are split evenly.
 */
export function getRoomRows(booking) {
  if (isMultiRoom(booking)) {
    return booking.room_configuration.map((room, i) => ({
      index: i + 1,
      roomType: rType(room) || 'Room',
      adults: room.num_adults || room.adults || 0,
      childrenAbove6: room.num_children_above_6 || room.childrenAbove6 || 0,
      childrenBelow6: room.num_children_below_6 || room.childrenBelow6 || 0,
      mealPlanText: planText(rPlan(room)),
    }));
  }
  const n = Math.max(1, Number(booking.num_rooms) || 1);
  return Array.from({ length: n }, (_, i) => ({
    index: i + 1,
    roomType: booking.room_type || 'Standard Room',
    adults: Math.floor((booking.num_adults || 0) / n),
    childrenAbove6: Math.floor((booking.num_children_above_6 || 0) / n),
    childrenBelow6: Math.floor((booking.num_children_below_6 || 0) / n),
    mealPlanText: planText(booking.meal_plan),
  }));
}

/** Ready-made room details for the e-mail templates (an e-mail template cannot loop over rooms). */
export function buildEmailRoomDetails(booking) {
  const rows = getRoomRows(booking);

  const counts = {};
  rows.forEach((r) => { counts[r.roomType] = (counts[r.roomType] || 0) + 1; });
  const roomSummary = Object.entries(counts).map(([t, c]) => `${t} × ${c}`).join(', ');

  const roomDetails = rows
    .map((r) => `Room ${r.index}: ${r.roomType} - ${guestsText(r.adults, r.childrenAbove6, r.childrenBelow6)} - ${r.mealPlanText}`)
    .join('\n');

  const cell = 'padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;color:#334155;';
  const head = 'padding:8px 10px;border:1px solid #e2e8f0;font-size:12px;background:#f1f5f9;color:#475569;text-align:left;';
  const roomsHtml = `<table style="width:100%;border-collapse:collapse;margin:0;">
<thead><tr><th style="${head}">Room</th><th style="${head}">Room Type</th><th style="${head}">Guests</th><th style="${head}">Meal Plan</th></tr></thead>
<tbody>${rows.map((r) => `<tr><td style="${cell}">${r.index}</td><td style="${cell}"><strong>${escapeHtml(r.roomType)}</strong></td><td style="${cell}">${escapeHtml(guestsText(r.adults, r.childrenAbove6, r.childrenBelow6))}</td><td style="${cell}">${escapeHtml(r.mealPlanText)}</td></tr>`).join('')}</tbody></table>`;

  const adults = booking.num_adults || 0;
  const above = booking.num_children_above_6 || 0;
  const below = booking.num_children_below_6 || 0;

  return {
    room_summary: roomSummary,
    room_details: roomDetails,
    rooms_html: roomsHtml,
    guest_summary: guestsText(adults, above, below),
    total_children: above + below,
  };
}

/** Data for the on-screen voucher on the confirmation page. */
export function buildVoucherView({ booking, pricing }) {
  const multi = isMultiRoom(booking);
  let totalAdults = 0;
  let totalChildrenAbove6 = 0;
  let totalChildrenBelow6 = 0;
  let rooms;

  if (multi) {
    rooms = booking.room_configuration.map((room, index) => {
      const adults = room.num_adults || room.adults || 0;
      const above = room.num_children_above_6 || room.childrenAbove6 || 0;
      const below = room.num_children_below_6 || room.childrenBelow6 || 0;
      totalAdults += adults;
      totalChildrenAbove6 += above;
      totalChildrenBelow6 += below;
      return { index: index + 1, roomType: rType(room), adults, childrenAbove6: above, childrenBelow6: below, mealPlan: rPlan(room) === 'cp' ? 'cp' : 'ep', mealPlanText: planText(rPlan(room)) };
    });
  } else {
    totalAdults = booking.num_adults || 0;
    totalChildrenAbove6 = booking.num_children_above_6 || 0;
    totalChildrenBelow6 = booking.num_children_below_6 || 0;
    rooms = [{
      index: 1,
      roomType: booking.room_type || 'Standard Room',
      adults: totalAdults,
      childrenAbove6: totalChildrenAbove6,
      childrenBelow6: totalChildrenBelow6,
      mealPlan: booking.meal_plan === 'cp' ? 'cp' : 'ep',
      mealPlanText: planText(booking.meal_plan),
    }];
  }

  return {
    bookingNumber: booking.booking_number,
    guestName: booking.guest_name,
    guestEmail: booking.guest_email,
    guestPhone: booking.guest_phone,
    hotel: booking.hotel,
    numRooms: booking.num_rooms,
    checkin: booking.checkin,
    checkout: booking.checkout,
    totalNights: booking.total_nights,
    isMultiRoom: multi,
    rooms,
    totalGuests: totalAdults + totalChildrenAbove6 + totalChildrenBelow6,
    totalAdults,
    totalChildrenAbove6,
    totalChildrenBelow6,
    payment: {
      roomCharges: formatMoney(pricing.roomCharges),
      addonsCharges: pricing.addonsCharges,
      offerDiscount: pricing.offerDiscount,
      taxAmount: pricing.taxAmount,
      convenienceFee: pricing.convenienceFee,
      totalAmount: formatMoney(booking.total_amount),
    },
  };
}

const dateNow = () => new Date().toLocaleDateString('en-IN', { timeZone: config.voucherTimezone });
const dateTimeNow = () =>
  `${dateNow()} ${new Date().toLocaleTimeString('en-IN', { timeZone: config.voucherTimezone })}`;

/** Branded PDF voucher (port of the original jsPDF layout). Returns a Buffer. */
export function generatePdfVoucher({ booking, pricing }) {
  const doc = new jsPDF();

  const primaryColor = [25, 118, 210];
  const darkColor = [38, 50, 56];
  const lightColor = [245, 247, 249];
  const rs = 'Rs';

  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 50, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text('KAKKSON HOTELS', 105, 25, { align: 'center' });
  doc.setFontSize(16);
  doc.text('BOOKING CONFIRMATION VOUCHER', 105, 35, { align: 'center' });

  let y = 60;
  doc.setFontSize(12);
  doc.setTextColor(...darkColor);
  doc.text(`Booking ID: ${booking.booking_number}`, 20, y);
  doc.text(`Date: ${dateNow()}`, 150, y);
  y += 20;

  const section = (title) => {
    doc.setFillColor(...lightColor);
    doc.rect(15, y - 5, 180, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(title, 20, y);
    y += 15;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkColor);
  };

  section('GUEST INFORMATION');
  doc.text(`Name: ${booking.guest_name}`, 25, y); y += 8;
  doc.text(`Email: ${booking.guest_email}`, 25, y); y += 8;
  doc.text(`Phone: ${booking.guest_phone || 'N/A'}`, 25, y);
  y += 15;

  section('BOOKING DETAILS');
  doc.text(`Hotel: ${booking.hotel}`, 25, y); y += 8;
  doc.text(`Total Rooms: ${booking.num_rooms}`, 25, y); y += 8;

  if (isMultiRoom(booking)) {
    const groups = {};
    booking.room_configuration.forEach((room) => {
      const t = rType(room);
      groups[t] ||= { count: 0, ep: 0, cp: 0 };
      groups[t].count += 1;
      if (rPlan(room) === 'cp') groups[t].cp += 1; else groups[t].ep += 1;
    });
    doc.text('Room Types:', 25, y); y += 8;
    Object.entries(groups).forEach(([type, g]) => {
      if (y > 280) { doc.addPage(); y = 20; }
      const parts = [];
      if (g.ep > 0) parts.push(`${g.ep} EP`);
      if (g.cp > 0) parts.push(`${g.cp} CP`);
      doc.text(`  - ${type} x ${g.count} (${parts.join(', ')})`, 30, y);
      y += 8;
    });
  } else {
    const mealPlan = booking.meal_plan === 'ep' ? 'Room Only (EP)' : 'Breakfast Included (CP)';
    doc.text(`Room Type: ${booking.room_type}`, 25, y); y += 8;
    doc.text(`Meal Plan: ${mealPlan}`, 25, y); y += 8;
  }

  y += 8;
  doc.text(`Check-in: ${booking.checkin}`, 25, y); y += 8;
  doc.text(`Check-out: ${booking.checkout}`, 25, y); y += 8;
  doc.text(`Nights: ${booking.total_nights}`, 25, y);
  y += 15;

  section('GUEST DETAILS');
  const adults = booking.num_adults || 0;
  const above = booking.num_children_above_6 || 0;
  const below = booking.num_children_below_6 || 0;
  doc.text(`Total Guests: ${adults + above + below}`, 25, y); y += 8;
  doc.text(`Adults: ${adults}`, 30, y); y += 8;
  if (above > 0) { doc.text(`Children (6+ years): ${above}`, 30, y); y += 8; }
  if (below > 0) { doc.text(`Children (<6 years): ${below}`, 30, y); y += 8; }
  y += 15;

  section('PAYMENT SUMMARY');
  doc.text('Room Charges:', 25, y);
  doc.text(rs + formatMoney(pricing.roomCharges), 180, y, { align: 'left' }); y += 8;

  if (pricing.addonsCharges > 0) {
    doc.text('Additional Services:', 25, y);
    doc.text(rs + formatMoney(pricing.addonsCharges), 180, y, { align: 'left' }); y += 8;
  }
  if (pricing.offerDiscount > 0) {
    doc.setTextColor(76, 175, 80);
    doc.text('Special Offer Discount:', 25, y);
    doc.text(`-${rs}${formatMoney(pricing.offerDiscount)}`, 180, y, { align: 'left' });
    doc.setTextColor(...darkColor);
    y += 8;
  }

  doc.text(`Tax (${pricing.taxRate >= 0.18 ? '18%' : '5%'}):`, 25, y);
  doc.text(rs + formatMoney(pricing.taxAmount), 180, y, { align: 'left' }); y += 8;

  if (pricing.convenienceFee > 0) {
    doc.text('Payment Gateway Charges:', 25, y);
    doc.text(rs + formatMoney(pricing.convenienceFee), 180, y, { align: 'left' }); y += 8;
  }

  y += 5;
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(25, y, 180, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.text('Total Amount:', 25, y);
  doc.text(rs + formatMoney(pricing.totalAmount), 180, y, { align: 'right' });
  y += 15;

  doc.setFontSize(12);
  doc.setTextColor(76, 175, 80);
  doc.text('Status: CONFIRMED', 25, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you for choosing Kakkson Hotels!', 105, y, { align: 'center' }); y += 6;
  doc.text('We look forward to welcoming you.', 105, y, { align: 'center' }); y += 6;
  doc.text('Please present this voucher at the hotel reception.', 105, y, { align: 'center' }); y += 10;
  doc.text(`Voucher generated on: ${dateTimeNow()}`, 105, y, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}

/** Plain text voucher used when the PDF cannot be produced. */
export function generateTextVoucher({ booking }) {
  return `
KAKKSON HOTELS - BOOKING CONFIRMATION
======================================

BOOKING ID: ${booking.booking_number}
CONFIRMED ON: ${dateNow()}

GUEST INFORMATION:
Name: ${booking.guest_name}
Email: ${booking.guest_email}
Phone: ${booking.guest_phone}

BOOKING DETAILS:
Hotel: ${booking.hotel}
Room: ${booking.room_type}
Check-in: ${booking.checkin}
Check-out: ${booking.checkout}
Nights: ${booking.total_nights}
Guests: ${booking.num_adults} Adults

TOTAL AMOUNT: Rs${formatMoney(booking.total_amount)}
STATUS: CONFIRMED

Thank you for choosing Kakkson Hotels!
Present this voucher at reception.
======================================
    `.trim();
}

/** { kind, filename, mime, data(base64) } - PDF first, text voucher as the fallback. */
export function buildVoucherDownload(receipt) {
  const name = `voucher-${receipt.booking.booking_number}`;
  try {
    return { kind: 'pdf', filename: `${name}.pdf`, mime: 'application/pdf', data: generatePdfVoucher(receipt).toString('base64') };
  } catch (error) {
    console.error('PDF generation failed:', error);
    return {
      kind: 'text',
      filename: `${name}.txt`,
      mime: 'text/plain',
      data: Buffer.from(generateTextVoucher(receipt)).toString('base64'),
    };
  }
}
