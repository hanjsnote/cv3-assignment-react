import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Vite(5173)에서 받은 API 요청을 Express(3000)로 전달해 개발 환경의 교차 출처 요청을 피합니다.
      '/api': 'http://localhost:3000',
    },
  },
})
