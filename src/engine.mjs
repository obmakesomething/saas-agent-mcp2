import { claims, evidence, product, sourceKinds } from "./data.mjs";

const STRONG_PROVENANCE = new Set(["OBSERVED", "DERIVED_DETERMINISTIC"]);

function assertClaim(claimId) {
  const claim = claims.find((item) => item.id === claimId);
  if (!claim) throw new Error(`Unknown claim_id: ${claimId}`);
  return claim;
}

function cloneEvidence(item, patch) {
  if (!patch) return { ...item, authority: sourceKinds[item.sourceKind].authority };
  return {
    ...item,
    authority: sourceKinds[item.sourceKind].authority,
    value: patch.value,
    displayValue: patch.displayValue,
    statement: patch.statement,
    staged: true,
    originalValue: item.value,
    originalDisplayValue: item.displayValue,
    originalStatement: item.statement,
  };
}

export class TruthEngine {
  #patches = new Map();
  #listener = () => {};

  constructor({ onChange } = {}) {
    if (onChange) this.#listener = onChange;
  }

  setOnChange(listener) {
    this.#listener = typeof listener === "function" ? listener : () => {};
  }

  get patches() {
    return [...this.#patches.entries()].map(([evidenceId, patch]) => ({
      evidenceId,
      ...patch,
    }));
  }

  getEvidence(claimId) {
    assertClaim(claimId);
    return evidence
      .filter((item) => item.claimId === claimId)
      .map((item) => cloneEvidence(item, this.#patches.get(item.id)))
      .sort((a, b) => b.authority - a.authority || a.id.localeCompare(b.id));
  }

  authoritativeEvidence(claimId) {
    const candidates = this.getEvidence(claimId)
      .filter((item) => STRONG_PROVENANCE.has(item.provenance))
      .filter((item) => item.sourceKind === "RUNTIME" || item.sourceKind === "CONTRACT" || item.sourceKind === "REPO")
      .sort((a, b) => b.authority - a.authority || b.confidence - a.confidence);
    return candidates[0] ?? null;
  }

  evaluateClaim(claimId) {
    const claim = assertClaim(claimId);
    const items = this.getEvidence(claimId);
    const authoritative = this.authoritativeEvidence(claimId);
    const strong = items.filter((item) => STRONG_PROVENANCE.has(item.provenance));
    const values = [...new Set(strong.map((item) => item.value))];

    if (!authoritative) {
      return {
        claim,
        verdict: "NOT_EVALUATED",
        reason: "No runtime, contract, or deterministic repository evidence can bind this claim.",
        authoritative: null,
        conflicts: [],
        evidence: items,
        staged: items.some((item) => item.staged),
      };
    }

    const conflicts = strong.filter((item) => item.value !== authoritative.value);
    const customerConflict = conflicts.some((item) => item.customerFacing);
    const staged = items.some((item) => item.staged);

    let verdict = "ALIGNED";
    let reason = "Customer-facing and authoritative evidence agree.";
    if (conflicts.length > 0 && customerConflict) {
      verdict = "BLOCK";
      reason = "A customer-facing promise contradicts authoritative product behavior.";
    } else if (values.length > 1) {
      verdict = "REVIEW";
      reason = "Strong evidence disagrees, but the conflict is not currently customer-facing.";
    }

    return {
      claim,
      verdict,
      reason,
      authoritative,
      conflicts,
      evidence: items,
      staged,
      verificationState:
        staged && conflicts.length === 0 ? "STAGED_CONSISTENT_NON_ISSUING" : null,
    };
  }

  inspectProductTruth({ include_aligned = true } = {}) {
    const results = claims.map((claim) => this.evaluateClaim(claim.id));
    const included = include_aligned
      ? results
      : results.filter((result) => result.verdict !== "ALIGNED");
    const counts = results.reduce(
      (acc, result) => {
        acc[result.verdict] += 1;
        return acc;
      },
      { BLOCK: 0, REVIEW: 0, ALIGNED: 0, NOT_EVALUATED: 0 },
    );

    return {
      product: {
        id: product.id,
        name: product.name,
        release: product.release,
        inspected_at: product.inspectedAt,
      },
      counts,
      claim_ceiling:
        "This demo can establish evidence alignment or staged consistency. It cannot claim production readiness or VERIFIED_FIXED.",
      claims: included.map((result) => ({
        claim_id: result.claim.id,
        title: result.claim.title,
        decision: result.claim.decision,
        verdict: result.verdict,
        conflict_count: result.conflicts.length,
        verification_state: result.verificationState,
      })),
    };
  }

  findClaimConflicts({ decision, verdict = "BLOCK" } = {}) {
    let results = claims.map((claim) => this.evaluateClaim(claim.id));
    if (decision) {
      results = results.filter(
        (result) => result.claim.decision.toLowerCase() === decision.toLowerCase(),
      );
    }
    if (verdict !== "ANY") {
      results = results.filter((result) => result.verdict === verdict);
    }

    return {
      count: results.length,
      conflicts: results.map((result) => ({
        claim_id: result.claim.id,
        title: result.claim.title,
        verdict: result.verdict,
        reason: result.reason,
        authoritative_value: result.authoritative?.displayValue ?? null,
        contradictory_surfaces: result.conflicts.map((item) => ({
          evidence_id: item.id,
          source: item.sourceLabel,
          observed_value: item.displayValue,
          locator: item.locator,
        })),
      })),
    };
  }

  traceClaimEvidence({ claim_id }) {
    const result = this.evaluateClaim(claim_id);
    return {
      claim_id,
      title: result.claim.title,
      verdict: result.verdict,
      reason: result.reason,
      authoritative_evidence_id: result.authoritative?.id ?? null,
      chain: result.evidence.map((item) => ({
        evidence_id: item.id,
        source_kind: item.sourceKind,
        source: item.sourceLabel,
        locator: item.locator,
        observed_value: item.displayValue,
        statement: item.statement,
        provenance: item.provenance,
        authority: item.authority,
        staged: Boolean(item.staged),
      })),
      claim_ceiling:
        result.verificationState ??
        "EVIDENCE_BOUND_NON_ISSUING",
    };
  }

  stageResolution({ claim_id, scope = "all_customer_surfaces" } = {}) {
    const result = this.evaluateClaim(claim_id);
    if (!result.authoritative) {
      throw new Error(`Cannot stage ${claim_id}: no authoritative value is bound.`);
    }

    const patchable = result.conflicts.filter((item) => item.mutable && item.customerFacing);
    const targets = scope === "first_conflict" ? patchable.slice(0, 1) : patchable;
    if (targets.length === 0) {
      return {
        claim_id,
        staged: false,
        message: "No contradictory customer-facing surface is patchable.",
        patches: [],
      };
    }

    const canonical = result.claim.canonicalText[result.authoritative.value];
    if (!canonical) {
      throw new Error(`No canonical sandbox copy exists for ${claim_id}.`);
    }

    const patches = targets.map((item) => {
      const patch = {
        value: result.authoritative.value,
        displayValue: result.authoritative.displayValue,
        statement: canonical,
        reason: `Align ${item.sourceLabel} with ${result.authoritative.sourceLabel}`,
      };
      this.#patches.set(item.id, patch);
      return {
        evidence_id: item.id,
        source: item.sourceLabel,
        before: item.statement,
        after: canonical,
      };
    });

    this.#listener({ type: "patch", claimId: claim_id, patches });
    return {
      claim_id,
      staged: true,
      scope,
      persistence: "local_memory_only",
      network_writes: 0,
      repository_writes: 0,
      patches,
      warning:
        "A staged copy change is not a production fix and cannot establish VERIFIED_FIXED.",
    };
  }

  verifyStagedClaim({ claim_id }) {
    const result = this.evaluateClaim(claim_id);
    return {
      claim_id,
      verdict: result.verdict,
      remaining_conflicts: result.conflicts.length,
      verification_state:
        result.verificationState ??
        (result.staged ? "STAGED_INCONSISTENT_NON_ISSUING" : "NO_STAGED_CHANGE"),
      authoritative_evidence_id: result.authoritative?.id ?? null,
      claim_ceiling:
        "This verifies only the in-memory evidence graph. Production behavior and deployed copy were not changed.",
    };
  }

  resetSandbox({ claim_id } = {}) {
    let removed = 0;
    for (const [evidenceId] of this.#patches) {
      const item = evidence.find((candidate) => candidate.id === evidenceId);
      if (!claim_id || item?.claimId === claim_id) {
        this.#patches.delete(evidenceId);
        removed += 1;
      }
    }
    if (claim_id) assertClaim(claim_id);
    this.#listener({ type: "reset", claimId: claim_id ?? null, removed });
    return {
      reset: true,
      claim_id: claim_id ?? null,
      removed_patch_count: removed,
    };
  }
}

export function getClaim(claimId) {
  return assertClaim(claimId);
}

export function listClaims() {
  return claims.map((claim) => ({ ...claim }));
}
