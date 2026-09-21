import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { tableStore } from '../server/store-table.mjs';

function fixtures() {
  let rows = new Map(); let version = 0;
  const error = statusCode => Object.assign(new Error('Fixture storage response'), { statusCode });
  const table = {
    getEntity: async (_partition, key) => { if (!rows.has(key)) throw error(404); return structuredClone(rows.get(key)); },
    createEntity: async row => table.submitTransaction([['create', row]]),
    deleteEntity: async (_partition, key, options) => table.submitTransaction([['delete', { rowKey: key }, options]]),
    listEntities: async function* ({ queryOptions }) { const prefix = /RowKey ge '([^']*)'/.exec(queryOptions.filter)[1]; for (const [key, row] of [...rows].sort()) if (key.startsWith(prefix)) yield structuredClone(row); },
    submitTransaction: async actions => {
      const copy = new Map(rows);
      for (const [operation, entity, mode, options] of actions) {
        const before = copy.get(entity.rowKey);
        if (operation === 'create' && before) throw error(409);
        if (operation !== 'create' && (!before || before.etag !== (operation === 'delete' ? mode.etag : options.etag))) throw error(412);
        if (operation === 'delete') copy.delete(entity.rowKey); else copy.set(entity.rowKey, { ...entity, etag: String(++version) });
      }
      rows = copy;
    },
  };
  const images = new Map();
  const blobs = { getProperties: async () => ({}), getBlockBlobClient: name => ({ uploadData: async bytes => { if (images.has(name)) throw error(409); images.set(name, Buffer.from(bytes)); }, download: async () => ({ readableStreamBody: Readable.from([images.get(name)]) }), deleteIfExists: async () => images.delete(name) }) };
  return { table, blobs, images };
}
test('Table contract: single owner, ETags, progress, sessions, private image metadata and restart', async () => {
  const fixture = fixtures(); let store = tableStore(fixture.table, fixture.blobs);
  const account = id => ({ id, name: id, login: id, password: 'fixture-hash', salt: 'fixture-salt', role: 'participant', createdAt: new Date().toISOString() });
  await store.addUser({ ...account('owner'), role: 'admin' });
  await assert.rejects(store.addUser({ ...account('other-owner'), role: 'admin' }));
  const duplicates = await Promise.allSettled([store.addUser(account('alice')), store.addUser({ ...account('different-id'), login: 'alice' })]);
  assert.equal(duplicates.filter(result => result.status === 'fulfilled').length, 1);
  const alice = await store.userByLogin('alice');
  await store.addSession('token', alice.id, 'csrf', Date.now() + 10000);
  assert.equal((await store.session('token', Date.now())).id, alice.id);
  await store.saveProgress(alice.id, 'v1', 'step-1', 'done', 'Checked');
  store = tableStore(fixture.table, fixture.blobs);
  assert.equal((await store.progress(alice.id, 'v1'))[0].note, 'Checked');
  assert.equal((await store.progress('owner', 'v1')).length, 0);
  await store.saveSubmission({ id: 'proof', userId: alice.id, image: Buffer.from('fixture'), caption: 'Result', consent: 1, createdAt: new Date().toISOString() });
  assert.equal((await store.approvedSubmissions()).length, 0);
  await store.review('proof', 'approved', 'Reviewed');
  assert.equal((await store.approvedSubmissions()).length, 1);
  assert.deepEqual(await store.boardState(), { released: false, releasedAt: null });
  assert.equal((await store.setBoardReleased(true, 'owner')).released, true);
  store = tableStore(fixture.table, fixture.blobs);
  assert.equal((await store.boardState()).released, true);
  assert.equal((await store.setBoardReleased(false, 'owner')).released, false);
  await store.toggleKudos('proof', 'owner');
  assert.equal((await store.kudos('proof', 'owner')).kudos, 1);
  assert.equal((await store.image(await store.submissionById('proof'))).toString(), 'fixture');
  await store.resetPassword(alice.id, 'changed', 'changed');
  assert.equal(await store.session('token', Date.now()), null);
  await store.saveSubmission({ id: 'replacement', userId: alice.id, image: Buffer.from('replacement'), caption: 'Private', consent: 0, createdAt: new Date().toISOString() });
  assert.equal(await store.submissionById('proof'), null);
  assert.equal(fixture.images.has('submissions/proof.png'), false);
  await store.deleteUser(alice.id);
  assert.equal(await store.userByLogin('alice'), null);
  assert.equal(await store.submissionById('replacement'), null);
  assert.equal(fixture.images.size, 0);
  assert.equal(await store.userCount(), 1);
});