import { createServer, loadConfigFromFile } from 'vite';

// Production env, local HTTP only; never proxy fixture requests to live services.
const loaded = await loadConfigFromFile({ command: 'serve', mode: 'production' });
const server = await createServer({
  ...loaded.config,
  configFile: false,
  mode: 'production',
  server: { host: '127.0.0.1', port: 5187, strictPort: true },
});
await server.listen();
