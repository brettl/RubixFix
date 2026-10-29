// Inlines CSS, the cubejs solver (vendor/) and the app into one self-contained dist/index.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const parts = {
  CSS: read('src/style.css'),
  CUBE: read('vendor/cube.js'),
  SOLVE: read('vendor/solve.js'),
  APP: read('src/app.js'),
};
let html = read('src/index.template.html');
for (const [k, v] of Object.entries(parts)) {
  if (/<\/script/i.test(v)) throw new Error(`${k} contains </script`);
  html = html.split(`/*{{${k}}}*/`).join(v);
}
mkdirSync(new URL('dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('dist/index.html', import.meta.url), html);
console.log(`dist/index.html  ${(html.length / 1024).toFixed(0)} KB`);
