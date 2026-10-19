# Ground truth: relay HTTP agent rejection

Verified 2026-10-19, Bun 1.4.3 / Node v26.11.1. Installed versions: Got 16.1.0,
http2-wrapper 2.2.1. This is a **bug** PR.

Primary source fetched directly:
https://github.com/sindresorhus/got/releases/tag/v16.0.0

> `agent.http2` is no longer an agent slot. It is only an opt-out flag now: pass `false` to skip session pooling. Passing an agent instance throws.

The failing production path is reached by calling exported readStatus, not by an
isolated option inspection. The verifier starts a local server, calls readStatus,
asserts the rejection names agent.http2 and confirms the server handled zero requests.

Exact fixture check command from the project root:

```sh
bun scripts/setup-fixtures.ts
bun fixtures/validate.ts rv-got16-http2-agent
```

The original all-fixture run executed `unshare -rn bun test validation` from
`$HOME/.local/tmp/sse/fixture-check/rv-got16-http2-agent-post-pr`:
`1 pass, 0 fail`, exit 0, wall 39 ms. The validator now also enables loopback for
all Revera checks, so the local server can receive requests if dispatch is reached.

Additional exact session probe (in the temporary dependency probe project):
`bun api-probe.ts`. It awaited each of got15 and got with
`{http2:true, request:http2wrapper.auto, agent:{http2:new http2wrapper.Agent({maxSessions:2})}, retry:{limit:0}}`
against `http://127.0.0.1:1` and caught the messages:

```text
got15 connect ECONNREFUSED 127.0.0.1:1
got16 Option 'agent.http2': Expected values which are `undefined` or `predicate returns truthy for any value`. Received values of type `Object`.
```

Thus 15.1.0 accepts the option and reaches transport; 16.1.0 fails normalization.
The nearby timeout tweak is unrelated. The retained request override need not be
classified as a second defect; the agent value alone rejects every health poll.
