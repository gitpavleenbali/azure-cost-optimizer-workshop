import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { content, workshopRoot, appRoot } from '../server/content.mjs';

const publicDirectory = path.join(appRoot, 'public-pages');
const outputDirectory = path.join(appRoot, 'dist-pages');
fs.rmSync(publicDirectory, { recursive: true, force: true });
fs.mkdirSync(path.join(publicDirectory, 'workshop-assets'), { recursive: true });
fs.writeFileSync(path.join(publicDirectory, 'guide.json'), JSON.stringify(content));
fs.cpSync(path.join(workshopRoot, 'docs', 'assets'), path.join(publicDirectory, 'workshop-assets'), { recursive: true });
execFileSync(process.execPath, [path.join(appRoot, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--config', 'vite.pages.config.ts'], { cwd: appRoot, stdio: 'inherit' });
fs.renameSync(path.join(outputDirectory, 'pages.html'), path.join(outputDirectory, 'index.html'));
fs.writeFileSync(path.join(outputDirectory, '.nojekyll'), '');
fs.rmSync(publicDirectory, { recursive: true, force: true });

const files = fs.readdirSync(outputDirectory, { recursive: true });
if (files.some(file => /(?:workshop\.sqlite|\.env|\.map)$/i.test(file))) throw new Error('Private or debug material entered the Pages artifact.');
console.log(JSON.stringify({ pagesBuilt: true, sections: content.sections.length, revision: content.revision }));