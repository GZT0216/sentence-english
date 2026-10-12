import { createApp } from './app.js';

const port = parseInt(process.env.PORT || '8787');
const app = createApp();
app.listen(port, () => {
  console.log(`[backend] listening on http://localhost:${port}`);
});
