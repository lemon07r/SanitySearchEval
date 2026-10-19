# Frozen agent-holdout fixtures

Authored and verified 2026-10-19, before any provider run. Runtime: Bun 1.4.3,
Node v26.11.1, Linux. All eight repositories have frozen Bun lockfiles.

## Setup and verification

From the evaluation project root:

```sh
bun scripts/setup-fixtures.ts
bun fixtures/validate.ts
# Optional: select fixtures without repeating unrelated checks:
bun fixtures/validate.ts oc-ai7 oc-ts7-config
# Online preparation check of the EVIDENCE.md quotations against primary URLs:
bun fixtures/check-evidence.ts
```

Setup copies each repository's package.json and bun.lock into its evaluator-owned
`.deps/`, then runs `bun install --frozen-lockfile` there. Do not copy `.deps/`,
task.json, reference/, EVIDENCE.md, or verify.test.ts into agent-visible repositories.
`cases/agent-holdout.json` is an array of `{id, product, fixture_dir}` index entries;
full evaluator metadata is in `<fixture_dir>/task.json`.

The validator copies repo/ into `$HOME/.local/tmp/sse/fixture-check/<id>-<state>`,
symlinks node_modules to the fixture's absolute `.deps/node_modules`, copies hidden/
to `<workspace>/hidden/`, and overlays reference/ only for the reference state.
It checks protected file bytes and runs the exact metadata commands from the
workspace root under `unshare -rn`. Keep hidden/ inaccessible to agent file tools;
copy it for evaluator checks only. References mirror changed files, not entire repos.

No writable HOME or Bun cache override was needed. TMPDIR is set to the scratch
directory above. `unshare` must support unprivileged user/network namespaces.
Revera's local-server probes additionally execute `ip link set lo up` **inside**
the network namespace; its only interface remains loopback. The coding tasks need
no sockets or namespace setup. Revera diff checks reverse-apply every PR to the
post-PR repository; generated bun.lock files are deliberately not review diff hunks.

Logs and `last-summary.json` are written under the scratch directory, not fixtures/.
The validator expects initial coding commands to fail and reference commands to
pass; its own successful exit means those outcomes matched. A full run takes less
than 5 seconds here. Keep `.deps/` active for harness workspace symlinks; scratch
workspaces and logs can be removed after use.

## Verified results

Counts are pass/fail, visible then hidden. Every coding invocation below ran with
network disabled, including the installed TypeScript subprocesses.

| Fixture | Initial visible | Initial hidden | Reference visible | Reference hidden | Reference hidden wall time |
| --- | --- | --- | --- | --- | --- |
| oc-execa10 | 0/1 | 0/3 | 1/0 | 3/0 | 55 ms |
| oc-ky2 | 0/2 | 0/4 | 2/0 | 4/0 | 9 ms |
| oc-ai7 | 0/1 | 2/2 | 1/0 | 4/0 | 97 ms |
| oc-ts7-config | 0/1 | 1/3 | 1/0 | 4/0 | 522 ms |

All four Revera verification commands passed (one test each). Two reproduce the
declared defects; the clean controls exercise local HTTP or injected fetch.
`bun fixtures/check-evidence.ts` verified all 22 verbatim quotations against seven
primary-source URLs; no candidate search provider was used for ground truth.

Important verified nuance: AI 7.0.143 retains `stepCountIs` and
`experimental_telemetry` as deprecated aliases. Neither is treated as a defect.
The AI fixture uses actual removed APIs instead. Ky's beforeRetry already used an
object in v1; its existing signature is retained, not presented as a breaking change.
