import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })
// Fallback to .env if any variables are missing
dotenv.config()

const apiDevServerPlugin = () => ({
  name: 'vercel-api-dev-server',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url && req.url.startsWith('/api/')) {
        const parsedUrl = new URL(req.url, 'http://localhost');
        const pathname = parsedUrl.pathname; // ex: /api/payments/create

        // ✅ CORRIGIDO: Simula exatamente o roteamento do vercel.json
        // /api/(.*)  →  /api/[...routes].js?routes=$1
        const catchAllPath = path.resolve(process.cwd(), 'api/[...routes].js');
        const routeSegment = pathname.replace(/^\/api\//, ''); // ex: "payments/create"

        // Tenta o arquivo literal primeiro, depois cai no catch-all
        let absolutePath = null;
        const literalPath = pathname.endsWith('.js')
          ? path.resolve(process.cwd(), `.${pathname}`)
          : path.resolve(process.cwd(), `.${pathname}.js`);

        if (fs.existsSync(literalPath)) {
          absolutePath = literalPath;
        } else if (fs.existsSync(catchAllPath)) {
          absolutePath = catchAllPath;
        } else {
          console.warn(`[API Dev Server] File not found for: ${pathname}`);
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `Not found: ${pathname}` }));
          return;
        }

        try {
          // Parse request query parameters
          const query = {};
          parsedUrl.searchParams.forEach((value, key) => {
            query[key] = value;
          });

          // ✅ Injeta routes como string (igual ao vercel.json: ?routes=payments/create)
          if (absolutePath === catchAllPath && routeSegment) {
            query.routes = routeSegment;
          }
          req.query = query;

          // Read body if POST/PUT/PATCH/DELETE
          let body = {};
          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
            await new Promise((resolve) => {
              let data = '';
              req.on('data', chunk => {
                data += chunk;
              });
              req.on('end', () => {
                if (data) {
                  try {
                    body = JSON.parse(data);
                  } catch (e) {
                    body = data;
                  }
                }
                resolve();
              });
            });
          }
          req.body = body;

          // Mock Express/Vercel response properties & helper methods
          res.status = (statusCode) => {
            res.statusCode = statusCode;
            return res;
          };
          res.json = (data) => {
            if (!res.headersSent) {
              res.setHeader('Content-Type', 'application/json');
            }
            res.end(JSON.stringify(data));
            return res;
          };
          res.send = (body) => {
            if (typeof body === 'object') {
              return res.json(body);
            }
            if (!res.headersSent) {
              res.setHeader('Content-Type', 'text/html');
            }
            res.end(body);
            return res;
          };

          // Load the module dynamically
          const moduleUrl = pathToFileURL(absolutePath).href + `?t=${Date.now()}`;
          const module = await import(moduleUrl);

          if (typeof module.default === 'function') {
            await module.default(req, res);
          } else {
            console.error(`[API Dev Server] Handler is not a function in ${absolutePath}`);
            res.status(500).json({ error: 'Handler is not a function.' });
          }
        } catch (error) {
          console.error(`[API Dev Server] Error handling ${pathname}:`, error);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error', message: error.message });
          }
        }
        return;
      }
      next();
    });
  }
});

const hasCertificates = fs.existsSync('key.pem') && fs.existsSync('cert.pem');
const serverConfig = hasCertificates ? {
  https: {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
  },
  host: true
} : undefined;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '2.0.1')
  },
  server: serverConfig,
  plugins: [
    apiDevServerPlugin(),
    react(),
    VitePWA({
      strategy: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'inline', // 🛡️ Evita quebras de injeção de script no front
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
      injectManifest: {
        // 🛡️ SOLUÇÃO DO BUG: Força o empacotamento inline do runtime do Workbox,
        // eliminando o uso de 'importScripts()' dentro do escopo do Worker global.
        inlineWorkboxRuntime: true
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