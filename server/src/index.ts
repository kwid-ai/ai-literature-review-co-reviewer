import express from 'express';
import cors from 'cors';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { router } from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3001;


const clientDist = path.join(__dirname, '../../client/dist');
const isBuilt = existsSync(path.join(clientDist, 'index.html'));

if (!isBuilt) {
  app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }));
}

app.use(express.json());
app.use('/api', router);

if (isBuilt) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else {
  app.get('/', (_req, res) =>
    res.send('<p>Run <code>npm run build</code> then restart, or open <a href="http://localhost:5173">http://localhost:5173</a> for the dev UI.</p>'),
  );
}

app.listen(PORT, () => {
  console.log(`AI Review System  →  http://localhost:${PORT}${isBuilt ? '' : '  (API only — start Vite for UI)'}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠  API_KEY not set – users can enter their key in the UI');
  }
});
