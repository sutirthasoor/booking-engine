import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useBooking } from '../context/BookingContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import VoucherView from '../components/VoucherView';
import { downloadBase64File } from '../utils/format';

const EMAIL_CLASS = {
  info: 'mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg',
  success: 'mt-4 p-3 bg-green-50 border border-green-200 rounded-lg',
  error: 'mt-4 p-3 bg-red-50 border border-red-200 rounded-lg',
};

/** Page 5 - confirmation, voucher, e-mail status (original #confirmation-section). */
export default function ConfirmationPage() {
  const { receipt, newBooking } = useBooking();
  const toast = useToast();
  const [email, setEmail] = useState({ type: 'info', text: 'Preparing voucher...', visible: false });
  const sent = useRef(false);

  const downloadPDFVoucher = async () => {
    try {
      const { file, toasts } = await api.downloadVoucher(receipt.receiptToken);
      downloadBase64File(file);
      toast.showAll(toasts);
    } catch (e) {
      toast.show(`Failed to download voucher: ${e.message}`, 'error');
    }
  };

  // the voucher is e-mailed automatically once the confirmation page is shown
  useEffect(() => {
    if (!receipt || sent.current) return;
    sent.current = true;
    setEmail({ type: 'info', text: 'Preparing voucher...', visible: true });
    api.emailVoucher(receipt.receiptToken)
      .then((res) => {
        setEmail({ type: 'success', text: res.message, visible: true });
        toast.showAll(res.toasts);
      })
      .catch(async (e) => {
        setEmail({ type: 'error', text: e.message, visible: true });
        await downloadPDFVoucher(); // fallback, same as before
        toast.show('Email failed. PDF voucher downloaded.', 'warning');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt]);

  if (!receipt) return <Navigate to="/" replace />;

  return (
    <div id="confirmation-section">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-check text-white text-3xl" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Booking Confirmed!</h2>
          <p className="text-gray-600">Your booking has been successfully confirmed</p>
        </div>

        <VoucherView voucher={receipt.voucher} />

        <div className="flex gap-3 mt-5 mx-auto" style={{ maxWidth: 440 }}>
          <button
            onClick={downloadPDFVoucher}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md font-medium text-sm hover:bg-blue-700 transition duration-200"
          >
            <i className="fas fa-download mr-2" />Download Voucher
          </button>
          <button
            onClick={newBooking}
            className="flex-1 bg-white text-gray-700 border border-gray-300 py-2 px-4 rounded-md font-medium text-sm hover:bg-gray-50 transition duration-200"
          >
            <i className="fas fa-plus mr-2" />New Booking
          </button>
        </div>
      </div>
    </div>
  );
}