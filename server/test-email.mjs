import { config } from './src/config.js';

const to = process.argv[2];
if (!to) { console.log('Usage: node test-email.mjs you@example.com'); process.exit(1); }

const body = {
  service_id: config.emailjs.serviceId,
  template_id: config.emailjs.guestTemplateId,
  user_id: config.emailjs.publicKey,
  template_params: { email: to, to_email: to, guest_name: 'Test', booking_number: 'TEST-123', hotel_name: 'Test Hotel' },
};
if (config.emailjs.privateKey) body.accessToken = config.emailjs.privateKey;
console.log('Using:', config.emailjs.serviceId, config.emailjs.guestTemplateId, 'private key set:', !!config.emailjs.privateKey);
const res = await fetch(config.emailjs.apiUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
console.log(res.status, await res.text());