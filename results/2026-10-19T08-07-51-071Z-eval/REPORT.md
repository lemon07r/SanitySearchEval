# Search API evaluation

Directional small-sample results; no blended score or claim of statistical superiority. Failures remain in every denominator. Costs distinguish estimates from returned dollars; unknown is not zero. Latencies include retries. No recommendation is inferred without completed evaluations.

## Retrieval

| Profile | url@1 / @3 / @5 | evidence@1 / @3 / @5 | evidence@5 Wilson 95% | read_ok | evidence_in_read | search p50/p90 ms | search+read p50/p90 ms | median visible tokens | USD/query est / metered | USD/evidenced query est / metered | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

### Per-case paired evidence matrix

| Case |
| --- |

## Revera

| Arm | Bugs found / available | Reported FPs / clean PRs | Uncertain | Completion | Model calls | Tokens input/output/cache-read/cache-write | Model USD est | Search+read USD est / metered | Wall ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| brave:web | 2/2 | 1 / 2 | 0 | {"complete":4} | 20 | 48 / 5531 / 98577 / 49648 | $0.37877 | $0.02500 / unknown | 182792 |
| exa:auto | 2/2 | 0 / 2 | 0 | {"complete":4} | 16 | 40 / 4430 / 78339 / 37179 | $0.29032 | $0.03000 / $0.03000 | 160066 |
| firecrawl:search | 2/2 | 0 / 2 | 1 | {"complete":4} | 20 | 48 / 5310 / 122690 / 67969 | $0.47077 | $0.01584 / unknown | 197790 |
| none | 0/2 | 0 / 2 | 1 | {"complete":4} | 14 | 36 / 5242 / 24901 / 9322 | $0.15657 | $0.00000 / $0.00000 | 158220 |
| parallel:fast | 2/2 | 1 / 2 | 1 | {"complete":4} | 19 | 46 / 5783 / 123684 / 59133 | $0.43625 | $0.00700 / unknown | 196356 |
| tavily:advanced | 2/2 | 1 / 2 | 0 | {"complete":4} | 19 | 46 / 5247 / 109678 / 63190 | $0.44301 | $0.08800 / unknown | 209596 |

### Revera task outcomes

| Task | Arm / rep | Bugs | FPs | Uncertain | Completion |
| --- | --- | --- | --- | --- | --- |
| rv-got16-migrate | tavily:advanced / 1 | 0/0 | 1 | 0 | complete |
| rv-ky2-migrate | brave:web / 1 | 0/0 | 0 | 0 | complete |
| rv-commander15-negate | none / 1 | 0/1 | 0 | 0 | complete |
| rv-ky2-migrate | parallel:fast / 1 | 0/0 | 0 | 0 | complete |
| rv-got16-migrate | exa:auto / 1 | 0/0 | 0 | 0 | complete |
| rv-ky2-migrate | tavily:advanced / 1 | 0/0 | 0 | 0 | complete |
| rv-commander15-negate | parallel:fast / 1 | 1/1 | 0 | 0 | complete |
| rv-got16-migrate | firecrawl:search / 1 | 0/0 | 0 | 1 | complete |
| rv-got16-migrate | brave:web / 1 | 0/0 | 1 | 0 | complete |
| rv-got16-http2-agent | exa:auto / 1 | 1/1 | 0 | 0 | complete |
| rv-ky2-migrate | none / 1 | 0/0 | 0 | 0 | complete |
| rv-commander15-negate | tavily:advanced / 1 | 1/1 | 0 | 0 | complete |
| rv-ky2-migrate | exa:auto / 1 | 0/0 | 0 | 0 | complete |
| rv-got16-http2-agent | firecrawl:search / 1 | 1/1 | 0 | 0 | complete |
| rv-got16-http2-agent | brave:web / 1 | 1/1 | 0 | 0 | complete |
| rv-got16-migrate | none / 1 | 0/0 | 0 | 0 | complete |
| rv-got16-migrate | parallel:fast / 1 | 0/0 | 1 | 1 | complete |
| rv-commander15-negate | firecrawl:search / 1 | 1/1 | 0 | 0 | complete |
| rv-commander15-negate | exa:auto / 1 | 1/1 | 0 | 0 | complete |
| rv-commander15-negate | brave:web / 1 | 1/1 | 0 | 0 | complete |
| rv-ky2-migrate | firecrawl:search / 1 | 0/0 | 0 | 0 | complete |
| rv-got16-http2-agent | parallel:fast / 1 | 1/1 | 0 | 0 | complete |
| rv-got16-http2-agent | none / 1 | 0/1 | 0 | 1 | complete |
| rv-got16-http2-agent | tavily:advanced / 1 | 1/1 | 0 | 0 | complete |

### Reported clean-task and unmatched bug-task findings

| Task | Arm | Kind | File:line | Title | Explanation | Confidence | Citations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rv-got16-migrate | tavily:advanced | clean-task FP (predeclared clean control) | src/client.ts:7 | `agent: {http2: false}` turns off HTTP/2 session reuse, so each snapshot read opens a new connection | What got documents: the got v16 release notes and the options page both say `agent.http2` is now only an opt-out flag, and `false` skips HTTP/2 session pooling. With `http2: true` and no `agent` set, got uses its built-in pooled session cache. The migration guide's "After" example is just `{http2: true}`, with no `agent`.<br><br>What the code shows: before this PR, the client used `new http2wrapper.Agent({maxSessions: 1})`, so requests shared one pooled HTTP/2 session. The new `agent: {http2: false}` doesn't keep that behavior; it switches pooling off. So every `readSnapshot` call, including the one retry, will do a fresh TCP + TLS + ALPN handshake instead of reusing a session. That adds latency and load, and makes it more likely a request hits the tight 2500 ms `timeout.request`.<br><br>Fix: delete the `agent` line so got uses its default pooled session cache, which matches the migration guide. I couldn't check whether got's default pool limits sessions the way the old `maxSessions: 1` did. | medium | https://github.com/sindresorhus/got/releases, https://github.com/sindresorhus/got/blob/main/documentation/2-options.md |
| rv-got16-migrate | brave:web | clean-task FP (predeclared clean control) | src/client.ts:7 | `agent: {http2: false}` turns off HTTP/2 session pooling, which the old shared agent provided | [brave result not retained] | medium |  |
| rv-got16-http2-agent | brave:web | unmatched; manual adjudication required | src/client.ts:10 | Leftover http2-wrapper setup conflicts with got 16's built-in HTTP/2 client | [brave result not retained] | medium |  |
| rv-got16-migrate | parallel:fast | clean-task FP (predeclared clean control) | src/client.ts:7 | `agent: {http2: false}` turns off HTTP/2 session pooling, a regression from the old pooled single session | Documented fact (got v16.0.0 release notes): `agent.http2` "is only an opt-out flag now: pass `false` to skip session pooling". The migration guide's replacement for the http2-wrapper Agent setup is just `{http2: true}`, which keeps got's built-in pooled session cache with multiplexing. Code evidence: before this PR, the client passed `new http2wrapper.Agent({maxSessions: 1})`, so connections were pooled and reused. After it, `agent: {http2: false}` skips pooling. Every `readSnapshot` call, and every retry (`retry.limit: 1`), now pays for a new TCP+TLS+HTTP/2 handshake inside the 2500 ms request timeout. That adds latency and load on the server and can cause more timeouts. The description calls this a simplification of the transport setup, not an intentional end to connection reuse. Suggested fix: remove the `agent` option, or leave `agent.http2` undefined, so got's built-in pool is used. | medium | https://github.com/sindresorhus/got/releases, https://github.com/sindresorhus/got/blob/main/source/core/options.ts |
| rv-got16-http2-agent | tavily:advanced | unmatched; manual adjudication required | src/client.ts:10 | `request: http2wrapper.auto` skips got 16's built-in HTTP/2 client, so the migration is incomplete | What the docs say: per the v16 notes, if `options.request` returns a request, it controls the transport and got's own HTTP/2 client is skipped. The migration guide says to remove http2-wrapper from your code (`request: http2wrapper.auto` plus `agent.http2`). It says to keep http2-wrapper only when you need an HTTP/2 proxy. What the code does: once the agent problem is fixed, keeping `request: http2wrapper.auto` would still send requests through the old http2-wrapper 2.2.1 transport and bypass got 16's built-in client. This last point is my inference from the docs, so it is not certain. Remove it together with the agent change. | medium | https://github.com/sindresorhus/got/releases |

## OpenCode

| Arm | All-pass tasks | Violations | Timeouts | Tool calls | Model USD est | Search+read USD est / metered | Wall ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| brave:web | 3/4 | 0 | 0 | 52 | $0.35619 | $0.02500 / unknown | 235963 |
| exa:auto | 4/4 | 0 | 0 | 53 | $0.41949 | $0.04200 / $0.04200 | 277678 |
| firecrawl:search | 3/4 | 0 | 0 | 52 | $0.45005 | $0.01089 / unknown | 222289 |
| none | 4/4 | 0 | 0 | 47 | $0.23603 | $0.00000 / $0.00000 | 217855 |
| parallel:fast | 3/4 | 0 | 0 | 52 | $0.42107 | $0.00500 / unknown | 239344 |
| tavily:advanced | 3/4 | 0 | 0 | 51 | $0.41835 | $0.06400 / unknown | 242674 |

### OpenCode task outcomes

| Task | Arm / rep | Hidden tests pass/total | All pass | Violations | Completion | Model calls | Tokens input/output/cache-read/cache-write | Wall ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| oc-ai7 | exa:auto / 1 | 4/4 | true | none | complete | 8 | 18 / 2516 / 49410 / 19020 | 86407 |
| oc-ai7 | parallel:fast / 1 | 3/4 | false | none | complete | 7 | 16 / 2239 / 46776 / 22324 | 60131 |
| oc-ts7-config | firecrawl:search / 1 | 4/4 | true | none | complete | 5 | 12 / 814 / 11365 / 2928 | 49345 |
| oc-ts7-config | tavily:advanced / 1 | 4/4 | true | none | complete | 5 | 12 / 1005 / 12201 / 2274 | 45907 |
| oc-ts7-config | brave:web / 1 | 4/4 | true | none | complete | 5 | 12 / 874 / 12204 / 2168 | 35406 |
| oc-execa10 | firecrawl:search / 1 | 3/3 | true | none | complete | 7 | 16 / 2131 / 31379 / 16096 | 70340 |
| oc-execa10 | none / 1 | 3/3 | true | none | complete | 6 | 14 / 2305 / 12350 / 3669 | 58389 |
| oc-execa10 | exa:auto / 1 | 3/3 | true | none | complete | 8 | 18 / 1974 / 34082 / 11813 | 86336 |
| oc-ts7-config | none / 1 | 4/4 | true | none | complete | 5 | 12 / 949 / 10360 / 3045 | 49011 |
| oc-execa10 | brave:web / 1 | 3/3 | true | none | complete | 6 | 14 / 1881 / 19215 / 4677 | 49541 |
| oc-execa10 | parallel:fast / 1 | 3/3 | true | none | complete | 8 | 18 / 2681 / 35863 / 14369 | 86432 |
| oc-ts7-config | parallel:fast / 1 | 4/4 | true | none | complete | 5 | 12 / 963 / 12748 / 2519 | 49368 |
| oc-execa10 | tavily:advanced / 1 | 3/3 | true | none | complete | 7 | 16 / 2385 / 37256 / 18495 | 71485 |
| oc-ai7 | none / 1 | 4/4 | true | none | complete | 6 | 14 / 2010 / 16615 / 4756 | 52373 |
| oc-ai7 | tavily:advanced / 1 | 3/4 | false | none | complete | 9 | 20 / 2335 / 69481 / 21117 | 86080 |
| oc-ts7-config | exa:auto / 1 | 4/4 | true | none | complete | 5 | 12 / 925 / 11626 / 2885 | 41883 |
| oc-ai7 | brave:web / 1 | 3/4 | false | none | complete | 8 | 18 / 2374 / 62969 / 18015 | 86756 |
| oc-ai7 | firecrawl:search / 1 | 3/4 | false | none | complete | 9 | 20 / 2603 / 85549 / 18698 | 62485 |
| oc-ky2 | tavily:advanced / 1 | 4/4 | true | none | complete | 5 | 12 / 1836 / 17602 / 6031 | 39202 |
| oc-ky2 | none / 1 | 4/4 | true | none | complete | 6 | 14 / 2625 / 15004 / 1963 | 58082 |
| oc-ky2 | exa:auto / 1 | 4/4 | true | none | complete | 7 | 16 / 1912 / 47604 / 15112 | 63052 |
| oc-ky2 | brave:web / 1 | 4/4 | true | none | complete | 7 | 16 / 1992 / 39359 / 12496 | 64260 |
| oc-ky2 | parallel:fast / 1 | 4/4 | true | none | complete | 5 | 12 / 1734 / 17979 / 9952 | 43413 |
| oc-ky2 | firecrawl:search / 1 | 4/4 | true | none | complete | 6 | 14 / 2026 / 32685 / 15503 | 40119 |

## Manual adjudication (2026-10-19)

The tables above are scored strictly against the frozen fixture truth and are not
changed by this section. These notes record my reading of every reported
clean-task and unmatched finding.

### Clean control `rv-got16-migrate`: the "pooling" finding

Brave, Parallel and Tavily each reported one finding on the clean control. It was
the same finding every time: the PR replaces a pooled
`new http2wrapper.Agent({maxSessions: 1})` with `agent: {http2: false}`, and the
Got 16 release notes say `false` opts out of HTTP/2 session pooling.
Firecrawl raised the same point as an uncertain item.

- **The factual premise is correct.** The fixture's own `EVIDENCE.md` quotes the
  same release-note sentence. The fixture author picked `agent.http2: false` as a
  supported option, not as a pooling-neutral one.
- **Whether it is a defect is a judgment call.** The PR description only says it
  "simplifies its transport setup". Quietly dropping connection reuse on a polling
  client is the kind of change a careful human reviewer could reasonably ask about.
  Every model rated it medium or low confidence and called it a
  performance or behavior change, not a correctness bug.
- **Adjudication:** a defensible, non-blocking review comment, not a hallucinated
  false positive. This clean control is weaker than intended, because the "clean"
  PR contains a debatable behavior change that you can only see with the Got 16
  docs. That is also why the no-search arm never raised it.
- The **strict** count is still reported above. Under adjudication, no arm produced
  a hallucinated false positive on either clean control in the quick pass.

### Bug task `rv-got16-http2-agent`: unmatched findings

Brave and Tavily also reported that `request: http2wrapper.auto` bypasses Got 16's
built-in HTTP/2 client. They raised this alongside the matched known bug.

- The Got 16 release notes say to remove `http2-wrapper` and that a custom
  `options.request` controls the transport. The finding follows from that, and the
  fixture's `EVIDENCE.md` notes the leftover override "need not be classified as a
  second defect".
- **Adjudication:** a valid secondary observation (incomplete migration), not a
  false positive.

### Uncertain items

- `rv-got16-migrate` / Parallel (low confidence): "`^16.1.0` may not exist (the
  releases page lists v16.0.0 as Latest)". **Wrong:** Got 16.1.0 is installed and
  pinned in the fixture's `bun.lock`. A stale or partial search result produced a
  false doubt. It was correctly marked uncertain rather than reported.
- `rv-got16-migrate` / Firecrawl: the pooling point above, marked uncertain.
- `rv-got16-http2-agent` / none: "Check that got 16 still supports the HTTP/2
  options this client uses" (low). This is the right suspicion, but without a source
  it could not be confirmed, so it does not count as finding the bug.

### Harness incident affecting `oc-ky2` (fixed, rerun)

The first quick pass had every arm at 1/4 hidden tests on `oc-ky2`. The cause was a
harness bug: workspace writes went through the artifact redactor, so
`` `Bearer [REDACTED]}` `` was saved as `Bearer [REDACTED]}`. The fix,
the scan showing only `oc-ky2` was affected, and the rerun are recorded in
`PROTOCOL.md` under Amendments. The superseded rows are kept in
`units.superseded-oc-ky2-redaction-bug.jsonl`.

### `oc-ai7`: why web arms lost a hidden test

Four of five web arms failed only the hidden `tsc --noEmit` test. They wrote
`ToolExecutionOptions` with no type argument, but in the installed `ai@7.0.143`
it is generic (`ToolExecutionOptions<CONTEXT>`). The no-search arm avoided the
import and defined its own type. The agent cannot run `tsc` or read
`node_modules` in this harness. A real OpenCode session could type-check and would
probably catch this, so this result says more about the harness than about the
providers. The confirmation reps (`results/2026-10-19T08-26-06-898Z-eval`) show
`oc-ai7` is noisy for every arm, including `none`.

## Limitations

Small, directional samples. Provider caches and changing documents can affect results. Model costs are list-price estimates, not proxy invoices. Unknown/failed calls are retained, and missing latencies are represented as zero elapsed only when no call was recorded. Clean-task findings are false positives under the frozen fixture truth; unmatched bug-task findings require manual adjudication. No reranker or embedding ablation is enabled. Absent cells mean not run, never a failure or success.
