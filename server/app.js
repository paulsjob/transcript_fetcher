import express from 'express';
import cors from 'cors';
import transcriptRouter from './routes/transcript.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', transcriptRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

export default app;
