import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@tagselector/tag-core': path.resolve(__dirname, '../../packages/tag-core/src/index.ts'),
    },
  },
  optimizeDeps: {
    exclude: ['@tagselector/tag-core'],
  },
})
