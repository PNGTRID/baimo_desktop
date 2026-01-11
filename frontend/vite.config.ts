import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 14200,
    strictPort: true,
  },
  build: {
    target: ['chrome105', 'firefox104', 'safari15', 'edge105'],
  },
})
