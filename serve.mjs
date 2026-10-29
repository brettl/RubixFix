// Tiny static server for dist/ (no dependencies). localhost counts as a secure origin, so the camera works.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const port = Number(process.argv[2]) || 5210;
createServer(async (req, res) => {
  try {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(await readFile(new URL('dist/index.html', import.meta.url)));
  } catch {
    res.writeHead(500).end('dist/index.html missing - run: rubixfix.bat build');
  }
}).listen(port, '127.0.0.1', () => console.log(`RubixFix on http://localhost:${port}`));
