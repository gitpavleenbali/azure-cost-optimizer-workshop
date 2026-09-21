import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';

const file = process.argv[2];
if (!file) throw new Error('Provide the protected owner setup state path.');
const state = JSON.parse(fs.readFileSync(file, 'utf8'));
const target = new URL(state.url);
if (target.protocol !== 'https:' || typeof state.setupCode !== 'string' || state.setupCode.length < 32)
  throw new Error('Protected owner setup state is incomplete.');

const port = Number(process.env.OWNER_SETUP_PORT ?? 4311);
const nonce = randomBytes(24).toString('base64url');
const page = (message = '', success = false) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Workshop facilitator setup</title><style>body{font:16px/1.5 system-ui;margin:0;background:#f3f7f8;color:#17313b}main{max-width:34rem;margin:8vh auto;padding:2rem;background:#fff;border:1px solid #bfd0d4;border-radius:8px}label{display:block;margin:1rem 0}input{box-sizing:border-box;width:100%;padding:.7rem}button{padding:.7rem 1rem;background:#087f68;color:#fff;border:0;border-radius:4px}p{overflow-wrap:anywhere}.error{color:#a4262c}.success{color:#087f68}</style></head>
<body><main><h1>Facilitator setup</h1><p>This loopback page creates the one workshop facilitator. Your passphrase is sent directly to the hosted tracker and is never written to this computer.</p>
${message ? `<p class="${success ? 'success' : 'error'}">${message}</p>` : ''}
${success ? '' : `<form method="post" action="/setup"><input type="hidden" name="nonce" value="${nonce}"><label>Facilitator name<input name="name" minlength="2" maxlength="60" required autocomplete="name"></label><label>Private workshop passphrase<input name="password" type="password" minlength="12" maxlength="128" required autocomplete="new-password"></label><button type="submit">Create facilitator</button></form>`}
</main></body></html>`;

const server = http.createServer(async (request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  if (request.method === 'GET' && request.url === '/') return response.end(page());
  if (request.method !== 'POST' || request.url !== '/setup') { response.statusCode = 404; return response.end(page('Page unavailable.')); }
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 4096) { request.destroy(); return; }
  }
  const form = new URLSearchParams(body);
  if (form.get('nonce') !== nonce) { response.statusCode = 403; return response.end(page('Setup confirmation expired.')); }
  const setup = await fetch(new URL('/api/setup', target), {
    method: 'POST',
    redirect: 'error',
    headers: { origin: target.origin, 'content-type': 'application/json' },
    body: JSON.stringify({ name: form.get('name'), password: form.get('password'), setupCode: state.setupCode }),
  });
  const result = await setup.json();
  if (!setup.ok) { response.statusCode = setup.status; return response.end(page(result.error ?? 'Facilitator setup failed.')); }
  response.end(page(`Facilitator created. Continue at ${target.origin}/facilitator`, true));
  setTimeout(() => server.close(), 1000).unref();
});

server.listen(port, '127.0.0.1', () => console.log(`Owner-only setup: http://127.0.0.1:${port}/\nEnter the private passphrase in the browser. The protected setup code is not sent to the browser.`));
setTimeout(() => server.close(), 30 * 60 * 1000).unref();