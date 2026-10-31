// Remove generated build output and caches. Never touches source,
// node_modules/ itself, or anything you've written.
//   npm run clean
import { rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const targets = [
  'dist', // production build (npm run build)
  'dist-ssr',
  'tsconfig.tsbuildinfo', // TypeScript incremental build cache
  'node_modules/.vite', // Vite dependency pre-bundle cache
];

let removed = 0;
for (const t of targets) {
  const p = join(root, t);
  if (!existsSync(p)) continue;
  rmSync(p, { recursive: true, force: true });
  console.log(`removed ${t}`);
  removed++;
}
console.log(removed ? `Cleaned ${removed} item${removed === 1 ? '' : 's'}.` : 'Nothing to clean.');
