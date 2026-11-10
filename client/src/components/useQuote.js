import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

/** Price breakdown computed by the server for the current selection / add-ons / payment method. */
export default function useQuote(selection, addons, paymentMethod = '') {
  const toast = useToast();
  const [quote, setQuote] = useState(null);
  const req = useRef(0);
  const key = JSON.stringify([selection, addons, paymentMethod]);

  useEffect(() => {
    if (!selection) return;
    const id = ++req.current;
    api.quote({ selection, addons, paymentMethod })
      .then((d) => { if (id === req.current) setQuote(d.quote); })
      .catch((e) => toast.show(e.message, 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return quote;
}
