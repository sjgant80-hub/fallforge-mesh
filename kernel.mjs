// FallForge Mesh — the coupling kernel. Layer 5 of the sovereign-node factory: couple owned
// SLM nodes into a mesh where NO single node — and not the borrowed frontier — dominates.
// Three walls: (1) coupling health — two nodes are soundly coupled only when they check each
// other roughly equally AND disagree sometimes (perfect agreement is CORRELATED, not verified —
// a merged pair gives false confidence); (2) a SHARED limb budget — the frontier is one
// mesh-wide, budget-bounded resource, so no node can drain the big model on the mesh's behalf;
// (3) cross-verification by DETERMINISTIC quorum on the structured answer — never an LLM judge.
// No I/O. Pure and total: garbage in → { ok:false, why }, never a throw.

export const BALANCE_MIN = 618;      // ×1000: two nodes must check each other within ~0.618 balance
export const AGREE_MIN = 500;        // ×1000: a sound couple agrees at least half the time (competent)
export const QUORUM = 2;             // a cross-verified answer needs at least this many nodes agreeing

const isStr = (v) => typeof v === 'string';
const isInt = (v) => Number.isInteger(v);
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const HEX = /^[0-9a-f]+$/;

// ── SHA-256 + canonical JSON (the estate's proven pair) ─────────────────────────────────────────
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256(text) {
  if (!isStr(text)) return { ok: false, why: 'sha256 takes a string' };
  const data = new TextEncoder().encode(text);
  const len = data.length;
  const padded = new Uint8Array((((len + 8) >> 6) << 6) + 64);
  padded.set(data);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  const bitLen = len * 8;
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296));
  dv.setUint32(padded.length - 4, bitLen >>> 0);
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);
  for (let i = 0; i < padded.length; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) {
      const x = w[t - 15], y = w[t - 2];
      const s0 = (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) >>> 0;
      const s1 = (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)) >>> 0;
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, hh = h7;
    for (let t = 0; t < 64; t++) {
      const S1 = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (hh + S1 + ch + K256[t] + w[t]) >>> 0;
      const S0 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + hh) >>> 0;
  }
  const hex = (n) => n.toString(16).padStart(8, '0');
  return { ok: true, hash: hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7) };
}

export function canon(v) {
  if (v === null || typeof v === 'number' || typeof v === 'boolean') return JSON.stringify(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return '"?"';
}

// ── wall 1: coupling health — checked equally AND disagreeing sometimes ─────────────────────────
function validPair(p) {
  if (!isObj(p)) return 'a pair record is an object';
  for (const f of ['interactions', 'aChecks', 'bChecks', 'agreements']) {
    if (!isInt(p[f]) || p[f] < 0) return f + ' must be a non-negative integer';
  }
  if (p.aChecks > p.interactions || p.bChecks > p.interactions) return 'a side cannot check more times than the pair interacted';
  if (p.agreements > p.interactions) return 'agreements cannot exceed interactions';
  return null;
}

/** coupleHealth(pair) — classify how two nodes are coupled from their interaction record.
 *  SOVEREIGN (sound), MERGED (correlated — false confidence), EXTRACTIVE (one dominates the
 *  checking), STARVED (a side never checks), FROZEN (never interacted). */
export function coupleHealth(pair) {
  const bad = validPair(pair);
  if (bad) return { ok: false, why: bad };
  const { interactions, aChecks, bChecks, agreements } = pair;
  if (interactions === 0) return { ok: true, state: 'FROZEN', sound: false, why: 'the two never interacted' };
  if (aChecks === 0 || bChecks === 0) return { ok: true, state: 'STARVED', sound: false, why: 'one side never checks the other — no mutual verification' };
  // perfect agreement means the pair is correlated: a second opinion that is always the first is not a check
  if (agreements === interactions) return { ok: true, state: 'MERGED', sound: false, why: 'the two agree every time — correlated, not independent; a merged pair gives false confidence' };
  const lo = Math.min(aChecks, bChecks), hi = Math.max(aChecks, bChecks);
  const balanceOk = lo * 1000 >= BALANCE_MIN * hi;               // integer: min/max >= 0.618
  const agreeOk = agreements * 1000 >= AGREE_MIN * interactions; // integer: agreement rate >= 0.5
  if (!balanceOk) return { ok: true, state: 'EXTRACTIVE', sound: false, why: 'one node does most of the checking — the coupling is lopsided' };
  if (!agreeOk) return { ok: true, state: 'STARVED', sound: false, why: 'the two rarely agree — they are not competently coupled on the same work' };
  return { ok: true, state: 'SOVEREIGN', sound: true, why: 'checked both ways, balanced, agreeing most but not all of the time — a sound couple' };
}

// ── wall 2: the SHARED frontier limb — one budget for the whole mesh ────────────────────────────
function validLimb(l) {
  if (!isObj(l)) return 'a shared limb is { budget, spent }';
  if (!isInt(l.budget) || l.budget < 0) return 'limb budget must be a non-negative integer';
  if (!isInt(l.spent) || l.spent < 0) return 'limb spent must be a non-negative integer';
  if (l.spent > l.budget) return 'limb spent exceeds its budget';
  return null;
}

export function makeMeshLimb(budget) {
  const l = { budget, spent: 0 };
  const bad = validLimb(l);
  if (bad) return { ok: false, why: bad };
  return { ok: true, limb: l };
}

/** borrowLimb(limb, cost) — the mesh, not any one node, spends the shared frontier. Fail-safe:
 *  a refusal costs nothing and the limb is unchanged. */
export function borrowLimb(limb, cost) {
  const bad = validLimb(limb);
  if (bad) return { ok: false, why: bad };
  if (!isInt(cost) || cost < 0) return { ok: true, allowed: false, spent: 0, limb, why: 'unknown cost — refused' };
  if (limb.spent + cost > limb.budget) return { ok: true, allowed: false, spent: 0, limb, why: 'the shared frontier budget is spent — the mesh answers on its own' };
  return { ok: true, allowed: true, spent: cost, limb: { budget: limb.budget, spent: limb.spent + cost }, why: 'within the shared budget' };
}

// ── wall 3: cross-verification by deterministic quorum (no judge) ───────────────────────────────
/** quorum(answers) — count exact agreement on the structured answer string. A cross-verified
 *  result needs QUORUM identical answers; otherwise the mesh must escalate to the shared limb. */
export function quorum(answers) {
  if (!Array.isArray(answers)) return { ok: false, why: 'answers is an array of strings' };
  if (answers.length === 0) return { ok: true, verified: false, agree: 0, of: 0, why: 'no answers to cross-verify' };
  const tally = new Map();
  for (const a of answers) {
    if (!isStr(a)) return { ok: false, why: 'each answer must be a string' };
    tally.set(a, (tally.get(a) || 0) + 1);
  }
  let top = null, topN = 0, tie = false;
  for (const [a, n] of tally) {
    if (n > topN) { top = a; topN = n; tie = false; }
    else if (n === topN) tie = true;
  }
  if (tie) return { ok: true, verified: false, agree: topN, of: answers.length, why: 'no single answer reached a plurality — escalate' };
  const verified = topN >= QUORUM;
  return { ok: true, verified, answer: verified ? top : undefined, agree: topN, of: answers.length,
    why: verified ? topN + ' of ' + answers.length + ' nodes agree' : 'only ' + topN + ' agree — below the quorum of ' + QUORUM };
}

// ── the mesh manifest: members + shared limb, content-addressed ─────────────────────────────────
export function buildMesh(members, limbBudget) {
  if (!Array.isArray(members) || members.length === 0) return { ok: false, why: 'a mesh needs at least one member' };
  const seen = new Set();
  const clean = [];
  for (const [i, m] of members.entries()) {
    if (!isObj(m) || !isStr(m.node) || m.node.length === 0) return { ok: false, why: 'member ' + i + ' needs a node name' };
    if (!isStr(m.useCase) || m.useCase.length === 0) return { ok: false, why: 'member ' + i + ' needs a use-case' };
    if (!isStr(m.manifestHash) || m.manifestHash.length !== 64 || !HEX.test(m.manifestHash)) return { ok: false, why: 'member ' + i + ' needs a 64-hex manifest hash' };
    if (seen.has(m.node)) return { ok: false, why: 'duplicate member: ' + m.node };
    seen.add(m.node);
    clean.push({ node: m.node, useCase: m.useCase, manifestHash: m.manifestHash });
  }
  const lb = makeMeshLimb(limbBudget);
  if (!lb.ok) return { ok: false, why: 'shared limb: ' + lb.why };
  clean.sort((a, b) => a.node.localeCompare(b.node));
  const body = { v: 1, kind: 'fallforge-mesh', count: clean.length, members: clean, sharedLimbBudget: limbBudget,
    scope: 'the frontier is a shared, budget-bounded limb; no node dominates and none is a private higher authority' };
  const h = sha256(canon(body));
  if (!h.ok) return { ok: false, why: h.why };
  return { ok: true, mesh: { ...body, hash: h.hash } };
}

export function verifyMesh(mesh) {
  if (!isObj(mesh) || mesh.kind !== 'fallforge-mesh' || !isStr(mesh.hash)) return { ok: false, why: 'not a fallforge mesh' };
  const body = { ...mesh };
  delete body.hash;
  const h = sha256(canon(body));
  if (!h.ok) return { ok: false, why: h.why };
  if (h.hash !== mesh.hash) return { ok: true, valid: false, why: 'hash mismatch — the mesh does not match its own members' };
  if (!Array.isArray(mesh.members) || mesh.members.length !== mesh.count) return { ok: true, valid: false, why: 'count does not match the members' };
  return { ok: true, valid: true, why: 'mesh intact' };
}

/** routeAsk(mesh, useCase) — deterministic: the members whose use-case matches answer; if none
 *  match, the ask must go to the shared limb. The mesh never invents a specialist it lacks. */
export function routeAsk(mesh, useCase) {
  const v = verifyMesh(mesh);
  if (!v.ok) return v;
  if (v.valid !== true) return { ok: false, why: v.why };
  if (!isStr(useCase) || useCase.length === 0) return { ok: false, why: 'an ask needs a use-case' };
  const nodes = mesh.members.filter((m) => m.useCase === useCase).map((m) => m.node);
  if (nodes.length === 0) return { ok: true, route: 'shared-limb', nodes: [], why: 'no member serves ' + useCase + ' — the mesh borrows the shared frontier' };
  return { ok: true, route: 'nodes', nodes, why: nodes.length + ' member(s) serve ' + useCase };
}
