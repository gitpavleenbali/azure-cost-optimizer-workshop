import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSqlConnection } from '../server/store-azure.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputsFile = process.argv[2];
if (!outputsFile) throw new Error('Provide the protected foundation outputs file.');
const foundation = JSON.parse(fs.readFileSync(outputsFile, 'utf8'));
const principal = foundation.identityPrincipalId;
if (!/^[0-9a-f-]{36}$/i.test(principal)) throw new Error('Managed identity principal is invalid.');
const connection = await createSqlConnection({ server: foundation.sqlServer, database: foundation.database, local: true, tenantId: process.env.AZURE_TENANT_ID, subscriptionId: process.env.AZURE_SUBSCRIPTION_ID });
try {
  await connection.query(fs.readFileSync(path.join(root, 'server/schema.sql'), 'utf8'));
  const sid = principal.replaceAll('-', '');
  const bytes = sid.slice(0, 8).match(/../g).reverse().join('') + sid.slice(8, 12).match(/../g).reverse().join('') + sid.slice(12, 16).match(/../g).reverse().join('') + sid.slice(16);
  await connection.query(`IF NOT EXISTS(SELECT 1 FROM sys.database_principals WHERE name=N'aco_workshop_app') CREATE USER [aco_workshop_app] WITH SID=0x${bytes}, TYPE=E;
    GRANT SELECT,INSERT,UPDATE,DELETE ON SCHEMA::workshop TO [aco_workshop_app];`);
  console.log(JSON.stringify({ schema: 'initialized', identityAccess: 'DML on workshop schema only', sqlPasswordUsed: false }));
} catch (error) {
  console.error('SQL initialization failed; no credential data logged.', error.code ?? 'SQL_ERROR');
  process.exitCode = 1;
} finally { await connection.close(); }