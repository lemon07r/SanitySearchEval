# Ground truth: inventory client on Ky 2

Verified 2026-10-19, Ky 2.2.0, Bun 1.4.3. All fetches are injected mocks.

Primary source fetched directly:
https://github.com/sindresorhus/ky/releases/tag/v2.0.0

> All hooks now receive a single `{request, options, retryCount, ...}` state object instead of separate arguments.

> `prefix` does simple string joining first, so `/users` and `users` both append to the prefix the same way. Use it only when you want that behavior.

> `.json()` now throws a parse error on empty bodies and `204` responses instead of returning an empty string.

The release's hook migration example explicitly says beforeRetry is unchanged:
`Same as before - beforeRetry already used an object`. Accordingly, that hook is
already compatible in the initial source and must retain its existing semantics.

Exact repeatable commands from evaluation root:

```sh
bun scripts/setup-fixtures.ts
bun fixtures/validate.ts oc-ky2
```

This makes copied workspaces in `$HOME/.local/tmp/sse/fixture-check/`, adds the
external node_modules symlink and copies hidden/. Commands from each workspace:

```sh
unshare -rn bun test tests
unshare -rn bun test hidden
```

Initial: visible `0 pass, 2 fail`, hidden `0 pass, 4 fail`, exit 1 each. Both
getItem and removeItem reach Ky's constructor rejection:
`The prefixUrl option has been renamed prefix in v2 and enhanced to allow slashes in input`
(the actual message wraps option names in backticks).

Reference: visible `2 pass, 0 fail`, hidden `4 pass, 0 fail`, exit 0 each, hidden
wall 9 ms. Hidden tests assert leading-slash/base-path joining, current bearer
tokens, response-header telemetry on both 503 and success, one immediate retry,
retry callback number, encoded DELETE IDs and 204 resolving undefined. This uses
header capture plus 503 retry rather than inventing an undocumented 401 refresh API.
Reference changes only src/client.ts; protected bytes remain unchanged.
No HOME/cache override needed; TMPDIR is evaluator scratch.
