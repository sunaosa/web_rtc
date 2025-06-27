import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  server: {
    port: 8000,
    open: true,
    host: 'localhost'
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      crypto: false,
      buffer: false,
      util: false
    }
  },
  optimizeDeps: {
    exclude: ['crypto']
  }
})