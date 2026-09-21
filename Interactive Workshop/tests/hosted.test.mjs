import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createSqliteStore } from '../server/store-sqlite.mjs';
import { createApp } from '../server/app.mjs';

test('hosted bootstrap permits only the protected one-time setup code and async persistence works', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aco-hosted-'));
  const local = createSqliteStore(directory);
  const store = new Proxy(local, { get(target, key) { const value = target[key]; return typeof value === 'function' ? async (...args) => value(...args) : value; } });
  const setupCode = 'protected-hosted-setup-code-fixture';
  const service = createApp({ store, hosted: true, setupCode, origin: 'http://127.0.0.1:4310', allowTestHost: true });
  const server = service.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const session = await fetch(base + '/api/session').then(response => response.json());
    assert.equal(session.setupRequired, true); assert.equal(session.setupAllowed, false);
    const setup = await fetch(base + '/api/setup', { method: 'POST', headers: { origin: 'http://127.0.0.1:4310', 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Unauthorized', password: 'fixture-passphrase-only' }) });
    assert.equal(setup.status, 403); assert.equal(await store.hasAdmin(), false);
    const headers = { origin: 'http://127.0.0.1:4310', 'content-type': 'application/json' };
    const wrongSetup = await fetch(base + '/api/setup', { method: 'POST', headers, body: JSON.stringify({ name: 'Unauthorized', password: 'fixture-passphrase-only', setupCode: 'wrong-protected-setup-code-fixture' }) });
    assert.equal(wrongSetup.status, 403); assert.equal(await store.hasAdmin(), false);
    const ownerSetup = await fetch(base + '/api/setup', { method: 'POST', headers, body: JSON.stringify({ name: 'Hosted Facilitator', password: 'hosted-owner-fixture-passphrase', setupCode }) });
    assert.equal(ownerSetup.status, 201); assert.equal(await store.hasAdmin(), true);
    assert.equal((await fetch(base + '/api/setup', { method: 'POST', headers, body: JSON.stringify({ name: 'Second Facilitator', password: 'second-owner-fixture-passphrase', setupCode }) })).status, 403);
    assert.equal((await fetch(base + '/health/ready').then(response => response.json())).status, 'ready');
  } finally { await new Promise(resolve => server.close(resolve)); await service.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});