import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
// import { analyzer } from 'vite-bundle-analyzer'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  base: command === 'build' ? 'https://cdn.jsdelivr.net/npm/@pydantic/ai-chat-ui/dist/' : '',
  build: {
    assetsDir: 'assets',
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
}))
