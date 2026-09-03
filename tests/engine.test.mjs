import test from "node:test";
import assert from "node:assert/strict";
import { TruthEngine } from "../src/engine.mjs";

const engine = () => new TruthEngine();

test("product summary separates BLOCK, ALIGNED, and NOT_EVALUATED", () => {
  const summary = engine().inspectProductTruth();
  assert.deepEqual(summary.counts, {
    BLOCK: 4,
    REVIEW: 0,
    ALIGNED: 1,
    NOT_EVALUATED: 1,
  });
});

test("runtime evidence binds the SSO verdict", () => {
  const result = engine().evaluateClaim("sso-plan");
  assert.equal(result.verdict, "BLOCK");
  assert.equal(result.authoritative.id, "runtime-sso");
  assert.equal(result.authoritative.value, "enterprise");
  assert.deepEqual(
    result.conflicts.map((item) => item.id).sort(),
    ["marketing-sso", "pricing-sso"],
  );
});

test("model-proposed evidence cannot bind a claim", () => {
  const result = engine().evaluateClaim("scim-provisioning");
  assert.equal(result.verdict, "NOT_EVALUATED");
  assert.equal(result.authoritative, null);
});

test("staging changes only patchable customer surfaces", () => {
  const subject = engine();
  const staged = subject.stageResolution({
    claim_id: "sso-plan",
    scope: "all_customer_surfaces",
  });
  assert.equal(staged.repository_writes, 0);
  assert.equal(staged.network_writes, 0);
  assert.equal(staged.patches.length, 2);
  assert.equal(subject.evaluateClaim("sso-plan").verdict, "ALIGNED");
  assert.equal(
    subject.verifyStagedClaim({ claim_id: "sso-plan" }).verification_state,
    "STAGED_CONSISTENT_NON_ISSUING",
  );
});

test("reset restores the original conflict", () => {
  const subject = engine();
  subject.stageResolution({ claim_id: "sso-plan" });
  subject.resetSandbox({ claim_id: "sso-plan" });
  assert.equal(subject.evaluateClaim("sso-plan").verdict, "BLOCK");
  assert.equal(subject.patches.length, 0);
});
