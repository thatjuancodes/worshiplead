import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      stream: 'stream-browserify',
      http: 'stream-http',
      https: 'https-browserify',
      url: 'url',
      zlib: 'browserify-zlib',
      assert: 'assert',
      buffer: 'buffer',
      util: 'util',
      events: 'events',
      process: 'process/browser'
    }
  },
  define: {
    'process.env': {},
    global: 'window'
  },
  optimizeDeps: {
    include: ['buffer', 'process']
  }
})
