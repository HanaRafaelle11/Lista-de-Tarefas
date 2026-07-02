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

const certPathKey = fs.existsSync('.certs/key.pem') ? '.certs/key.pem' : fs.existsSync('key.pem') ? 'key.pem' : null;
const certPathCert = fs.existsSync('.certs/cert.pem') ? '.certs/cert.pem' : fs.existsSync('cert.pem') ? 'cert.pem' : null;
const hasCertificates = certPathKey && certPathCert;
const serverConfig = hasCertificates ? {
  https: {
    key: fs.readFileSync(certPathKey),
    cert: fs.readFileSync(certPathCert)
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
      strategies: 'injectManifest',
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
            src: 'icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      },
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5000000,
        globIgnores: ['**/branding-source*'],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}']
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html'
      }
    })
  ]
})