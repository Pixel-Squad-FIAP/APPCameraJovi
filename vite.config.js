import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Em produção a pasta api/ roda como Vercel Functions. No `npm run dev` este plugin
// executa os mesmos handlers, para que a API funcione localmente sem a Vercel CLI.
function vercelApiDevServer() {
  return {
    name: 'vercel-api-dev-server',
    configureServer(server) {
      server.middlewares.use('/api', async (request, response, next) => {
        const name = request.url.split('?')[0].replace(/^\/+|\/+$/g, '');
        if (!/^[\w-]+$/.test(name)) return next();

        const file = path.resolve(server.config.root, 'api', `${name}.js`);
        if (!fs.existsSync(file)) return next();

        const vercelResponse = Object.assign(response, {
          status(code) {
            response.statusCode = code;
            return vercelResponse;
          },
          json(body) {
            if (!response.getHeader('Content-Type')) {
              response.setHeader('Content-Type', 'application/json; charset=utf-8');
            }
            response.end(JSON.stringify(body));
            return vercelResponse;
          }
        });

        try {
          const module = await server.ssrLoadModule(file);
          await module.default(request, vercelResponse);
        } catch (error) {
          server.config.logger.error(error.stack ?? String(error));
          vercelResponse.status(500).json({ error: 'Erro interno na API' });
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [tailwindcss(), react(), vercelApiDevServer()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js']
  }
});
