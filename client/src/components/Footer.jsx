import { css } from '../utils/css';

export default function Footer() {
  return (
    <footer className="footer" style={css('background-color: #ff9800; color: white; padding: 20px 0; margin-top: 40px; border-top: 3px solid #f57c00;')}>
      <div className="footer-content" style={css('max-width: 1400px; margin: 0 auto; padding: 0 20px; text-align: center;')}>
        <p className="footer-text" style={css('font-size: 14px; margin: 0; opacity: 0.9;')}>
          &copy; 2025 Kakkson Booking.{' '}
          <strong style={css('color: #fff; font-weight: 700;')}>
            Developed by{' '}
            <a
              href="https://systems-solutions.netlify.app/" target="_blank" rel="noreferrer"
              style={css('color: #fff; text-decoration: underline; text-underline-offset: 3px; transition: opacity 0.2s;')}
              onMouseOver={(e) => { e.currentTarget.style.opacity = '0.8'; }}
              onMouseOut={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              SYSTEMS SOLUTION
            </a>
          </strong>
        </p>
      </div>
    </footer>
  );
}
