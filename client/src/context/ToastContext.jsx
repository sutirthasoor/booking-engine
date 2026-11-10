import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

/** Same behaviour as the original showToast(): stacked messages that disappear after 4 seconds. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const show = useCallback((message, type = 'info') => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  /** Play a list of { type, message } sent by the server. */
  const showAll = useCallback((list = []) => list.forEach((t) => show(t.message, t.type)), [show]);

  const value = useMemo(() => ({ show, showAll }), [show, showAll]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div id="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-message toast-${t.type}`}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
