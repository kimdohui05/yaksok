import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 항상 5173 포트 사용 (사용 중이면 다른 포트로 넘어가지 않고 에러)
  server: { port: 5173, strictPort: true },
})
