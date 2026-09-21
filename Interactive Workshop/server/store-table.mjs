import { createHash, randomUUID } from 'node:crypto';
import { TableClient, odata } from '@azure/data-tables';
import { AzureCliCredential, DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';

const partitionKey = 'workshop-v1';
const hash = value => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
const conflict = error => [409, 412].includes(error.statusCode);
const fault = (message, status = 409) => Object.assign(new Error(message), { status });

export function tableStore(table, blobs) {
  const entity = (rowKey, value) => ({ partitionKey, rowKey, value: JSON.stringify(value) });
  const get = async rowKey => {
    try { const row = await table.getEntity(partitionKey, rowKey, { abortSignal: AbortSignal.timeout(20000) }); return { ...JSON.parse(row.value), etag: row.etag, rowKey }; }
    catch (error) { if (error.statusCode === 404) return null; throw error; }
  };
  const list = async (prefix, limit = 6000) => {
    const result = [];
    const queryOptions = { filter: odata`PartitionKey eq ${partitionKey} and RowKey ge ${prefix} and RowKey lt ${prefix + '~'}` };
    for await (const row of table.listEntities({ queryOptions, abortSignal: AbortSignal.timeout(30000) })) {
      if (result.length >= limit) throw fault('Workshop query limit reached.', 503);
      result.push({ ...JSON.parse(row.value), etag: row.etag, rowKey: row.rowKey });
    }
    return result;
  };
  const update = (row, value) => ['update', entity(row.rowKey, value), 'Replace', { etag: row.etag }];
  const remove = row => ['delete', { partitionKey, rowKey: row.rowKey }, { etag: row.etag }];
  const create = (key, value) => ['create', entity(key, value)];
  const commit = actions => table.submitTransaction(actions, { abortSignal: AbortSignal.timeout(30000) });
  const retry = async action => {
    for (let attempt = 0; ; attempt++) {
      try { return await action(); } catch (error) { if (!conflict(error) || attempt >= 2) throw error; }
    }
  };
  const stats = async () => await get('stats') ?? { users: 0, imageBytes: 0, rowKey: 'stats' };
  const statsAction = (before, value) => before.etag ? update(before, value) : create('stats', value);
  const user = async id => { const row = await get('user.' + id); return row && !row.deleted ? row : null; };
  const requireUser = async id => { const row = await user(id); if (!row) throw fault('Account unavailable.', 401); return row; };
  const metadata = row => row ? ({ id: row.id, caption: row.caption, consent: row.consent, status: row.status, feedback: row.feedback, createdAt: row.createdAt }) : null;
  async function submissionById(id) {
    const index = await get('image.' + id);
    if (!index || !await user(index.userId)) return null;
    const row = await get('submission.' + index.userId);
    return row?.id === id ? { ...row, user_id: row.userId } : null;
  }
  async function cleanup() {
    let processed = 0;
    const queryOptions = { filter: odata`PartitionKey eq ${partitionKey} and RowKey ge ${'cleanup.'} and RowKey lt ${'cleanup.~'}` };
    for await (const row of table.listEntities({ queryOptions, abortSignal: AbortSignal.timeout(30000) })) {
      if (processed++ >= 20) break;
      const pending = JSON.parse(row.value);
      try {
        if (await get('image.' + pending.id)) continue;
        await blobs.getBlockBlobClient(pending.blobName).deleteIfExists({ abortSignal: AbortSignal.timeout(20000) });
        await table.deleteEntity(partitionKey, row.rowKey, { etag: row.etag, abortSignal: AbortSignal.timeout(20000) });
      } catch { console.warn('Private screenshot cleanup deferred.'); }
    }
  }
  const store = {
    kind: 'azure-table-blob', close: () => {},
    health: async () => { await get('stats'); await blobs.getProperties({ abortSignal: AbortSignal.timeout(20000) }); return true; },
    audit: (event, actor) => table.createEntity(entity('audit.' + randomUUID(), { event, actor, createdAt: now() }), { abortSignal: AbortSignal.timeout(20000) }),
    hasAdmin: async () => !!await get('facilitator'),
    userCount: async () => (await stats()).users,
    addUser: async account => retry(async () => {
      const loginKey = 'login.' + hash(account.login);
      if (await get(loginKey) || (account.role === 'admin' && await get('facilitator'))) throw fault('Account already exists.');
      const before = await stats();
      if (before.users >= 5000) throw fault('Participant limit reached.');
      const actions = [create('user.' + account.id, { ...account, lastSeen: account.createdAt, securityVersion: randomUUID() }), create(loginKey, { userId: account.id }), statsAction(before, { users: before.users + 1, imageBytes: before.imageBytes })];
      if (account.role === 'admin') actions.push(create('facilitator', { userId: account.id }));
      await commit(actions);
    }),
    userByLogin: async login => { const row = await get('login.' + hash(login)); return row ? user(row.userId) : null; },
    participant: async id => { const row = await user(id); return row?.role === 'participant' ? { id } : null; },
    session: async (token, time) => {
      const row = await get('session.' + token);
      if (!row || row.expires <= time) return null;
      const account = await user(row.userId);
      return account?.securityVersion === row.securityVersion ? { ...account, csrf: row.csrf } : null;
    },
    addSession: (token, id, csrf, expires) => retry(async () => {
      const account = await requireUser(id);
      await commit([create('session.' + token, { userId: id, csrf, expires, securityVersion: account.securityVersion }), update(account, { ...account, lastSeen: now() })]);
    }),
    revokeSession: async token => { const row = await get('session.' + token); if (row) await commit([remove(row)]); },
    resetPassword: (id, password, salt) => retry(async () => { const account = await requireUser(id); await commit([update(account, { ...account, password, salt, securityVersion: randomUUID() })]); }),
    progress: async (id, revision) => (await list('progress.' + id + '.' + hash(revision) + '.', 300)).map(({ unit, status, note, updatedAt }) => ({ unit, status, note, updatedAt })),
    saveProgress: (id, revision, unit, status, note) => retry(async () => {
      const account = await requireUser(id);
      const key = 'progress.' + id + '.' + hash(revision) + '.' + hash(unit);
      const before = await get(key);
      const value = { unit, status, note, updatedAt: now() };
      await commit([update(account, { ...account, lastSeen: now() }), before ? update(before, value) : create(key, value)]);
    }),
    submission: async id => await user(id) ? metadata(await get('submission.' + id)) : null,
    submissionById,
    image: async row => {
      const response = await blobs.getBlockBlobClient(row.blobName).download(0, undefined, { abortSignal: AbortSignal.timeout(30000) });
      const chunks = []; let size = 0;
      for await (const chunk of response.readableStreamBody) { size += chunk.length; if (size > 8 * 1024 * 1024) { response.readableStreamBody.destroy(); throw fault('Image too large.', 413); } chunks.push(chunk); }
      return Buffer.concat(chunks);
    },
    saveSubmission: async row => {
      const blobName = 'submissions/' + row.id + '.png';
      await blobs.getBlockBlobClient(blobName).uploadData(row.image, { conditions: { ifNoneMatch: '*' }, blobHTTPHeaders: { blobContentType: 'image/png' }, abortSignal: AbortSignal.timeout(30000) });
      try {
        await retry(async () => {
          const account = await requireUser(row.userId);
          const old = await get('submission.' + row.userId);
          const before = await stats();
          const imageBytes = before.imageBytes - (old?.imageBytes ?? 0) + row.image.length;
          if (imageBytes > 500 * 1024 * 1024) throw fault('Screenshot storage is full.', 507);
          const value = { id: row.id, userId: row.userId, blobName, imageBytes: row.image.length, caption: row.caption, consent: row.consent, status: 'pending', feedback: '', createdAt: row.createdAt };
          const actions = [update(account, { ...account, lastSeen: now() }), statsAction(before, { users: before.users, imageBytes }), old ? update(old, value) : create('submission.' + row.userId, value), create('image.' + row.id, { userId: row.userId })];
          if (old) { const oldIndex = await get('image.' + old.id); if (oldIndex) actions.push(remove(oldIndex)); actions.push(create('cleanup.' + old.id, { id: old.id, blobName: old.blobName })); }
          await commit(actions);
        });
      } catch (error) {
        console.warn('Screenshot publication incomplete; retain unreferenced bytes for reconciliation.');
        throw error;
      }
      await cleanup();
    },
    deleteSubmission: async id => {
      await retry(async () => {
        const old = await get('submission.' + id); if (!old) return;
        const before = await stats(); const index = await get('image.' + old.id);
        const actions = [remove(old), statsAction(before, { users: before.users, imageBytes: before.imageBytes - old.imageBytes }), create('cleanup.' + old.id, { id: old.id, blobName: old.blobName })];
        if (index) actions.push(remove(index)); await commit(actions);
      });
      await cleanup();
    },
    deleteUser: async id => {
      await retry(async () => { const account = await user(id); if (!account) return; if (account.role === 'admin') throw fault('Facilitator cannot be deleted.', 403); const before = await stats(); await commit([update(account, { ...account, deleted: true, securityVersion: randomUUID() }), statsAction(before, { users: before.users - 1, imageBytes: before.imageBytes })]); });
      await store.deleteSubmission(id);
      const account = await get('user.' + id);
      if (!account) return;
      const rows = [...await list('progress.' + id + '.', 3000), ...(await list('session.', 20000)).filter(row => row.userId === id), ...(await list('kudos.', 25000)).filter(row => row.userId === id)];
      for (let offset = 0; offset < rows.length; offset += 90) await commit(rows.slice(offset, offset + 90).map(remove));
      const login = await get('login.' + hash(account.login));
      await commit([remove(account), ...(login ? [remove(login)] : [])]);
    },
    approvedSubmissions: async () => {
      const rows = await list('submission.'); const result = [];
      for (const row of rows) { if (row.status !== 'approved' || !row.consent) continue; const account = await user(row.userId); if (account) result.push({ id: row.id, user_id: row.userId, name: account.name, caption: row.caption, createdAt: row.createdAt }); }
      return result.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
    boardState: async () => { const row = await get('kudos-board'); return { released: row?.released === true, releasedAt: row?.released === true ? row.releasedAt : null }; },
    setBoardReleased: (released, actor) => retry(async () => {
      const before = await get('kudos-board');
      const value = { released, releasedAt: released ? now() : null, updatedBy: actor };
      await commit([before ? update(before, value) : create('kudos-board', value)]);
      return { released: value.released, releasedAt: value.releasedAt };
    }),
    kudos: async (submissionId, userId) => { const rows = await list('kudos.' + submissionId + '.'); let count = 0; for (const row of rows) if (await user(row.userId)) count++; return { kudos: count, applauded: rows.some(row => row.userId === userId) }; },
    toggleKudos: (submissionId, userId) => retry(async () => {
      const row = await submissionById(submissionId); if (!row || row.status !== 'approved' || !row.consent) throw fault('Submission unavailable.');
      const key = 'kudos.' + submissionId + '.' + userId; const before = await get(key);
      await commit([update(row, { ...row }), before ? remove(before) : create(key, { userId })]);
    }),
    participants: async () => (await list('user.')).filter(row => row.role === 'participant' && !row.deleted).map(({ id, name, createdAt, lastSeen }) => ({ id, name, createdAt, lastSeen })),
    review: (id, status, feedback) => retry(async () => { const row = await submissionById(id); if (!row) throw fault('Submission missing.', 404); await commit([update(row, { ...row, status, feedback })]); }),
  };
  return store;
}

export async function createTableStore(config) {
  const credential = config.local ? new AzureCliCredential(config.subscriptionId ? { subscription: config.subscriptionId } : { tenantId: config.tenantId }) : new DefaultAzureCredential({ managedIdentityClientId: config.clientId });
  const table = new TableClient(config.tableEndpoint, config.tableName ?? 'workshop', credential, { retryOptions: { maxRetries: 0 } });
  const blobs = new BlobServiceClient(config.blobEndpoint, credential, { retryOptions: { maxTries: 2, tryTimeoutInMs: 20000 } }).getContainerClient('screenshots');
  const store = tableStore(table, blobs);
  await store.health();
  return store;
}