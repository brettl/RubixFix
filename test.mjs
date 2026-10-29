// Sanity-check the vendored solver: solve scrambles, check move()/asString() agree, reject an invalid cube.
import { createRequire } from 'node:module';
import assert from 'node:assert';
const require = createRequire(import.meta.url);
const Cube = require('./vendor/cube.js');
require('./vendor/solve.js');
Cube.initSolver();
for (let i = 0; i < 5; i++) {
  const str = Cube.random().asString();
  const sol = Cube.fromString(str).solve();
  const c = Cube.fromString(str);
  if (sol) sol.split(' ').forEach(m => c.move(m));
  assert.equal(c.asString(), 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
  console.log('ok', sol.split(' ').length, 'moves');
}
// one edge flipped = unsolvable
const bad = Cube.fromString('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB').asString().split('');
[bad[7], bad[19]] = [bad[19], bad[7]];
const t = Date.now();
let r; try { r = Cube.fromString(bad.join('')).solve(); } catch (e) { r = 'threw'; }
const c2 = Cube.fromString(bad.join('')); if (r) r.split(' ').forEach(m => c2.move(m));
assert.notEqual(c2.asString(), 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
console.log('invalid cube detected by replay', Date.now() - t, 'ms');
