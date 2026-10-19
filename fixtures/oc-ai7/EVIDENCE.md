# Ground truth: actual AI 7 removals

Verified 2026-10-19: ai 7.0.143, zod 4.3.6, TypeScript 7.0.2, Bun 1.4.3.
Tests use the package's `ai/test` MockLanguageModelV3; no provider or network.

Primary source fetched directly:
https://github.com/vercel/ai/releases/tag/ai%407.0.0

> Remove the deprecated `ToolCallOptions` export.

> Use `ToolExecutionOptions` instead.

> Remove the deprecated `experimental_prepareStep` option from `generateText`.

> Use `prepareStep` instead.

Important correction to the candidate task: **stepCountIs is still a working
deprecated alias in 7.0.143**, so changing it is not required for success.
experimental_telemetry also remains in the installed declarations. Session probe
`bun api-probe.ts` printed stepCountIs/function and isStepCount/function.
The fixture therefore uses only the two actual removals above as failures.

Exact validation:

```sh
bun scripts/setup-fixtures.ts
bun fixtures/validate.ts oc-ai7
```

The validator reproduces workspace copying, hidden/ placement and external
node_modules symlinks under `$HOME/.local/tmp/sse/fixture-check/`. For each state:

```sh
unshare -rn bun test tests
unshare -rn bun test hidden
```

The hidden type test actually spawns
`node <workspace>/node_modules/typescript/bin/tsc --noEmit --pretty false` with a
10-second timeout. Bun's transpilation alone is not treated as a typecheck.

Initial: visible `0 pass, 1 fail`, hidden `2 pass, 2 fail`, exit 1 each. Reached
diagnostics (not inferred from release notes):

```text
src/assistant.ts(16,5): error TS2353: ... 'experimental_prepareStep' does not exist in type ...
src/tools.ts(1,20): error TS2305: Module '"ai"' has no exported member 'ToolCallOptions'.
```

The runtime test also reaches generateText: the removed option is ignored, so the
mock receives auto policy, returns an unverified answer and only one step runs.

Reference: visible `1 pass, 0 fail`, hidden `4 pass, 0 fail`, exit 0 each; hidden
wall 97 ms, including tsc. Assertions cover forced first tool, later auto policy,
exact prompt, lookup input/output, tool call ID/messages audit data, and limits
1/2/default 3 under repeated tool calls. Reference changes only the two src files;
protected bytes are unchanged. No HOME/cache override needed; TMPDIR is scratch.
