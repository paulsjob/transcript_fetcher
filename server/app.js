import './config/env.js';
import express from 'express';
import cors from 'cors';
import vimeoRoutes from './routes/vimeoRoutes.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'vimeo-transcript-archive' });
});

app.use('/api', vimeoRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

export default app;
