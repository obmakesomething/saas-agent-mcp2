# LooPROOF — Product truth, callable by agents

LooPROOF is a WebMCP-native proof surface for enterprise product claims. A human and an agent inspect the same claim, trace the same evidence, stage the same local resolution, and see the same verification result.

**[Open the live challenge build](https://rawcdn.githack.com/obmakesomething/saas-agent-mcp2/4924d40556441b86a907e2af23a05b4eb6c0675f/index.html)**

The live build is pinned to an immutable Git commit and served over HTTPS with correct JavaScript and CSS content types. The app does **not** let an LLM invent a source of truth. Every verdict is derived from a deterministic, provenance-preserving evidence graph. A sandbox patch can reach `STAGED_CONSISTENT_NON_ISSUING`; it can never claim production readiness or `VERIFIED_FIXED`.

## Why WebMCP

A browser agent can usually inspect pixels, the DOM, and accessibility labels. Those surfaces say what a page looks like, not which product claim is authoritative when pricing, docs, repository policy, contracts, and runtime behavior disagree.

WebMCP lets LooPROOF expose that product-specific reasoning as explicit tools:

| Tool | Purpose | Side effect |
|---|---|---|
| `inspect_product_truth` | Summarize verdict counts and claim ceiling | None |
| `find_claim_conflicts` | Find customer promises that contradict authoritative evidence | None |
| `trace_claim_evidence` | Return the full provenance chain for one claim | None |
| `focus_claim` | Put the human-visible dashboard on the same claim | Page selection only |
| `stage_resolution` | Stage canonical customer-facing copy in the sandbox | Local memory only |
| `verify_staged_claim` | Re-run the deterministic gate | None |
| `reset_sandbox` | Remove local staged patches | Local memory only |

The tools are registered directly with the imperative API:

```js
document.modelContext.registerTool(
  {
    name: "trace_claim_evidence",
    description: "Return the provenance-preserving evidence chain…",
    inputSchema: { /* closed JSON Schema */ },
    annotations: { readOnlyHint: true },
    execute: ({ claim_id }) => engine.traceClaimEvidence({ claim_id }),
  },
  { signal: controller.signal },
);
```

## Human + agent journey

Try this prompt in ChatGPT's in-app browser or Chrome with WebMCP enabled:

> Can we safely promise SAML SSO to Business customers? Trace the evidence, focus the claim, stage a resolution for every contradictory customer surface, and verify the staged result.

Expected tool chain:

1. `inspect_product_truth`
2. `find_claim_conflicts`
3. `focus_claim`
4. `trace_claim_evidence`
5. `stage_resolution`
6. `verify_staged_claim`

The final state is `STAGED_CONSISTENT_NON_ISSUING`, not “fixed.”

## Run locally

No dependencies or API keys are required.

```bash
npm run dev
```

Open `http://localhost:4173`.

For Chrome local testing:

1. Use Chrome 149+.
2. Enable `chrome://flags/#enable-webmcp-testing`.
3. Relaunch Chrome and open the app over HTTP or HTTPS.
4. Inspect Application → WebMCP, or use the Model Context Tool Inspector extension.

A deterministic smoke-test registry is available only at `?webmcp-test=1`. It does not run when a native `document.modelContext` exists.

## Verify

```bash
npm run check
```

The test suite confirms:

- Runtime evidence binds the SSO verdict.
- Model-proposed evidence cannot bind a claim.
- Staging changes only mutable customer surfaces.
- Staging performs zero network and repository writes.
- Reset restores the original conflict.
- Tool names, descriptions, parameter descriptions, schemas, output budgets, license, and imperative registration meet the challenge constraints.

## Architecture

```text
Synthetic evidence dataset
        │
        ▼
Deterministic TruthEngine
  ├─ authority ordering
  ├─ provenance boundary
  ├─ conflict classification
  └─ local patch overlay
        │
        ├──────────────► Human dashboard
        │
        └──────────────► document.modelContext.registerTool(...)
                              │
                              ▼
                         Browser agent
```

`MODEL_PROPOSED` evidence may remain visible, but it cannot bind a verdict. Customer-facing contradictions against runtime, contract, or deterministic repository evidence become `BLOCK`. A missing authoritative edge becomes `NOT_EVALUATED`, never an optimistic pass.

## What is new for the WebMCP Challenge

This repository is a new, standalone challenge build created during the submission period. The WebMCP implementation, shared human-agent state model, local resolution sandbox, deterministic verification path, interface, tests, and documentation were built for the challenge. It does not expose or copy the private production implementation of LooPROOF's existing engines.

## Privacy and scope

The evidence dataset is synthetic. The app is client-only and sends no product, repository, or user data anywhere. See [SECURITY.md](./SECURITY.md).

## License

MIT
