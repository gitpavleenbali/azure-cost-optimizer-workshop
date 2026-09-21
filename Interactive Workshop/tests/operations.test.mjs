import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer, request as httpRequest } from 'node:http';
import { parse } from 'yaml';
import { createApp } from '../server/app.mjs';
import { appRoot, workshopRoot, content } from '../server/content.mjs';

test('CI validates only and companion guide links resolve', () => {
  const text = fs.readFileSync(path.join(workshopRoot, '.github/workflows/validate-interactive-workshop.yml'), 'utf8');
  const workflow = parse(text);
  assert.equal(workflow.permissions.contents, 'read');
  assert.equal(workflow.jobs.companion.defaults.run['working-directory'], 'Interactive Workshop');
  assert(workflow.jobs.companion.steps.some((step) => step.run === 'npm run test:browser'));
  assert(!/secrets\.|azure\/login|gh workflow run/.test(text));
  const readme = fs.readFileSync(path.join(appRoot, 'README.md'), 'utf8');
  for (const link of readme.matchAll(/\]\(([^)]+)\)/g)) if (!link[1].startsWith('http')) assert(fs.existsSync(path.resolve(appRoot, link[1])));
});

test('invite required, unknown hosts and private references rejected', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workshop-boundary-'));
  const server = createServer().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const service = createApp({ dataDir: directory, origin: base, inviteCode: 'test-fixture-invite' });
  server.on('request', service.app);
  const headers = { origin: base, 'content-type': 'application/json' };
  try {
    const hostileHost = await new Promise((resolve, reject) => {
      const outgoing = httpRequest(base + '/api/content', { headers: { host: 'foreign.invalid' } }, (response) => {
        response.resume();
        resolve(response.statusCode);
      });
      outgoing.on('error', reject);
      outgoing.end();
    });
    assert.equal(hostileHost, 403);
    assert.equal((await fetch(base + '/api/setup', { method: 'POST', headers, body: JSON.stringify({ name: 'Boundary admin', password: 'boundary-admin-fixture' }) })).status, 201);
    const registration = { name: 'Invited participant', password: 'boundary-participant-fixture' };
    assert.equal((await fetch(base + '/api/register', { method: 'POST', headers, body: JSON.stringify(registration) })).status, 403);
    assert.equal((await fetch(base + '/api/register', { method: 'POST', headers, body: JSON.stringify({ ...registration, inviteCode: 'test-fixture-invite' }) })).status, 201);
    assert.equal((await fetch(base + '/api/reference?path=.workshop/selection.json', { headers })).status, 404);
    assert.equal((await fetch(base + '/api/reference?path=../.env', { headers })).status, 404);
    const asset = await fetch(base + '/workshop-assets/azure-icons/cost-management.svg', { headers });
    assert.equal(asset.status, 200);
    assert.equal(asset.headers.get('x-content-type-options'), 'nosniff');
    const localLinks = new Set(content.sections.flatMap((section) => [...section.markdown.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1])).filter((link) => !/^https?:/.test(link) && !link.startsWith('#')));
    for (const link of localLinks) {
      const route = link.startsWith('docs/assets/') ? '/workshop-assets/' + link.slice(12) : '/api/reference?path=' + encodeURIComponent(link);
      const response = await fetch(base + route, { headers });
      assert.equal(response.status, 200, 'README reference failed: ' + link);
      assert((await response.arrayBuffer()).byteLength > 0);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    service.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('participant-visible sources contain no private build or credential material', () => {
  const sourceDirectory = path.join(appRoot, 'src');
  const files = [
    path.join(workshopRoot, 'README.md'),
    ...fs
      .readdirSync(sourceDirectory, { recursive: true })
      .filter((file) => /\.(?:css|ts|tsx)$/.test(file))
      .map((file) => path.join(sourceDirectory, file)),
  ];
  const publicText = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  const forbidden = [
    { label: 'developer workspace path', pattern: /[A-Z]:\\(?:Users|CodeSpace)\\/i },
    { label: 'private key', pattern: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/ },
    { label: 'storage account key', pattern: /AccountKey\s*=\s*[^;\s]+/i },
    { label: 'SAS signature', pattern: /[?&]sig=[A-Za-z0-9%/+_-]{16,}/i },
    { label: 'bearer token', pattern: /Bearer\s+[A-Za-z0-9._~-]{24,}/i },
    { label: 'OpenAI-style secret', pattern: /\bsk-[A-Za-z0-9_-]{16,}\b/ },
    { label: 'test-only participant copy', pattern: /Browser-tested local workshop result|Temporary save failure|test-fixture/i },
  ];
  for (const item of forbidden) assert.equal(item.pattern.test(publicText), false, `Public surface contains ${item.label}.`);
});

test('canonical participant sections are available', () => {
  assert.ok(content.sections.length > 0);
});
