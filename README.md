# FallForge Mesh

**LIVE: https://sjgant80-hub.github.io/fallforge-mesh/**

Sovereign nodes, coupled — layer 5 of the sovereign-node factory. Couple your
[owned nodes](https://github.com/sjgant80-hub/fallforge-catalogue) into a mesh where **no single
node — and not the borrowed frontier — dominates**. This is the frontier-as-limb inversion made
a product: sell people a sovereign mesh so they aren't a cell of a monopole.

Three walls, all in the gated kernel:

1. **Coupling health.** Two nodes are soundly coupled only when they check each other roughly
   equally **and disagree sometimes**. Perfect agreement is *correlated, not verified* — the mesh
   calls that **MERGED** and won't trust it. A monopole where one node checks everything is
   **EXTRACTIVE**. Only a balanced, independently-disagreeing pair reads **SOVEREIGN**.
2. **A shared frontier budget.** The big model is one mesh-wide, budget-bounded resource. When
   it's spent, the mesh answers on its own — no node can drain the frontier on everyone's behalf.
3. **Cross-verification by deterministic quorum.** Multiple nodes answer; the kernel takes the
   exact-agreement quorum. **Never an LLM judge** — correlated checkers give false confidence.

## The shipped demo (real, local)

Built from the two minted manifests, exercised on local models:

- **Cross-verification** — one support message, three local models (`triage-1b`, `qwen2.5:7b`,
  `qwen2.5:14b`) answer independently → **3/3 quorum VERIFIED** `{"category":"refund"}`, no judge.
- **Coupling health** — three couples classified: SOVEREIGN (balanced, some disagreement),
  EXTRACTIVE (one node checks everything), MERGED (a clone-pair that always agrees).
- **Shared budget** — three borrows against a budget of 20: 8 GRANTED, 9 GRANTED, 7 REFUSED
  (the shared frontier is spent — the mesh answers on its own).

The live page rebuilds every quorum and coupling verdict in your browser from the gated kernel.

## Run it

```bash
node --test kernel.test.mjs
node tools/witness.mjs mutate kernel.mjs --timeout 20000 --cap 500 --test node --test kernel.test.mjs
node demo.mjs         # build a mesh from your manifests, cross-verify on local models
node make-page.mjs
```

Kernel mutation-witnessed in CI (65/66, one argued equivalent); the shipped mesh is re-verified
against the shipped kernel on every push. The coupling metric is engineering — a balance-and-
independence measure, nothing more. MIT.
