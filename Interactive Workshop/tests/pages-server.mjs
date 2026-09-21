import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve('dist-pages');
const base = '/azure-cost-optimizer-workshop/';
const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
http.createServer((request, response) => {
  const url = decodeURIComponent(request.url.split('?')[0]);
  if (!url.startsWith(base)) { response.writeHead(404); return response.end(); }
  const relative = url.slice(base.length) || 'index.html';
  let file = path.resolve(root, relative);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  response.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream');
  fs.createReadStream(file).pipe(response);
}).listen(4398, '127.0.0.1');