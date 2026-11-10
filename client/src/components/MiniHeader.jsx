import { useEffect } from 'react';
import { css } from '../utils/css';

/** Compact fixed bar shown on every page after a hotel was chosen (original hideHeader()). */
export default function MiniHeader() {
  useEffect(() => {
    document.body.style.paddingTop = '60px';
    const onResize = () => {
      document.body.style.paddingTop = window.innerWidth <= 767 ? '52px' : '56px';
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      document.body.style.paddingTop = '';
    };
  }, []);

  return (
    <div
      id="mini-header-logo"
      style={css(`position: fixed; top: 0; left: 0; right: 0; background-color: orange; padding: 12px 16px;
        z-index: 50; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; align-items: center;
        justify-content: center; gap: 8px;`)}
    >
      <img src="https://i.ibb.co/rKH8BQr9/images-3.png" style={css('width: 28px; height: 28px;')} alt="K" />
      <span style={css('font-size: 18px; font-weight: bold; color: white;')}>Kakkson Hotels - Book Your Stay</span>
    </div>
  );
}
