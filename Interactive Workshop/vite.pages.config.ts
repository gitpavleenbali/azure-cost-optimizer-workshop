import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/azure-cost-optimizer-workshop/',
  publicDir: 'public-pages',
  plugins: [react()],
  build: {
    outDir: 'dist-pages',
    emptyOutDir: true,
    rollupOptions: { input: 'pages.html' },
  },
})