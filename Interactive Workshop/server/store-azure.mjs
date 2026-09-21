import sql from 'mssql';
import { DefaultAzureCredential, AzureCliCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';

export async function createSqlConnection(config) {
  const credential = config.local ? new AzureCliCredential({ tenantId: config.tenantId, subscription: config.subscriptionId }) : new DefaultAzureCredential({ managedIdentityClientId: config.clientId });
  let pool; let expiration = 0; let connecting;
  async function connect() {
    if (pool?.connected && Date.now() < expiration - 120000) return pool;
    if (connecting) return connecting;
    connecting = (async () => {
      const token = await credential.getToken('https://database.windows.net/.default');
      const next = await new sql.ConnectionPool({ server: config.server, database: config.database, authentication: { type: 'azure-active-directory-access-token', options: { token: token.token } }, options: { encrypt: true, trustServerCertificate: false, abortTransactionOnError: true }, connectionTimeout: 30000, requestTimeout: 30000, pool: { min: 0, max: 8, idleTimeoutMillis: 30000 } }).connect();
      const previous = pool; pool = next; expiration = token.expiresOnTimestamp;
      if (previous) await previous.close();
      return pool;
    })();
    try { return await connecting; } finally { connecting = undefined; }
  }
  const query = async (text, parameters = {}, transaction) => {
    const request = transaction ? new sql.Request(transaction) : (await connect()).request();
    for (const [key, value] of Object.entries(parameters)) request.input(key, typeof value === 'number' ? sql.BigInt : sql.NVarChar(sql.MAX), value);
    return (await request.query(text)).recordset ?? [];
  };
  const transaction = async action => {
    const transaction = new sql.Transaction(await connect());
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try { const result = await action((text, values) => query(text, values, transaction)); await transaction.commit(); return result; }
    catch (error) { await transaction.rollback().catch(() => {}); throw error; }
  };
  await connect();
  return { query, transaction, credential, close: async () => { if (pool) await pool.close(); } };
}

export async function createAzureStore(config) {
  const connection = await createSqlConnection(config);
  const { query, transaction } = connection;
  const blobs = new BlobServiceClient(config.blobEndpoint, connection.credential, { retryOptions: { maxTries: 3, tryTimeoutInMs: 20000 } }).getContainerClient(config.container ?? 'screenshots');
  const first = async (text, values) => (await query(text, values))[0];
  const now = () => new Date().toISOString();
  const queueOld = async (run, userId) => run('INSERT INTO workshop.blob_cleanup(blob_name,queued_at) SELECT blob_name,@now FROM workshop.submissions WHERE user_id=@id AND NOT EXISTS(SELECT 1 FROM workshop.blob_cleanup WHERE blob_name=workshop.submissions.blob_name)', { id: userId, now: now() });
  async function cleanup() {
    for (const row of await query('SELECT TOP (20) blob_name FROM workshop.blob_cleanup ORDER BY queued_at')) {
      try {
        if (await first('SELECT id FROM workshop.submissions WHERE blob_name=@name', { name: row.blob_name })) continue;
        await blobs.getBlockBlobClient(row.blob_name).deleteIfExists();
        await query('DELETE FROM workshop.blob_cleanup WHERE blob_name=@name', { name: row.blob_name });
      } catch { console.warn('Deferred private screenshot cleanup; no identifiers logged.'); }
    }
  }
  const store = {
    kind: 'azure-sql-blob',
    close: connection.close,
    health: async () => { await query('SELECT TOP (1) id FROM workshop.users'); await blobs.getProperties(); return true; },
    audit: (event, actor) => query('INSERT INTO workshop.audit(event,actor,created_at) VALUES(@event,@actor,@now)', { event, actor, now: now() }),
    hasAdmin: async () => !!await first("SELECT TOP (1) id FROM workshop.users WHERE role='admin'"),
    userCount: async () => (await first('SELECT count(*) AS count FROM workshop.users')).count,
    addUser: user => query('INSERT INTO workshop.users(id,name,login,password,salt,role,created_at,last_seen) VALUES(@id,@name,@login,@password,@salt,@role,@createdAt,@createdAt)', user),
    userByLogin: login => first('SELECT * FROM workshop.users WHERE login=@login', { login }),
    participant: id => first("SELECT id FROM workshop.users WHERE id=@id AND role='participant'", { id }),
    session: (token, now) => first('SELECT users.*,sessions.csrf FROM workshop.sessions AS sessions JOIN workshop.users AS users ON users.id=sessions.user_id WHERE token=@token AND expires>@now', { token, now }),
    addSession: (token, id, csrf, expires) => transaction(async run => {
      await run('DELETE FROM workshop.sessions WHERE expires<=@now', { now: Date.now() });
      await run('INSERT INTO workshop.sessions(token,user_id,csrf,expires) VALUES(@token,@id,@csrf,@expires)', { token, id, csrf, expires });
      await run('UPDATE workshop.users SET last_seen=@now WHERE id=@id', { id, now: now() });
    }),
    revokeSession: token => query('DELETE FROM workshop.sessions WHERE token=@token', { token }),
    resetPassword: (id, password, salt) => transaction(async run => { await run('UPDATE workshop.users SET password=@password,salt=@salt WHERE id=@id', { id, password, salt }); await run('DELETE FROM workshop.sessions WHERE user_id=@id', { id }); }),
    progress: (id, revision) => query('SELECT unit,status,note,updated_at AS updatedAt FROM workshop.progress WHERE user_id=@id AND revision=@revision', { id, revision }),
    saveProgress: (id, revision, unit, status, note) => transaction(async run => {
      const values = { id, revision, unit, status, note, now: now() };
      await run('UPDATE workshop.progress WITH(UPDLOCK,HOLDLOCK) SET status=@status,note=@note,updated_at=@now WHERE user_id=@id AND revision=@revision AND unit=@unit; IF @@ROWCOUNT=0 INSERT INTO workshop.progress(user_id,revision,unit,status,note,updated_at) VALUES(@id,@revision,@unit,@status,@note,@now);', values);
    }),
    submission: async id => await first('SELECT id,caption,consent,status,feedback,created_at AS createdAt FROM workshop.submissions WHERE user_id=@id', { id }) ?? null,
    submissionById: id => first('SELECT * FROM workshop.submissions WHERE id=@id', { id }),
    image: async row => {
      if (row.image_bytes > 8 * 1024 * 1024) throw new Error('Stored screenshot exceeds limit.');
      const response = await blobs.getBlockBlobClient(row.blob_name).download(0, undefined, { abortSignal: AbortSignal.timeout(30000) });
      const chunks = []; let size = 0;
      for await (const chunk of response.readableStreamBody) { size += chunk.length; if (size > 8 * 1024 * 1024) { response.readableStreamBody.destroy(); throw new Error('Image limit exceeded.'); } chunks.push(chunk); }
      return Buffer.concat(chunks);
    },
    saveSubmission: async row => {
      const name = `submissions/${row.id}.png`;
      await blobs.getBlockBlobClient(name).uploadData(row.image, { conditions: { ifNoneMatch: '*' }, blobHTTPHeaders: { blobContentType: 'image/png' }, abortSignal: AbortSignal.timeout(30000) });
      try {
        await transaction(async run => {
          const bytes = (await run('SELECT COALESCE(SUM(CAST(image_bytes AS bigint)),0) AS bytes FROM workshop.submissions WITH(UPDLOCK,HOLDLOCK) WHERE user_id<>@id', { id: row.userId }))[0].bytes;
          if (bytes + row.image.length > 500 * 1024 * 1024) throw Object.assign(new Error('Screenshot storage is full.'), { status: 507 });
          await queueOld(run, row.userId);
          await run('DELETE FROM workshop.submissions WHERE user_id=@id', { id: row.userId });
          await run("INSERT INTO workshop.submissions(id,user_id,blob_name,image_bytes,caption,consent,status,feedback,created_at) VALUES(@id,@userId,@blob,@size,@caption,@consent,'pending','',@createdAt)", { id: row.id, userId: row.userId, blob: name, size: row.image.length, caption: row.caption, consent: row.consent, createdAt: row.createdAt });
        });
      } catch (error) {
        try {
          const published = await first('SELECT id FROM workshop.submissions WHERE blob_name=@name', { name });
          if (!published) await query('IF NOT EXISTS(SELECT 1 FROM workshop.blob_cleanup WHERE blob_name=@name) INSERT INTO workshop.blob_cleanup VALUES(@name,@now)', { name, now: now() });
        } catch { console.warn('Screenshot publication outcome requires reconciliation; no content or identifiers logged.'); }
        throw error;
      }
      await cleanup();
    },
    deleteSubmission: async id => { await transaction(async run => { await queueOld(run, id); await run('DELETE FROM workshop.submissions WHERE user_id=@id', { id }); }); await cleanup(); },
    deleteUser: async id => { await transaction(async run => { await queueOld(run, id); await run('DELETE FROM workshop.kudos WHERE user_id=@id', { id }); await run('DELETE FROM workshop.users WHERE id=@id', { id }); }); await cleanup(); },
    approvedSubmissions: () => query("SELECT submissions.id,users.name,submissions.user_id,caption,submissions.created_at AS createdAt FROM workshop.submissions AS submissions JOIN workshop.users AS users ON users.id=submissions.user_id WHERE status='approved' AND consent=1 ORDER BY submissions.created_at DESC"),
    boardState: async () => { const row = await first("SELECT value,updated_at AS releasedAt FROM workshop.settings WHERE [key]='kudos-board-released'"); return { released: row?.value === 'true', releasedAt: row?.value === 'true' ? row.releasedAt : null }; },
    setBoardReleased: async (released, actor) => { const updatedAt = now(); await query("UPDATE workshop.settings SET value=@value,updated_at=@updatedAt,updated_by=@actor WHERE [key]='kudos-board-released'; IF @@ROWCOUNT=0 INSERT INTO workshop.settings([key],value,updated_at,updated_by) VALUES('kudos-board-released',@value,@updatedAt,@actor);", { value: String(released), updatedAt, actor }); return { released, releasedAt: released ? updatedAt : null }; },
    kudos: async (submissionId, userId) => ({ kudos: (await first('SELECT count(*) AS count FROM workshop.kudos WHERE submission_id=@submissionId', { submissionId })).count, applauded: !!await first('SELECT user_id FROM workshop.kudos WHERE submission_id=@submissionId AND user_id=@userId', { submissionId, userId }) }),
    toggleKudos: (submissionId, userId) => transaction(async run => { const exists = await run('SELECT user_id FROM workshop.kudos WITH(UPDLOCK,HOLDLOCK) WHERE submission_id=@submissionId AND user_id=@userId', { submissionId, userId }); if (exists.length) await run('DELETE FROM workshop.kudos WHERE submission_id=@submissionId AND user_id=@userId', { submissionId, userId }); else await run('INSERT INTO workshop.kudos VALUES(@userId,@submissionId)', { userId, submissionId }); }),
    participants: () => query("SELECT id,name,created_at AS createdAt,last_seen AS lastSeen FROM workshop.users WHERE role='participant' ORDER BY created_at DESC"),
    review: (id, status, feedback) => query('UPDATE workshop.submissions SET status=@status,feedback=@feedback WHERE id=@id', { id, status, feedback }),
  };
  if (config.local) await query('SELECT TOP (1) id FROM workshop.users');
  else await store.health();
  return store;
}