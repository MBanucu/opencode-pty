import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: 'src/web',
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
    minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false, // Enable minification for production
  },
  server: {
    port: 3000,
    host: true,
  },
})
