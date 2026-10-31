// Remove generated files. Never touches your source, package-lock.json or data.
//   npm run clean         build output, caches AND node_modules (run npm install afterwards)
//   npm run clean:build   build output and caches only; keeps node_modules
import { rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildOnly = process.argv.includes('--build-only');

const targets = [
  'dist', // production build (npm run build)
  'dist-ssr',
  'tsconfig.tsbuildinfo', // TypeScript incremental build cache
  // Vite's cache lives inside node_modules, so it is only listed separately
  // for the build-only mode; a full clean removes it along with node_modules.
  ...(buildOnly ? ['node_modules/.vite'] : ['node_modules']),
];

let removed = 0;
let removedDeps = false;
for (const t of targets) {
  const p = join(root, t);
  if (!existsSync(p)) continue;
  rmSync(p, { recursive: true, force: true });
  console.log(`removed ${t}`);
  removed++;
  if (t === 'node_modules') removedDeps = true;
}
console.log(removed ? `Cleaned ${removed} item${removed === 1 ? '' : 's'}.` : 'Nothing to clean.');
if (removedDeps) console.log('Run "npm install" before building again.');
