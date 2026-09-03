import { product, sourceKinds } from "./data.mjs";
import { getClaim, listClaims, TruthEngine } from "./engine.mjs";
import {
  createToolDefinitions,
  executeLocalTool,
  registerWebMCPTools,
} from "./webmcp.mjs";

const app = document.querySelector("#app");
const state = {
  selectedClaimId: "sso-plan",
  calls: [],
  demoRunning: false,
  toolsOpen: false,
};

const engine = new TruthEngine({ onChange: () => render() });

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatClock(date = new Date()) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function verdictClass(verdict) {
  return verdict.toLowerCase().replaceAll("_", "-");
}

function addCall(call) {
  state.calls = [
    {
      id: crypto.randomUUID(),
      at: formatClock(),
      ...call,
    },
    ...state.calls,
  ].slice(0, 12);
  render();
}

function focusClaim(claimId) {
  getClaim(claimId);
  state.selectedClaimId = claimId;
  render();
  requestAnimationFrame(() => {
    document.querySelector(".ledger")?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  });
}

const toolDefinitions = createToolDefinitions(engine, {
  onCall: addCall,
  onFocus: focusClaim,
});
const webmcp = registerWebMCPTools(toolDefinitions);
window.__looproofTools = toolDefinitions;
window.__looproofEngine = engine;
window.__looproofWebMCP = webmcp;

const icon = (name) => {
  const icons = {
    arrow: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5"/></svg>',
    reset: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 6.5A6 6 0 1 1 4 12"/><path d="M4.5 2.5v4h4"/></svg>',
    tools: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4h9M3.5 4h1M12.5 10h4M3.5 10h6M9.5 16h7M3.5 16h3"/></svg>',
    check: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-9"/></svg>',
    copy: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="6" y="6" width="10" height="10" rx="1"/><path d="M4 14H3V3h11v1"/></svg>',
  };
  return icons[name] ?? "";
};

function renderWebMCPStatus() {
  if (webmcp.supported && webmcp.registered === toolDefinitions.length) {
    const isShim = Boolean(window.__webmcpTestRegistry);
    return `<span class="protocol-status ready"><span class="status-dot"></span>${
      isShim ? "Test registry" : "WebMCP live"
    } · ${webmcp.registered} tools</span>`;
  }
  if (webmcp.supported) {
    return `<span class="protocol-status partial"><span class="status-dot"></span>${webmcp.registered}/${toolDefinitions.length} tools</span>`;
  }
  return '<span class="protocol-status fallback"><span class="status-dot"></span>Browser fallback · tools inspectable</span>';
}

function renderClaimRow(claim) {
  const result = engine.evaluateClaim(claim.id);
  const active = claim.id === state.selectedClaimId;
  return `
    <button class="claim-row ${active ? "active" : ""}" data-claim="${claim.id}" aria-pressed="${active}">
      <span class="claim-row-main">
        <span class="claim-title">${escapeHtml(claim.title)}</span>
        <span class="claim-decision">${escapeHtml(claim.decision)}</span>
      </span>
      <span class="verdict ${verdictClass(result.verdict)}">${result.verdict.replace("_", " ")}</span>
    </button>`;
}

function renderEvidenceRow(item, authoritativeId) {
  const source = sourceKinds[item.sourceKind];
  return `
    <article class="evidence-row ${item.id === authoritativeId ? "authoritative" : ""} ${item.staged ? "staged" : ""}">
      <div class="evidence-rail">
        <span class="evidence-node"></span>
        <span class="evidence-line"></span>
      </div>
      <div class="evidence-source">
        <span class="source-kind">${escapeHtml(source.label)}</span>
        <strong>${escapeHtml(item.sourceLabel)}</strong>
        <code>${escapeHtml(item.locator)}</code>
      </div>
      <div class="evidence-statement">
        ${item.staged ? '<span class="staged-label">STAGED</span>' : ""}
        <p>${escapeHtml(item.statement)}</p>
        ${
          item.staged
            ? `<p class="before-copy"><s>${escapeHtml(item.originalStatement)}</s></p>`
            : ""
        }
      </div>
      <div class="evidence-value">
        <strong>${escapeHtml(item.displayValue)}</strong>
        <span>${escapeHtml(item.provenance.replaceAll("_", " "))}</span>
        ${item.id === authoritativeId ? '<em>binding edge</em>' : ""}
      </div>
    </article>`;
}

function renderCalls() {
  if (state.calls.length === 0) {
    return `
      <div class="trace-empty">
        <p>Agent calls appear here.</p>
        <span>Run the guided gate or ask a WebMCP-capable agent:</span>
        <button class="prompt-copy" data-copy="Can we safely promise SAML SSO to Business customers?">
          “Can we safely promise SAML SSO to Business customers?” ${icon("copy")}
        </button>
      </div>`;
  }

  return state.calls
    .map(
      (call) => `
        <article class="trace-call ${call.ok ? "ok" : "error"}">
          <header>
            <code>${escapeHtml(call.name)}</code>
            <span>${escapeHtml(call.at)} · ${call.durationMs}ms</span>
          </header>
          <p class="trace-args">${escapeHtml(JSON.stringify(call.args))}</p>
          <pre>${escapeHtml(JSON.stringify(call.output, null, 2))}</pre>
        </article>`,
    )
    .join("");
}

function renderToolDrawer() {
  if (!state.toolsOpen) return "";
  return `
    <div class="drawer-backdrop" data-close-drawer></div>
    <aside class="tool-drawer" aria-label="WebMCP tool registry">
      <header>
        <div>
          <span class="section-index">WEBMCP REGISTRY</span>
          <h2>${toolDefinitions.length} callable tools</h2>
        </div>
        <button class="icon-button" data-close-drawer aria-label="Close tool registry">×</button>
      </header>
      <p class="drawer-intro">These are registered directly on <code>document.modelContext</code>. The dashboard and agent operate the same state.</p>
      <div class="tool-list">
        ${toolDefinitions
          .map(
            (tool, index) => `
              <article class="tool-item">
                <div class="tool-number">${String(index + 1).padStart(2, "0")}</div>
                <div>
                  <code>${escapeHtml(tool.name)}</code>
                  <p>${escapeHtml(tool.description)}</p>
                  <span>${tool.annotations?.readOnlyHint ? "read only" : "local side effect"}</span>
                </div>
              </article>`,
          )
          .join("")}
      </div>
    </aside>`;
}

function render() {
  const selected = engine.evaluateClaim(state.selectedClaimId);
  const summary = engine.inspectProductTruth();
  const patchesForClaim = engine.patches.filter((patch) => {
    return selected.evidence.some((item) => item.id === patch.evidenceId);
  });

  app.innerHTML = `
    <header class="site-header">
      <a class="brand" href="#top" aria-label="LooPROOF home">
        <span class="brand-mark">L</span>
        <span>LooPROOF</span>
      </a>
      <div class="header-actions">
        ${renderWebMCPStatus()}
        <button class="secondary-button" data-tools>${icon("tools")} Tools</button>
        <a class="repo-link" href="https://github.com/obmakesomething/saas-agent-mcp2" target="_blank" rel="noreferrer">Source ${icon("arrow")}</a>
      </div>
    </header>

    <main id="top">
      <section class="intro">
        <div class="intro-copy">
          <h1>Product truth,<br />callable by agents.</h1>
          <p>LooPROOF lets a human and an agent inspect the same claim, follow its provenance, stage a resolution, and re-run the gate without pretending a sandbox change fixed production.</p>
        </div>
        <div class="intro-action">
          <p class="question-label">CURRENT DECISION</p>
          <blockquote>${escapeHtml(product.question)}</blockquote>
          <button class="primary-button" data-run-demo ${state.demoRunning ? "disabled" : ""}>
            ${state.demoRunning ? "Running gate…" : "Run the agent gate"} ${icon("arrow")}
          </button>
          <span>6 tool calls · local sandbox · no sign-in</span>
        </div>
      </section>

      <section class="instrument" aria-label="Product truth dashboard">
        <aside class="claim-panel">
          <div class="panel-heading">
            <span class="section-index">01 · CLAIMS</span>
            <span>${product.release}</span>
          </div>
          <div class="summary-strip">
            <div><strong>${summary.counts.BLOCK}</strong><span>block</span></div>
            <div><strong>${summary.counts.ALIGNED}</strong><span>aligned</span></div>
            <div><strong>${summary.counts.NOT_EVALUATED}</strong><span>not evaluated</span></div>
          </div>
          <nav class="claim-list" aria-label="Claims">
            ${listClaims().map(renderClaimRow).join("")}
          </nav>
          <p class="no-score">No overall score. One broken contract cannot be averaged away.</p>
        </aside>

        <section class="ledger">
          <div class="panel-heading">
            <span class="section-index">02 · EVIDENCE LEDGER</span>
            <span>${selected.evidence.length} edges</span>
          </div>
          <header class="claim-header">
            <div>
              <span>${escapeHtml(selected.claim.category)} · ${escapeHtml(selected.claim.decision)}</span>
              <h2>${escapeHtml(selected.claim.title)}</h2>
              <p>${escapeHtml(selected.reason)}</p>
            </div>
            <div class="claim-verdict">
              <span class="verdict large ${verdictClass(selected.verdict)}">${selected.verdict.replace("_", " ")}</span>
              <span>${selected.conflicts.length} conflicting edge${selected.conflicts.length === 1 ? "" : "s"}</span>
            </div>
          </header>
          <div class="ledger-columns" aria-hidden="true">
            <span>Source</span><span>Observed statement</span><span>Bound value</span>
          </div>
          <div class="evidence-list">
            ${selected.evidence
              .map((item) => renderEvidenceRow(item, selected.authoritative?.id))
              .join("")}
          </div>
          <footer class="ledger-footer">
            <div>
              <span>Claim ceiling</span>
              <strong>${selected.verificationState ?? "EVIDENCE_BOUND_NON_ISSUING"}</strong>
            </div>
            <div class="ledger-actions">
              <button class="text-button" data-stage ${selected.verdict !== "BLOCK" ? "disabled" : ""}>Stage resolution</button>
              <button class="text-button" data-verify ${patchesForClaim.length === 0 ? "disabled" : ""}>Verify staged claim</button>
              <button class="icon-button" data-reset aria-label="Reset sandbox">${icon("reset")}</button>
            </div>
          </footer>
        </section>

        <aside class="trace-panel">
          <div class="panel-heading">
            <span class="section-index">03 · AGENT TRACE</span>
            <button class="clear-trace" data-clear-trace>Clear</button>
          </div>
          <div class="trace-list">${renderCalls()}</div>
        </aside>
      </section>

      <section class="explain">
        <div class="explain-lead">
          <h2>The page does not merely expose buttons. It exposes what its claims are allowed to mean.</h2>
        </div>
        <div class="explain-steps">
          <article><span>01</span><h3>Discover</h3><p>The agent reads stable WebMCP tool schemas instead of inferring controls from pixels or DOM labels.</p></article>
          <article><span>02</span><h3>Bind</h3><p>Every verdict retains source, locator, provenance, and authority. Weak evidence cannot issue a strong claim.</p></article>
          <article><span>03</span><h3>Collaborate</h3><p>The agent focuses the visible claim, stages local copy changes, and leaves the human looking at the same evidence.</p></article>
          <article><span>04</span><h3>Refuse</h3><p>The final state says staged consistency, not “fixed.” Production verification remains a separate authority.</p></article>
        </div>
      </section>

      <section class="implementation">
        <div>
          <span class="section-index">IMPLEMENTATION</span>
          <h2>7 imperative WebMCP tools.<br />1 shared state machine.</h2>
        </div>
        <pre><code>document.modelContext.registerTool({
  name: "trace_claim_evidence",
  description: "Return the provenance-preserving evidence chain…",
  inputSchema: { /* closed JSON Schema */ },
  annotations: { readOnlyHint: true },
  execute: ({ claim_id }) =&gt; engine.traceClaimEvidence({ claim_id })
}, { signal: controller.signal });</code></pre>
      </section>
    </main>

    <footer class="site-footer">
      <span>LooPROOF · WebMCP Challenge 2026</span>
      <span>Open source under MIT · Synthetic evidence dataset</span>
    </footer>
    ${renderToolDrawer()}
  `;

  bindEvents();
}

function bindEvents() {
  document.querySelectorAll("[data-claim]").forEach((button) => {
    button.addEventListener("click", () => focusClaim(button.dataset.claim));
  });
  document.querySelector("[data-run-demo]")?.addEventListener("click", runDemo);
  document.querySelector("[data-tools]")?.addEventListener("click", () => {
    state.toolsOpen = true;
    render();
  });
  document.querySelectorAll("[data-close-drawer]").forEach((element) => {
    element.addEventListener("click", () => {
      state.toolsOpen = false;
      render();
    });
  });
  document.querySelector("[data-clear-trace]")?.addEventListener("click", () => {
    state.calls = [];
    render();
  });
  document.querySelector("[data-stage]")?.addEventListener("click", async () => {
    await executeLocalTool(toolDefinitions, "stage_resolution", {
      claim_id: state.selectedClaimId,
      scope: "all_customer_surfaces",
    });
  });
  document.querySelector("[data-verify]")?.addEventListener("click", async () => {
    await executeLocalTool(toolDefinitions, "verify_staged_claim", {
      claim_id: state.selectedClaimId,
    });
  });
  document.querySelector("[data-reset]")?.addEventListener("click", async () => {
    await executeLocalTool(toolDefinitions, "reset_sandbox", {
      claim_id: state.selectedClaimId,
    });
  });
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      await navigator.clipboard?.writeText(button.dataset.copy);
      const original = button.innerHTML;
      button.innerHTML = `Copied ${icon("check")}`;
      setTimeout(() => {
        button.innerHTML = original;
      }, 1200);
    });
  });
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runDemo() {
  if (state.demoRunning) return;
  state.demoRunning = true;
  state.calls = [];
  engine.resetSandbox({});
  state.selectedClaimId = "sso-plan";
  render();

  const sequence = [
    ["inspect_product_truth", { include_aligned: false }],
    ["find_claim_conflicts", { decision: "Enterprise sales gate", verdict: "BLOCK" }],
    ["focus_claim", { claim_id: "sso-plan" }],
    ["trace_claim_evidence", { claim_id: "sso-plan" }],
    ["stage_resolution", { claim_id: "sso-plan", scope: "all_customer_surfaces" }],
    ["verify_staged_claim", { claim_id: "sso-plan" }],
  ];

  for (const [name, args] of sequence) {
    await executeLocalTool(toolDefinitions, name, args);
    await pause(480);
  }

  state.demoRunning = false;
  render();
}

window.addEventListener("beforeunload", () => webmcp.dispose());
render();
