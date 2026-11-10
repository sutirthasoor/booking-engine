import 'dotenv/config';

const required = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

if (isProd && !process.env.TOKEN_SECRET) {
  throw new Error('TOKEN_SECRET must be set in production');
}

const supabaseUrl = required('SUPABASE_URL');

export const config = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT || 5000),
  corsOrigins: (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean),
  tokenSecret: process.env.TOKEN_SECRET || 'dev-only-secret-change-me',
  cacheTtlMs: Number(process.env.CACHE_TTL_MS || 10000),
  voucherTimezone: process.env.VOUCHER_TIMEZONE || 'Asia/Kolkata',

  supabase: {
    url: supabaseUrl,
    anonKey: required('SUPABASE_ANON_KEY'),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  // Supabase edge functions that already existed in the original page
  functions: {
    razorpayOrder: `${supabaseUrl}/functions/v1/razorpay-order`,
    verifyPayment: `${supabaseUrl}/functions/v1/verify-payment`,
    sendVoucherEmail: `${supabaseUrl}/functions/v1/send-voucher-email`,
  },

  emailjs: {
    apiUrl: 'https://api.emailjs.com/api/v1.0/email/send',
    publicKey: process.env.EMAILJS_PUBLIC_KEY || 'c3HEqY_tWmDMXZ7z_',
    privateKey: process.env.EMAILJS_PRIVATE_KEY || '',
    serviceId: process.env.EMAILJS_SERVICE_ID || 'service_7ieecyb',
    guestTemplateId: process.env.EMAILJS_GUEST_TEMPLATE_ID || 'template_nhtzzr2',
    adminTemplateId: process.env.EMAILJS_ADMIN_TEMPLATE_ID || 'template_q3gp2il',
  },

  // Business constants carried over from the original script
  business: {
    defaultEpPrice: 1500,
    defaultCpPrice: 1800,
    highTaxThresholdPerNight: 7500,
    highTaxRate: 0.18,
    lowTaxRate: 0.05,
    convenienceMinimumCommission: 0.03,
    convenienceCommissionRate: 0.02,
    convenienceGstRate: 0.18,
    maxHotels: 12,
  },
};
