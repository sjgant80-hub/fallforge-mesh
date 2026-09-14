#!/usr/bin/env node
// demo.mjs — a real coupled mesh, exercised. Builds the mesh from the two minted manifests,
// runs a genuine cross-verification (three LOCAL models answer one triage message; the kernel
// takes the deterministic quorum — no judge), and records the coupling-health + shared-limb
// facts the kernel computes. All local, on Simon's electric.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { buildMesh, coupleHealth, quorum, makeMeshLimb, borrowLimb, routeAsk, verifyMesh } from './kernel.mjs';

const OLLAMA = process.env.OLLAMA_URL || 'http://localhost:11434';
const MANI = (n) => 'C:/Users/sjgan/fallforge-mint/out/' + n + '.manifest.json';

const members = [];
for (const [node, useCase] of [['triage-1b', 'support-triage'], ['review-1b', 'code-review']]) {
  if (!existsSync(MANI(node))) { console.error('missing manifest for ' + node); process.exit(1); }
  const m = JSON.parse(readFileSync(MANI(node), 'utf8'));
  members.push({ node: m.node, useCase, manifestHash: m.hash });
}
const mesh = buildMesh(members, 20);
if (!mesh.ok) { console.error('mesh refused: ' + mesh.why); process.exit(1); }
if (verifyMesh(mesh.mesh).valid !== true) { console.error('mesh self-verify failed'); process.exit(1); }
writeFileSync('demo/mesh.json', JSON.stringify(mesh.mesh, null, 2) + '\n');
console.log('mesh built: ' + mesh.mesh.count + ' members, shared limb budget ' + mesh.mesh.sharedLimbBudget);

const TASK = 'Read this support message. Reply with ONLY {"category": one of refund|shipping|account|bug|other}. No prose.';
const MSG = 'My subscription was double-charged this month on order 5512, please refund the extra charge.';
async function ask(model) {
  const res = await fetch(OLLAMA + '/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt: TASK + '\n\nMessage:\n' + MSG, stream: true, options: { temperature: 0, num_predict: 60 } }) });
  let out = '', buf = '';
  const reader = res.body.getReader(); const dec = new TextDecoder();
  for (;;) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true });
    let nl; while ((nl = buf.indexOf('\n')) !== -1) { const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1); if (!line) continue; try { const j = JSON.parse(line); if (j.response) out += j.response; } catch (e) {} } }
  return out;
}
// canonicalize each model's answer to the same shape so the quorum compares the SEMANTIC
// category, not incidental formatting (quotes/spacing differ model to model)
function category(text) { const m = text.match(/category"?\s*:\s*"?([a-z]+)/i); return m ? '{"category":"' + m[1].toLowerCase() + '"}' : '(no category)'; }

const models = ['triage-1b', 'qwen2.5:7b', 'qwen2.5:14b'];
const raw = [];
for (const model of models) { const a = await ask(model); raw.push({ model, answer: category(a) }); console.log('  ' + model + ' → ' + category(a)); }
const q = quorum(raw.map((r) => r.answer));
console.log('quorum: ' + (q.verified ? 'VERIFIED ' + q.answer + ' (' + q.agree + '/' + q.of + ')' : 'no quorum (' + q.why + ')'));

// coupling-health snapshots the kernel classifies (illustrative interaction records)
const couples = [
  { pair: 'triage-1b × qwen2.5:7b', rec: { interactions: 50, aChecks: 30, bChecks: 28, agreements: 41 } },
  { pair: 'a monopole (one checks all)', rec: { interactions: 50, aChecks: 50, bChecks: 5, agreements: 40 } },
  { pair: 'two clones (always agree)', rec: { interactions: 50, aChecks: 25, bChecks: 25, agreements: 50 } },
].map((c) => ({ pair: c.pair, ...coupleHealth(c.rec), rec: c.rec }));

// shared-limb: three borrows against a budget of 20
let limb = makeMeshLimb(20).limb; const borrows = [];
for (const cost of [8, 9, 7]) { const b = borrowLimb(limb, cost); borrows.push({ cost, allowed: b.allowed, why: b.why, remaining: b.limb.budget - b.limb.spent }); limb = b.limb; }

writeFileSync('demo/demo.json', JSON.stringify({
  task: TASK, message: MSG,
  crossVerify: { models: raw, verdict: q },
  route: { support: routeAsk(mesh.mesh, 'support-triage'), legal: routeAsk(mesh.mesh, 'legal-review') },
  couples, borrows,
}, null, 2) + '\n');
console.log('demo written: demo/mesh.json + demo/demo.json');
