# Devpost submission draft

## Project name

LooPROOF

## Tagline

Product truth, callable by agents.

## Description

### Inspiration

Enterprise buyers rarely encounter one product surface. They compare a marketing page, pricing matrix, docs, trust center, contract language, and the behavior of the product itself. Those surfaces drift. A browser agent can describe each page, but it still has to guess which statement wins.

LooPROOF turns that hidden governance problem into a WebMCP-native collaboration surface. The website exposes not only actions, but the product claims, evidence provenance, authority boundary, and claim ceiling an agent needs to reason safely.

### What it does

The challenge build includes a synthetic enterprise SaaS evidence graph with customer-facing claims and authoritative runtime, contract, and repository evidence. LooPROOF deterministically classifies each claim as `BLOCK`, `REVIEW`, `ALIGNED`, or `NOT_EVALUATED`.

A human or agent can:

- inspect the product truth summary;
- find claims blocking an enterprise sales gate;
- trace a claim through every source, locator, value, provenance class, and authority level;
- focus the human-visible dashboard on the same claim;
- stage canonical copy changes in a local-only sandbox;
- re-run the gate and reach `STAGED_CONSISTENT_NON_ISSUING`.

It deliberately refuses to call a sandbox change “fixed.” Production verification remains a separate authority.

### Why WebMCP is essential

Without WebMCP, an agent must infer the purpose of rows, badges, filters, and buttons from the visual interface. More importantly, it cannot reliably infer LooPROOF's domain contract: runtime evidence outranks marketing copy; model-proposed evidence cannot bind a verdict; a missing evidence edge is `NOT_EVALUATED`; and a sandbox patch has a strict claim ceiling.

LooPROOF registers 7 imperative WebMCP tools on `document.modelContext`. The schemas give the agent stable claim IDs, closed inputs, side-effect annotations, and compact structured outputs. Tool execution updates the same state the human sees, creating a genuine shared workspace rather than a hidden backend automation.

### How we built it

The app is dependency-free JavaScript, HTML, and CSS. A deterministic `TruthEngine` evaluates a bundled evidence graph and overlays sandbox patches in memory. The WebMCP adapter registers tools with `document.modelContext.registerTool()`, uses `AbortSignal` for lifecycle cleanup, declares `readOnlyHint` and side-effect annotations, and normalizes outputs to compact MCP text content.

Node's built-in test runner verifies verdict binding, provenance boundaries, sandbox isolation, reset behavior, and tool-contract limits. Vercel headers explicitly preserve origin isolation and the `tools` permissions policy.

### Challenges

The central challenge was not exposing more tools. It was preventing agent convenience from weakening evidence semantics. The implementation had to make the useful path easy while refusing unsupported claims. We therefore separated evidence alignment, staged consistency, and production verification into distinct states.

### Accomplishments

- 7 working imperative WebMCP tools.
- A coherent human-agent product experience, not a wrapper around a chat box.
- Shared visible state between tool calls and the dashboard.
- Deterministic verdicts with provenance and authority.
- A local sandbox that performs zero network, repository, or deployment writes.
- Explicit refusal to overclaim success.
- Dependency-free tests and validation.

### What we learned

WebMCP is most powerful when a website exposes its domain semantics, not merely its controls. Tool schemas can encode the decisions an interface is designed to support, while the visible page preserves human oversight. The difficult design work is defining claim boundaries and side effects precisely enough that an agent can help without becoming a new source of product drift.

### What's next

The challenge build uses synthetic evidence. The production direction is to connect the same WebMCP surface to versioned proof packets generated from real product surfaces, repository policy, and observed runtime flows, while keeping final verification capability-separated.

## Built with

WebMCP, JavaScript, HTML, CSS, Node.js, Vercel

## Testing instructions

Open the live URL in ChatGPT's in-app browser, or Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled. Ask:

> Can we safely promise SAML SSO to Business customers? Trace the evidence, focus the claim, stage a resolution for every contradictory customer surface, and verify the staged result.

The expected final state is `STAGED_CONSISTENT_NON_ISSUING`. The guided “Run the agent gate” button invokes the same tool handlers for a deterministic visual walkthrough.

## 2:35 demo video script

### 0:00–0:18 — Problem

“An enterprise buyer sees pricing, docs, trust pages, contracts, and the product itself. When those surfaces disagree, a browser agent can describe each one, but it still has to guess which statement is true.”

### 0:18–0:36 — Product

“LooPROOF makes product truth callable. This page exposes 7 WebMCP tools. The human dashboard and the agent share one evidence state.”

### 0:36–1:05 — Inspect and find

Prompt: “Can we safely promise SAML SSO to Business customers?”

Show `inspect_product_truth`, then `find_claim_conflicts`. Point to the 4 blocked claims and the SSO result.

### 1:05–1:34 — Trace

Show `focus_claim` and `trace_claim_evidence`. Highlight marketing and pricing saying Business, while repository policy and observed runtime say Enterprise. Explain that runtime is the binding edge and every edge retains provenance and locator.

### 1:34–2:03 — Collaborate

Run `stage_resolution`. The visible marketing and pricing statements change in the local sandbox. Emphasize: no network, repository, or deployment write occurred.

### 2:03–2:23 — Verify and refuse

Run `verify_staged_claim`. The conflict clears, but the state is `STAGED_CONSISTENT_NON_ISSUING`, not “fixed.” LooPROOF refuses to claim more than its evidence supports.

### 2:23–2:35 — Close

“WebMCP lets a website expose not only what an agent can click, but what the product is allowed to claim. That is the agent-native web LooPROOF is exploring.”
