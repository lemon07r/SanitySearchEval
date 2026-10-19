# Ground truth: correct queue client migration

Verified 2026-10-19, installed Ky 2.2.0 / Bun 1.4.3. This is a **clean** PR.

Primary source fetched directly:
https://github.com/sindresorhus/ky/releases/tag/v2.0.0

> All hooks now receive a single `{request, options, retryCount, ...}` state object instead of separate arguments.

> Rename `prefixUrl` to [`prefix`](https://github.com/sindresorhus/ky#prefix), and allow leading slashes in input

> `.json()` now throws a parse error on empty bodies and `204` responses instead of returning an empty string.

The PR correctly changes prefix and both positional hooks, and waits for DELETE
without invoking a JSON parser. JSON is still parsed for the JSON GET endpoint.

Exact commands from the project root:

```sh
bun scripts/setup-fixtures.ts
bun fixtures/validate.ts rv-ky2-migrate
```

Result from the copied workspace with external node_modules symlink: `1 pass,
0 fail`, exit 0, wall 8 ms, inside a network namespace with only loopback enabled.
Injected fetch observed GET then DELETE of
`https://queue.invalid/admin/queues/a%2Fb`, both with `Bearer queue-token`.
GET returned `{id:'a/b',paused:false}`, empty 204 DELETE resolved undefined, and
the response hook observed `[200,204]`. No internet requests were made.
