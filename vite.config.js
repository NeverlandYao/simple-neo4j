import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/llm': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/question': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/question_stats': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/submit_answer': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      }
    }
  }
})
