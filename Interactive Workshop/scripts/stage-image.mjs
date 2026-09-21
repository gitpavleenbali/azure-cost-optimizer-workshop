import fs from 'node:fs';
import path from 'node:path';
import { appRoot, workshopRoot } from '../server/content.mjs';

const destination = process.argv[2];
if (!destination) throw new Error('Provide a fresh ignored staging directory.');
if (fs.existsSync(destination)) throw new Error('Use a new staging directory; existing data is never removed.');
const app = path.join(destination, 'app');
const guide = path.join(destination, 'guide');
fs.mkdirSync(app, { recursive: true });
fs.mkdirSync(guide, { recursive: true });
for (const relative of ['package.json', 'package-lock.json', 'index.html', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'vite.config.ts', 'src', 'server', 'public']) {
  if (fs.existsSync(path.join(appRoot, relative))) fs.cpSync(path.join(appRoot, relative), path.join(app, relative), { recursive: true });
}
for (const relative of ['README.md', 'docs/assets', 'scripts/prepare-workshop.ps1', 'spec/workshop-delivery-contract.v1.json']) {
  const target = path.join(guide, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(path.join(workshopRoot, relative), target, { recursive: true });
}
fs.copyFileSync(path.join(appRoot, 'Dockerfile'), path.join(destination, 'Dockerfile'));
console.log(JSON.stringify({ staged: true, privateStateIncluded: false, localDatabaseIncluded: false, path: destination }));