import fs from 'node:fs';
import { createApp } from '../server/app.mjs';
import { createTableStore } from '../server/store-table.mjs';

const file = process.argv[2];
if (!file) throw new Error('Provide the protected foundation outputs path.');
const foundation = JSON.parse(fs.readFileSync(file, 'utf8'));
const port = Number(process.env.OWNER_SETUP_PORT ?? 4311);
const store = await createTableStore({ tableEndpoint: foundation.tableEndpoint, tableName: foundation.tableName ?? 'workshop', blobEndpoint: foundation.blobEndpoint, local: true, tenantId: process.env.AZURE_TENANT_ID, subscriptionId: process.env.AZURE_SUBSCRIPTION_ID });
if (await store.hasAdmin()) { await store.close(); console.log('Facilitator already exists. Owner setup is closed.'); }
else {
  const service = createApp({ store, origin: `http://127.0.0.1:${port}`, inviteCode: 'owner-setup-not-for-participant-registration' });
  const server = service.app.listen(port, '127.0.0.1', () => console.log(`Owner-only setup: http://127.0.0.1:${port}/facilitator\nEnter your private passphrase in the browser. This account is stored in Azure Table Storage, not local SQLite.`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await service.close(); process.exit(0); }));
  setTimeout(() => server.close(async () => { await service.close(); process.exit(0); }), 30 * 60 * 1000).unref();
}