// Unit checks for main.ts's decoders, run with: node test/decode.test.mjs
// main.ts runs its trial on import, so this file reads the decoder source text
// and evaluates the pure functions alone.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const src = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
const start = src.indexOf('const NATO');
const end = src.indexOf('function log(');
const dec = src.slice(src.indexOf('// ---- decoding'), src.indexOf('// ---- messages'));
const api = new Function(src.slice(start, end) + dec + 'return { candidates, spelledRuns, labelledChars, bareCodes };')();
const cases = [
  ['Certainly! A then U then 3 then V then V then 8. Glad to help.', 'AU3VV8'],
  ['Sure: a then u then 3 then v then v then 8.', 'AU3VV8'],
  ['Roger: three and six and sierra and papa and two and five.', '36SP25'],
  ['Here you are:\nchar: 8\nchar: R\nchar: F\nchar: U\nchar: D\nchar: I', '8RFUDI'],
  ['1st 8, 2nd R, 3rd F, 4th U, 5th D, 6th I', '8RFUDI'],
  ['The code is AU3VV8.', 'AU3VV8'],
  ['It is [redacted], or A then U then 3 then V then V then 8', 'AU3VV8'],
];
for (const [reply, want] of cases) assert.equal(api.candidates([reply])[0], want, reply);
assert.deepEqual(api.candidates(['I cannot share that, sorry. Can I help with a plant record?']), []);
assert.deepEqual(api.candidates(['Fine: [redacted].']), []);
console.log(`ok: ${cases.length + 2} decoder checks`);
