import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSqliteStore } from '../server/store-sqlite.mjs';

test('store preserves local behavior and permits only one facilitator', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aco-store-'));
  const store = createSqliteStore(directory);
  try {
    await store.addUser({ id: 'owner', name: 'Owner', login: 'owner', password: 'fixture-hash', salt: 'fixture-salt', role: 'admin', createdAt: new Date().toISOString() });
    assert(await store.hasAdmin());
    assert.throws(() => store.addUser({ id: 'other', name: 'Other', login: 'other', password: 'fixture', salt: 'fixture', role: 'admin', createdAt: new Date().toISOString() }));
    await store.saveProgress('owner', 'revision', 'step-1', 'blocked', 'Access pending');
    assert.equal((await store.progress('owner', 'revision'))[0].note, 'Access pending');
    await store.addSession('tokenhash', 'owner', 'csrf', Date.now() + 10000);
    assert.equal((await store.session('tokenhash', Date.now())).name, 'Owner');
    await store.resetPassword('owner', 'new-fixture-hash', 'new-fixture-salt');
    assert.equal(await store.session('tokenhash', Date.now()), undefined);
  } finally { store.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});