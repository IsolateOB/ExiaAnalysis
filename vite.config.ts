/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/game': {
        target: 'https://api.blablalink.com',
        changeOrigin: true,
        secure: true,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // 将自定义 header X-Game-Cookie 转换为 Cookie header
            const gameCookie = req.headers['x-game-cookie']
            if (gameCookie) {
              proxyReq.setHeader('Cookie', gameCookie)
              proxyReq.removeHeader('x-game-cookie')
            }
          })
        },
      },
    },
  },
  esbuild: {
    target: 'esnext'
  }
})
