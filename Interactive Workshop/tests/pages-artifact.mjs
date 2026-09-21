import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { appRoot, content } from '../server/content.mjs';

test('GitHub Pages artifact is static, base-safe and excludes privileged application code', () => {
  const output = path.join(appRoot, 'dist-pages');
  assert(fs.existsSync(path.join(output, 'index.html')));
  assert(fs.existsSync(path.join(output, 'guide.json')));
  const files = fs.readdirSync(output, { recursive: true }).filter(file => fs.statSync(path.join(output, file)).isFile());
  assert.equal(files.some(file => /(?:\.map|\.sqlite|\.env)$/i.test(file)), false);
  const text = files.filter(file => /\.(?:html|js|json|css)$/i.test(file)).map(file => fs.readFileSync(path.join(output, file), 'utf8')).join('\n');
  assert(text.includes('/azure-cost-optimizer-workshop/'));
  assert.equal(/workshop_session|\/api\/admin|Sign in as facilitator|WORKSHOP_INVITE_CODE/.test(text), false);
  const guide = JSON.parse(fs.readFileSync(path.join(output, 'guide.json'), 'utf8'));
  assert.equal(guide.sections.length, content.sections.length);
  assert.equal(guide.revision, content.revision);
});
