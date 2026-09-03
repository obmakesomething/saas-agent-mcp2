const compact = (value) => {
  const text = JSON.stringify(value);
  if (text.length <= 1450) return text;
  return `${text.slice(0, 1400)}…`;
};

const textResult = (value) => ({
  content: [{ type: "text", text: compact(value) }],
});

export function createToolDefinitions(engine, { onCall = () => {}, onFocus = () => {} } = {}) {
  const wrap = (name, handler) => async (args = {}) => {
    const startedAt = performance.now();
    try {
      const output = await handler(args);
      onCall({
        name,
        args,
        output,
        ok: true,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      });
      return textResult(output);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onCall({
        name,
        args,
        output: { error: message },
        ok: false,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      });
      return {
        content: [{ type: "text", text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  };

  return [
    {
      name: "inspect_product_truth",
      description:
        "Summarize the current product evidence graph and verdict counts. Use this first when deciding whether product claims are safe to repeat. Read-only; no production or repository changes.",
      inputSchema: {
        type: "object",
        properties: {
          include_aligned: {
            type: "boolean",
            description: "Include claims whose strong evidence already agrees.",
            default: true,
          },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: wrap("inspect_product_truth", (args) => engine.inspectProductTruth(args)),
    },
    {
      name: "find_claim_conflicts",
      description:
        "Find product claims whose customer-facing promise conflicts with runtime, contract, or deterministic repository evidence. Filter by decision gate or verdict. Read-only.",
      inputSchema: {
        type: "object",
        properties: {
          decision: {
            type: "string",
            description: "Optional exact decision gate, such as Enterprise sales gate.",
          },
          verdict: {
            type: "string",
            enum: ["BLOCK", "REVIEW", "ALIGNED", "NOT_EVALUATED", "ANY"],
            description: "Verdict to return. Use ANY for all claims.",
            default: "BLOCK",
          },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: wrap("find_claim_conflicts", (args) => engine.findClaimConflicts(args)),
    },
    {
      name: "trace_claim_evidence",
      description:
        "Return the provenance-preserving evidence chain for one claim, ordered by authority. Use after finding a conflict to explain exactly what disagrees and what binds the verdict. Read-only.",
      inputSchema: {
        type: "object",
        properties: {
          claim_id: {
            type: "string",
            enum: [
              "sso-plan",
              "retention-days",
              "eu-residency",
              "audit-log-days",
              "encryption-at-rest",
              "scim-provisioning"
            ],
            description: "Stable claim identifier returned by another LooPROOF tool.",
          },
        },
        required: ["claim_id"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: wrap("trace_claim_evidence", (args) => engine.traceClaimEvidence(args)),
    },
    {
      name: "focus_claim",
      description:
        "Focus the human-visible dashboard on one claim so the user and agent share the same evidence context. Changes only the current page selection; it does not edit product data.",
      inputSchema: {
        type: "object",
        properties: {
          claim_id: {
            type: "string",
            enum: [
              "sso-plan",
              "retention-days",
              "eu-residency",
              "audit-log-days",
              "encryption-at-rest",
              "scim-provisioning"
            ],
            description: "Claim to display in the evidence ledger.",
          },
        },
        required: ["claim_id"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: wrap("focus_claim", ({ claim_id }) => {
        onFocus(claim_id);
        return {
          focused: true,
          claim_id,
          side_effect: "visible_page_selection_only",
        };
      }),
    },
    {
      name: "stage_resolution",
      description:
        "Stage copy changes for contradictory customer-facing surfaces in the local in-memory sandbox. No network, repository, deployment, or production write occurs. Use only after tracing the evidence.",
      inputSchema: {
        type: "object",
        properties: {
          claim_id: {
            type: "string",
            enum: ["sso-plan", "retention-days", "eu-residency", "audit-log-days"],
            description: "Blocked claim whose customer-facing copy should be staged.",
          },
          scope: {
            type: "string",
            enum: ["first_conflict", "all_customer_surfaces"],
            description: "Whether to stage one conflict or every patchable customer surface.",
            default: "all_customer_surfaces",
          },
        },
        required: ["claim_id"],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        untrustedContentHint: false,
      },
      execute: wrap("stage_resolution", (args) => engine.stageResolution(args)),
    },
    {
      name: "verify_staged_claim",
      description:
        "Re-run deterministic conflict evaluation after a sandbox patch. It can return staged consistency but never production readiness or VERIFIED_FIXED. Read-only against current local state.",
      inputSchema: {
        type: "object",
        properties: {
          claim_id: {
            type: "string",
            enum: ["sso-plan", "retention-days", "eu-residency", "audit-log-days"],
            description: "Claim to evaluate after staging a resolution.",
          },
        },
        required: ["claim_id"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: wrap("verify_staged_claim", (args) => engine.verifyStagedClaim(args)),
    },
    {
      name: "reset_sandbox",
      description:
        "Remove staged in-memory patches for one claim or the entire demo. This affects only local page state and performs no external write.",
      inputSchema: {
        type: "object",
        properties: {
          claim_id: {
            type: "string",
            enum: ["sso-plan", "retention-days", "eu-residency", "audit-log-days"],
            description: "Optional claim to reset. Omit to reset every staged patch.",
          },
        },
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        untrustedContentHint: false,
      },
      execute: wrap("reset_sandbox", (args) => engine.resetSandbox(args)),
    },
  ];
}

export function registerWebMCPTools(toolDefinitions) {
  const modelContext = document.modelContext ?? navigator.modelContext;
  if (!modelContext?.registerTool) {
    return {
      supported: false,
      registered: 0,
      dispose: () => {},
      reason: "document.modelContext is unavailable in this browser.",
    };
  }

  const controller = new AbortController();
  const errors = [];
  let registered = 0;

  for (const tool of toolDefinitions) {
    try {
      modelContext.registerTool(tool, { signal: controller.signal });
      registered += 1;
    } catch (error) {
      errors.push({
        tool: tool.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    supported: true,
    registered,
    errors,
    dispose: () => controller.abort(),
  };
}

export async function executeLocalTool(toolDefinitions, name, args = {}) {
  const tool = toolDefinitions.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Unknown local tool: ${name}`);
  return tool.execute(args);
}
