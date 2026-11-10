import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  css: false,
  test: { environment: 'jsdom', env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'test-anon-key', CACHE_TTL_MS: '0' }, include: ['test/**/*.test.jsx'], testTimeout: 30000 },
  server: { fs: { allow: ['..'] } },
});
