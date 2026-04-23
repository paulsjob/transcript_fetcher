import app from './app.js';

const PORT = Number(process.env.PORT || 8787);

app.listen(PORT, () => {
  console.log(`Transcript server listening on http://localhost:${PORT}`);
});
