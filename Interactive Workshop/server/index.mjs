import { createApp } from "./app.mjs";
import { createAzureStore } from './store-azure.mjs';
import { createTableStore } from './store-table.mjs';

const host = process.env.WORKSHOP_HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 4310);
const origin = process.env.WORKSHOP_ORIGIN ?? `http://127.0.0.1:${port}`;
const secure = process.env.WORKSHOP_SECURE_COOKIES === "true";
const storage = process.env.WORKSHOP_STORAGE ?? 'sqlite';
const hosted = storage === 'azure' || storage === 'table';
const localOwner = process.env.WORKSHOP_LOCAL_OWNER === 'true';
if (localOwner && !['127.0.0.1', '::1'].includes(host)) throw new Error('Owner setup must remain loopback-only.');
const cloud = {
  blobEndpoint: process.env.WORKSHOP_BLOB_ENDPOINT,
  clientId: process.env.AZURE_CLIENT_ID,
  local: localOwner,
  tenantId: process.env.AZURE_TENANT_ID,
  subscriptionId: process.env.AZURE_SUBSCRIPTION_ID,
};
const store = storage === 'table'
  ? await createTableStore({ ...cloud, tableEndpoint: process.env.WORKSHOP_TABLE_ENDPOINT, tableName: process.env.WORKSHOP_TABLE_NAME ?? 'workshop' })
  : storage === 'azure'
    ? await createAzureStore({ ...cloud, server: process.env.WORKSHOP_SQL_SERVER, database: process.env.WORKSHOP_SQL_DATABASE ?? 'workshop' })
    : undefined;
const service = createApp({
  origin,
  secure,
  dataDir: process.env.WORKSHOP_DATA_DIR,
  trustProxy: process.env.WORKSHOP_TRUST_PROXY === "true",
  hosted: hosted && !localOwner,
  ownerObjectId: process.env.WORKSHOP_OWNER_OBJECT_ID,
  store,
});
if (
  !["127.0.0.1", "::1"].includes(host) &&
  ((!hosted && !await service.hasAdmin()) ||
    !secure ||
    !origin.startsWith("https://") ||
    !process.env.WORKSHOP_INVITE_CODE)
) {
  await service.close();
  throw new Error(
    "Shared hosting requires completed local facilitator setup, HTTPS origin, secure cookies and a workshop invite code.",
  );
}
const server = service.app.listen(port, host, () =>
  console.log(
    `Interactive Workshop: ${origin}\nFacilitator: ${origin}/facilitator\nPersistence: ${storage === 'table' ? 'Azure Table + private Blob' : storage === 'azure' ? 'Azure SQL + private Blob' : 'local SQLite'}. No model calls.`,
  ),
);
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? "Port in use. Choose another PORT and matching WORKSHOP_ORIGIN."
      : "Server failed to start.",
  );
  void service.close();
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await service.close();
      process.exit(0);
    }),
  );
