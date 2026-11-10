import { useEffect } from 'react';

/** Original behaviour: opening a modal sets body overflow hidden, closing restores it. */
export default function useBodyLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, [active]);
}
