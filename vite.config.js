import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // 같은 와이파이의 다른 기기(핸드폰)에서 접속 가능
    port: 5173,
  },
})
