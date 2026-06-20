import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import apiApp from './server/index.js';

async function startServer() {
  const PORT = 3000;

  // Mount other middle-wares or logs if needed
  console.log('Orchestrator: Mounting Reels Automator API endpoints...');
  
  // Use the API app instance
  const app = apiApp;

  // Match Vite middleware to Express routes in non-production environment
  if (process.env.NODE_ENV !== "production") {
    console.log('Dev Environment: Integrating Vite Middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Production Environment: Serving static assets from /dist...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(` Reels Automator is active on port: ${PORT}`);
    console.log(` Web App URL: http://0.0.0.0:${PORT}`);
    console.log(`===============================================`);
  });
}

startServer();
