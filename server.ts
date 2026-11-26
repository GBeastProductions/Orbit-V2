import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'orbit-arcade', timestamp: new Date().toISOString() });
  });

  app.get('/api/assets/rotation', (_req, res) => {
    try {
      const dailyDir = path.resolve(__dirname, 'public/assets/aistudio/Daily');
      const weeklyDir = path.resolve(__dirname, 'public/assets/aistudio/Weekly');

      const dailyFiles = fs.existsSync(dailyDir)
        ? fs
            .readdirSync(dailyDir)
            .filter((f) => f.toLowerCase().endsWith('.mp3'))
            .sort((a, b) => {
              const na = parseInt(a, 10);
              const nb = parseInt(b, 10);
              if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
              return a.localeCompare(b);
            })
        : [];

      const weeklyFiles = fs.existsSync(weeklyDir)
        ? fs
            .readdirSync(weeklyDir)
            .filter((f) => f.toLowerCase().endsWith('.mp3'))
            .sort((a, b) => a.localeCompare(b))
        : [];

      res.json({ dailyFiles, weeklyFiles });
    } catch (err) {
      res.status(500).json({ error: 'Failed to read asset directories', detail: String(err) });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ORBIT server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ORBIT server:', err);
  process.exit(1);
});
