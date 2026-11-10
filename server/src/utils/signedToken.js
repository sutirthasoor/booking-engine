import crypto from 'node:crypto';
import { config } from '../config.js';
import { ApiError } from './errors.js';

/** Sign a JSON payload so it can be handed to the browser and verified when it comes back. */
export function signPayload(payload, ttlSeconds = 60 * 60 * 6) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlSeconds * 1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', config.tokenSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyPayload(token) {
  const invalid = () => new ApiError(400, 'Invalid booking token. Please start the booking again.');
  if (typeof token !== 'string' || !token.includes('.')) throw invalid();
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', config.tokenSecret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw invalid();
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (payload.exp && payload.exp < Date.now()) {
    throw new ApiError(400, 'This booking session has expired. Please start again.');
  }
  return payload;
}
