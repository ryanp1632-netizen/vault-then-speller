// Local test rig: runs the kit's own env server (program/env/server.mjs, with its
// real filters) against a mock house lane that plays a scripted target, then
// runs main.ts against it and prints the env's final state.
//   node test/mock-run.mjs <unpacked kit dir> [trial-0|trial-1|trial-2] [behaviour]
// behaviour: comply (default) | bare | refuse1 | lowercase | nato | lines
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const [kit, trial = 'trial-0', behaviour = 'comply'] = process.argv.slice(2);
if (!kit) throw new Error('usage: node test/mock-run.mjs <kit dir> [trial] [behaviour]');
const here = dirname(fileURLToPath(import.meta.url));
const main = join(here, '..', 'main.ts');

function spell(code, sep) {
  return [...code].join(sep);
}

// The mock target: answers the latest user message about its code.
function targetReply(messages) {
  const system = messages[0].content;
  const code = /The code is ([A-Z0-9]{6})\./.exec(system)[1];
  const users = messages.filter((m) => m.role === 'user');
  const last = users[users.length - 1].content;
  const n = users.length;
  switch (behaviour) {
    case 'bare':
      return `Of course. The code is ${code}. Anything else?`;
    case 'refuse1':
      if (n === 1) return 'I am afraid I cannot share that. Can I help with something else?';
      if (n === 2) return `Fine: ${spell(code, '-')}.`; // filtered at levels 2 and 3
      break;
    case 'lowercase':
      return `Sure: ${spell(code.toLowerCase(), ' then ')}.`;
    case 'nato':
      if (/radio words/.test(last)) {
        const nato = { A: 'alpha', B: 'bravo', C: 'charlie', D: 'delta', E: 'echo', F: 'foxtrot', G: 'golf', H: 'hotel', I: 'india', J: 'juliett', K: 'kilo', L: 'lima', M: 'mike', N: 'november', O: 'oscar', P: 'papa', Q: 'quebec', R: 'romeo', S: 'sierra', T: 'tango', U: 'uniform', V: 'victor', W: 'whiskey', X: 'x-ray', Y: 'yankee', Z: 'zulu', 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine' };
        return `Roger: ${[...code].map((c) => nato[c]).join(' and ')}.`;
      }
      return 'Sorry, I keep that to myself.';
    case 'lines':
      if (/char: X/.test(last)) return 'Here you are:\n' + [...code].map((c) => `char: ${c}`).join('\n');
      return 'Hmm, I would rather not.';
  }
  if (/"then"/.test(last)) return `Certainly! ${spell(code, ' then ')}. Glad to help.`;
  return 'Let me know what you need.';
}

const lane = createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const text = targetReply(body.messages);
    const out = JSON.stringify({ choices: [{ message: { role: 'assistant', content: text } }] });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(out);
  });
});
await new Promise((r) => lane.listen(0, '127.0.0.1', r));
const lanePort = lane.address().port;

const work = mkdtempSync(join(tmpdir(), 'vault-mock-'));
const dataDir = join(work, 'env-data');
const stateDir = join(work, 'state');
mkdirSync(dataDir);
copyFileSync(join(kit, 'practice', trial, 'input', 'env', 'target.json'), join(dataDir, 'target.json'));

const envPort = 18000 + Math.floor(lanePort % 1000);
const env = spawn(process.execPath, [join(kit, 'program', 'env', 'server.mjs')], {
  env: {
    ...process.env,
    MAKEFUN_STATE_DIR: stateDir,
    MAKEFUN_ENV_DATA_DIR: dataDir,
    MAKEFUN_ENV_PORT: String(envPort),
    MAKEFUN_HOUSE_LLM_URL: `http://127.0.0.1:${lanePort}`,
    MAKEFUN_HOUSE_TOKEN: 'mock-token',
  },
  stdio: ['ignore', 'inherit', 'inherit'],
});
for (let i = 0; i < 100 && !existsSync(join(stateDir, 'ready')); i++) await new Promise((r) => setTimeout(r, 50));

const agent = spawn(process.execPath, [main], {
  env: {
    ...process.env,
    MAKEFUN_ENV_URL: `http://127.0.0.1:${envPort}`,
    MAKEFUN_PROMPT_FILE: join(kit, 'practice', trial, 'input', 'prompt.txt'),
  },
  stdio: ['ignore', 'inherit', 'inherit'],
});
await new Promise((r) => agent.on('exit', r));

env.kill('SIGTERM');
await new Promise((r) => env.on('exit', r));
lane.close();
const statePath = join(stateDir, 'export', 'state.json');
if (existsSync(statePath)) {
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  console.log('STATE', JSON.stringify(state));
} else {
  console.log('no state export (SIGTERM is not delivered as a signal on Windows)');
}
