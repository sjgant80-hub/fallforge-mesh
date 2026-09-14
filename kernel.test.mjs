import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BALANCE_MIN, AGREE_MIN, QUORUM, sha256, canon,
  coupleHealth, makeMeshLimb, borrowLimb, quorum, buildMesh, verifyMesh, routeAsk,
} from './kernel.mjs';

test('sha256 + canon + constants pinned', () => {
  assert.equal(sha256('abc').hash, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256('').hash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256(1).ok, false);
  assert.equal(canon({ b: 1, a: 2 }), canon({ a: 2, b: 1 }));
  assert.notEqual(canon({ x: 5 }), canon({ x: '5' }));
  assert.notEqual(canon({ x: null }), canon({ x: 0 }));
  assert.equal(BALANCE_MIN, 618);
  assert.equal(AGREE_MIN, 500);
  assert.equal(QUORUM, 2);
});

// ── coupling health: the couple-gate, engineering-framed
test('coupleHealth: SOVEREIGN needs balance AND independence (not perfect agreement)', () => {
  // 100 interactions, both check ~equally, agree 80% (some independent disagreement)
  assert.deepEqual(coupleHealth({ interactions: 100, aChecks: 50, bChecks: 50, agreements: 80 }).state, 'SOVEREIGN');
  assert.equal(coupleHealth({ interactions: 100, aChecks: 50, bChecks: 50, agreements: 80 }).sound, true);
  // never interacted
  assert.equal(coupleHealth({ interactions: 0, aChecks: 0, bChecks: 0, agreements: 0 }).state, 'FROZEN');
  // one side never checks
  assert.equal(coupleHealth({ interactions: 100, aChecks: 0, bChecks: 50, agreements: 40 }).state, 'STARVED');
  assert.equal(coupleHealth({ interactions: 100, aChecks: 50, bChecks: 0, agreements: 40 }).state, 'STARVED');
  // perfect agreement = MERGED = correlated, not independently verified (the QuorumSafe lesson)
  assert.equal(coupleHealth({ interactions: 100, aChecks: 50, bChecks: 50, agreements: 100 }).state, 'MERGED');
  assert.match(coupleHealth({ interactions: 100, aChecks: 50, bChecks: 50, agreements: 100 }).why, /correlated/);
  // lopsided checking = EXTRACTIVE
  assert.equal(coupleHealth({ interactions: 100, aChecks: 90, bChecks: 30, agreements: 80 }).state, 'EXTRACTIVE');
  // they rarely agree = not competently coupled
  assert.equal(coupleHealth({ interactions: 100, aChecks: 50, bChecks: 50, agreements: 20 }).state, 'STARVED');
});

test('coupleHealth: the balance boundary is exact (kills >= vs >)', () => {
  // balance exactly 0.618: aChecks 618, bChecks 1000 → 618*1000 >= 618*1000 → SOVEREIGN
  const atBand = coupleHealth({ interactions: 1000, aChecks: 618, bChecks: 1000, agreements: 800 });
  assert.equal(atBand.state, 'SOVEREIGN');
  // one below: aChecks 617 → 617000 >= 618000 false → EXTRACTIVE
  const below = coupleHealth({ interactions: 1000, aChecks: 617, bChecks: 1000, agreements: 800 });
  assert.equal(below.state, 'EXTRACTIVE');
  // agreement exactly 0.5 is sound; one below is STARVED
  assert.equal(coupleHealth({ interactions: 1000, aChecks: 700, bChecks: 700, agreements: 500 }).state, 'SOVEREIGN');
  assert.equal(coupleHealth({ interactions: 1000, aChecks: 700, bChecks: 700, agreements: 499 }).state, 'STARVED');
});

test('coupleHealth: every guard refuses with its own why', () => {
  assert.equal(coupleHealth(null).ok, false);
  assert.match(coupleHealth({ interactions: -1, aChecks: 0, bChecks: 0, agreements: 0 }).why, /non-negative/);
  assert.match(coupleHealth({ interactions: 5, aChecks: 6, bChecks: 1, agreements: 1 }).why, /check more times/);
  assert.match(coupleHealth({ interactions: 5, aChecks: 1, bChecks: 6, agreements: 1 }).why, /check more times/);
  assert.match(coupleHealth({ interactions: 5, aChecks: 1, bChecks: 1, agreements: 6 }).why, /agreements cannot exceed/);
  assert.equal(coupleHealth({ interactions: 5, aChecks: 1.5, bChecks: 1, agreements: 1 }).ok, false);
});

// ── the shared limb
test('borrowLimb: shared budget, boundary exact, refusal costs nothing', () => {
  const l = makeMeshLimb(10).limb;
  assert.equal(borrowLimb(l, 10).allowed, true);           // exactly the budget
  assert.equal(borrowLimb(l, 10).limb.spent, 10);
  assert.equal(borrowLimb(l, 11).allowed, false);          // one over
  assert.equal(borrowLimb(l, 11).spent, 0);
  assert.equal(borrowLimb(l, 0).allowed, true);            // zero cost valid
  assert.equal(borrowLimb(l, -1).allowed, false);
  assert.equal(l.spent, 0);                                 // original untouched
  assert.equal(makeMeshLimb(0).ok, true);                   // a zero-budget mesh never borrows
  assert.equal(makeMeshLimb(-1).ok, false);
  assert.equal(makeMeshLimb(1.5).ok, false);
  assert.equal(borrowLimb({ budget: 5, spent: 9 }, 0).ok, false);
  assert.equal(borrowLimb({ budget: 5, spent: -1 }, 0).ok, false);
  assert.equal(borrowLimb(null, 1).ok, false);
  assert.equal(borrowLimb({ budget: 5, spent: 5 }, 0).allowed, true);   // spent===budget is valid
});

// ── quorum: deterministic cross-verification, no judge
test('quorum: exact-agreement plurality, needs QUORUM, ties escalate', () => {
  assert.deepEqual(quorum(['{"x":1}', '{"x":1}', '{"x":2}']), { ok: true, verified: true, answer: '{"x":1}', agree: 2, of: 3, why: '2 of 3 nodes agree' });
  assert.equal(quorum(['a', 'b', 'c']).verified, false);          // all differ — plurality 1 < QUORUM
  assert.equal(quorum(['a', 'b']).verified, false);               // a tie escalates
  assert.match(quorum(['a', 'b']).why, /plurality/);
  assert.equal(quorum(['a', 'a']).verified, true);                // exactly QUORUM
  assert.equal(quorum(['a']).verified, false);                    // below quorum
  assert.equal(quorum([]).verified, false);
  assert.equal(quorum(['a', 'a', 'b', 'b']).verified, false);     // 2-2 tie escalates even though each hits QUORUM
  assert.equal(quorum('x').ok, false);
  assert.equal(quorum(['a', 7]).ok, false);
});

// ── the mesh manifest
function mem(node, useCase) { return { node, useCase, manifestHash: 'a'.repeat(64) }; }

test('buildMesh + verifyMesh: sorted, deduped, shared-limb bounded, tamper shows', () => {
  const m = buildMesh([mem('triage-1b', 'support-triage'), mem('review-1b', 'code-review')], 100);
  assert.equal(m.ok, true);
  assert.equal(m.mesh.count, 2);
  assert.equal(m.mesh.sharedLimbBudget, 100);
  assert.deepEqual(m.mesh.members.map((x) => x.node), ['review-1b', 'triage-1b']);   // sorted
  assert.match(m.mesh.scope, /no node dominates/);
  assert.equal(verifyMesh(m.mesh).valid, true);
  assert.equal(verifyMesh({ ...m.mesh, sharedLimbBudget: 999 }).valid, false);
  assert.equal(verifyMesh({ ...m.mesh, count: 5 }).valid, false);
  assert.equal(verifyMesh({ kind: 'fallforge-mesh' }).ok, false);
  assert.equal(verifyMesh('x').ok, false);
  assert.equal(buildMesh([], 10).ok, false);
  assert.equal(buildMesh([mem('dup', 'a'), mem('dup', 'b')], 10).ok, false);
  assert.equal(buildMesh([{ node: 'n', useCase: 'u', manifestHash: 'z'.repeat(64) }], 10).ok, false);
  assert.equal(buildMesh([mem('n', 'u')], -1).ok, false);
});

test('kill: buildMesh member guards — each clause isolated, forged members refused', () => {
  const H = 'a'.repeat(64);
  // an array member with all the right props (isObj excludes arrays)
  const arrMem = Object.assign([], { node: 'x', useCase: 'u', manifestHash: H });
  assert.equal(buildMesh([arrMem], 10).ok, false);
  // numeric node slips a &&-mutant through but must still be refused
  assert.equal(buildMesh([{ node: 7, useCase: 'u', manifestHash: H }], 10).ok, false);
  assert.equal(buildMesh([{ node: '', useCase: 'u', manifestHash: H }], 10).ok, false);
  // numeric / empty use-case
  assert.equal(buildMesh([{ node: 'n', useCase: 7, manifestHash: H }], 10).ok, false);
  assert.equal(buildMesh([{ node: 'n', useCase: '', manifestHash: H }], 10).ok, false);
  // manifest hash: non-string, wrong length, non-hex
  assert.equal(buildMesh([{ node: 'n', useCase: 'u', manifestHash: 7 }], 10).ok, false);
  assert.equal(buildMesh([{ node: 'n', useCase: 'u', manifestHash: 'a'.repeat(63) }], 10).ok, false);
  assert.equal(buildMesh([{ node: 'n', useCase: 'u', manifestHash: 'z'.repeat(64) }], 10).ok, false);
});

test('kill: coupleHealth checks-vs-interactions boundary (a node may check every interaction)', () => {
  // aChecks === interactions is VALID (a node that verified on every interaction) — kills > vs >=
  assert.equal(coupleHealth({ interactions: 100, aChecks: 100, bChecks: 100, agreements: 80 }).state, 'SOVEREIGN');
  assert.equal(coupleHealth({ interactions: 100, aChecks: 100, bChecks: 70, agreements: 80 }).ok, true);
});

test('kill: verifyMesh count-vs-members fires when the hash matches', () => {
  const mesh = buildMesh([mem('a-node', 'x'), mem('b-node', 'y')], 50).mesh;
  const body = { v: mesh.v, kind: mesh.kind, count: 9, members: mesh.members, sharedLimbBudget: mesh.sharedLimbBudget, scope: mesh.scope };
  const forged = { ...body, hash: sha256(canon(body)).hash };
  const vf = verifyMesh(forged);
  assert.equal(vf.valid, false);
  assert.match(vf.why, /count/);
  const fakeMesh = Object.assign([], { kind: 'fallforge-mesh', hash: 'a'.repeat(64) });
  assert.equal(verifyMesh(fakeMesh).ok, false);              // array with kind+hash refused
});

test('routeAsk: matching members answer; an unserved use-case borrows the shared limb', () => {
  const mesh = buildMesh([mem('triage-1b', 'support-triage'), mem('triage-7b', 'support-triage'), mem('review-1b', 'code-review')], 100).mesh;
  assert.deepEqual(routeAsk(mesh, 'support-triage'), { ok: true, route: 'nodes', nodes: ['triage-1b', 'triage-7b'], why: '2 member(s) serve support-triage' });
  assert.equal(routeAsk(mesh, 'code-review').route, 'nodes');
  assert.equal(routeAsk(mesh, 'legal-review').route, 'shared-limb');   // no member — borrow the frontier
  assert.match(routeAsk(mesh, 'legal-review').why, /borrows the shared frontier/);
  assert.equal(routeAsk(mesh, '').ok, false);
  assert.equal(routeAsk({ ...mesh, hash: 'f'.repeat(64) }, 'support-triage').ok, false);   // won't route a broken mesh
});
