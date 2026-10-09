import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import manifest from './package.json' with { type: 'json' };

const release = manifest.release;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(manifest.version),
    __APP_RELEASE__: JSON.stringify(release),
  },
  plugins: [react()],
  server: { allowedHosts: ['web'], proxy: { '/api': 'http://api:8080' } },
});
