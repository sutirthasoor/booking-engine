import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { ApiError } from './utils/errors.js';
import hotelsRouter from './routes/hotels.js';
import roomsRouter from './routes/rooms.js';
import bookingsRouter from './routes/bookings.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  // CSP is left to the static host: the page loads Razorpay, Font Awesome and remote hotel photos.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(compression());
  if (config.corsOrigins.length) app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false });
  const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });

  app.use('/api', apiLimiter);
  app.use('/api/hotels', hotelsRouter);
  app.use('/api/rooms', roomsRouter);
  app.use('/api/booking', bookingsRouter); // quote, guest/validate
  app.use('/api/bookings', writeLimiter, bookingsRouter); // start, confirm, email, voucher

  app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Not found' }));

  // Serve the built React app in production
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ApiError) {
      return res.status(err.status).json({
        ok: false,
        error: err.message,
        toasts: [{ type: err.toastType, message: err.message }],
      });
    }
    console.error(err);
    res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.', toasts: [{ type: 'error', message: 'Something went wrong. Please try again.' }] });
  });

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createApp().listen(config.port, () => {
    console.log(`Kakkson booking API listening on http://localhost:${config.port}`);
  });
}
