import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

function mockBroadcastPlugin() {
  let latestRequest = null;
  return {
    name: 'mock-broadcast',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/mock/broadcast' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            if (body) {
              try { latestRequest = JSON.parse(body); } catch(e){}
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok' }));
          });
        } else if (req.url === '/api/mock/poll' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(latestRequest || null));
        } else if (req.url === '/api/mock/clear' && req.method === 'POST') {
          latestRequest = null;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'ok' }));
        } else {
          next();
        }
      });
    }
  }
}

export default defineConfig({
  plugins: [react(), mockBroadcastPlugin()],
  server: {
    port: 3000,
    proxy: {
      '/auth': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/riders': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/drivers': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
