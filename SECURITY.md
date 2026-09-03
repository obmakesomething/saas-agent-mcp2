# Security

This challenge build is a client-only, synthetic evidence sandbox.

- It performs no network write, repository write, deployment write, purchase, or account mutation.
- `stage_resolution` changes in-memory browser state only and is reset by reloading the page.
- Read-only tools declare `readOnlyHint: true`.
- State-changing tools declare their local-only side effects and use closed JSON Schemas.
- Bundled evidence is synthetic and does not contain customer or user data.
- Tool output is kept below the recommended 1.5K-character budget.

Report a vulnerability through GitHub's private vulnerability reporting flow when enabled, or open a minimal issue without sensitive exploit details.
