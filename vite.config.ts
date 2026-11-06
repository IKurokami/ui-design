import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// GitHub Pages uses a project subpath; normal hosting keeps the root URL.
const onGitHubPages = process.env.GITHUB_PAGES === 'true'

export default defineConfig({
  base: onGitHubPages ? '/ui-design/' : '/',
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'] },
})
