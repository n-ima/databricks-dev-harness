import { build } from 'file:///D:/projects/product-sales-management/apps/sales-management/node_modules/vite/dist/node/index.js';
import tailwind from 'file:///D:/projects/product-sales-management/apps/sales-management/node_modules/@tailwindcss/vite/dist/index.mjs';
const root = new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1');
const deps = 'D:/projects/product-sales-management/apps/sales-management/node_modules';
const environmentIsolation = { name: 'purpose-forward-env-isolation', configResolved(config) {
  if (config.envDir !== false || config.envPrefix.length !== 0) throw new Error('Fixture environment isolation must remain enabled');
  console.log('Fixture isolation confirmed: envDir=false, envPrefix=[]');
} };
await build({ root, configFile: false, envDir: false, envPrefix: [], cacheDir: `${root}/.vite-cache`, plugins: [environmentIsolation, tailwind()], resolve: { alias: [
  { find: '@databricks/appkit-ui/react', replacement: `${deps}/@databricks/appkit-ui/dist/react/index.js` },
  { find: /^react-dom(\/.*)?$/, replacement: `${deps}/react-dom$1` },
  { find: /^react(\/.*)?$/, replacement: `${deps}/react$1` },
] }, build: { outDir: 'dist', emptyOutDir: false } });
