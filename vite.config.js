import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '2.0.1')
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'icon.svg'],
      manifest: {
        name: 'MyFlowDay',
        short_name: 'MyFlowDay',
        description: 'Plataforma de Progresso Pessoal',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/branding/icon-152.png',
            sizes: '152x152',
            type: 'image/png'
          },
          {
            src: '/branding/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/branding/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/branding/icon-1024.png',
            sizes: '1024x1024',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5000000,
        globIgnores: ['**/branding-source*'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 1 dia
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ]
})
