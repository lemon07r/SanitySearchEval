# Ground truth: correct snapshot transport migration

Verified 2026-10-19 against installed Got 16.1.0. This is a **clean** PR.

Primary source fetched directly:
https://github.com/sindresorhus/got/releases/tag/v16.0.0

> Remove `http2-wrapper` from your code. Got's HTTP/2 client is built in.

> To opt out of HTTP/2 session pooling for a request, set `agent.http2` to `false`.

> Response headers no longer contain HTTP/2 pseudo-headers. Use `response.statusCode` instead of `response.headers[':status']`.

The PR removes the wrapper dependency and request override, passes the supported
false pooling opt-out and uses response.statusCode. No stale pseudo-header read
remains. Polling's timeout, retry, JSON parsing and failure behavior are retained.

Exact commands:

```sh
bun scripts/setup-fixtures.ts
bun fixtures/validate.ts rv-got16-migrate
```

The validator used a real local node:http server in an isolated network namespace:

```sh
unshare -rn sh -c 'ip link set lo up && exec "$@"' fixture-check bun test validation
```

Output: `1 pass, 0 fail`, exit 0, wall 39 ms. readSnapshot of `/snapshot` returned
`{status:201, requestId:'local-42', payload:{service:'queue',pending:3}}`;
`/missing` rejected with response.statusCode 418. The server saw both paths.
This tests native HTTP/1.1 fallback with http2 enabled, not a mock transport.

One preliminary check failed with ECONNREFUSED because `unshare -rn` leaves lo
DOWN, demonstrated by `unshare -rn ip link show lo`. The focused retry enabled only
loopback and passed. No application changes or weakened assertions were needed.
