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
| exa:auto | 4/4 | 0 / 2 | 1 | {"complete":6} | 22 | 56 / 7025 / 79883 / 65227 | $0.48284 | $0.04500 / $0.04500 | 218584 |
| firecrawl:search | 4/4 | 1 / 2 | 0 | {"complete":6} | 33 | 78 / 8139 / 251661 / 99514 | $0.71099 | $0.02178 / unknown | 331707 |
| none | 0/4 | 0 / 2 | 3 | {"complete":6} | 24 | 60 / 9114 / 48305 / 20822 | $0.29629 | $0.00000 / $0.00000 | 255700 |

### Revera task outcomes

| Task | Arm / rep | Bugs | FPs | Uncertain | Completion |
| --- | --- | --- | --- | --- | --- |
| rv-commander15-negate | none / 2 | 0/1 | 0 | 0 | complete |
| rv-got16-http2-agent | none / 2 | 0/1 | 0 | 1 | complete |
| rv-commander15-negate | exa:auto / 2 | 1/1 | 0 | 0 | complete |
| rv-got16-http2-agent | firecrawl:search / 1 | 1/1 | 0 | 0 | complete |
| rv-got16-migrate | exa:auto / 1 | 0/0 | 0 | 0 | complete |
| rv-got16-migrate | firecrawl:search / 2 | 0/0 | 1 | 0 | complete |
| rv-got16-migrate | exa:auto / 2 | 0/0 | 0 | 1 | complete |
| rv-got16-http2-agent | none / 1 | 0/1 | 0 | 1 | complete |
| rv-got16-migrate | firecrawl:search / 1 | 0/0 | 0 | 0 | complete |
| rv-got16-http2-agent | exa:auto / 1 | 1/1 | 0 | 0 | complete |
| rv-commander15-negate | firecrawl:search / 2 | 1/1 | 0 | 0 | complete |
| rv-commander15-negate | firecrawl:search / 1 | 1/1 | 0 | 0 | complete |
| rv-got16-migrate | none / 1 | 0/0 | 0 | 0 | complete |
| rv-commander15-negate | none / 1 | 0/1 | 0 | 1 | complete |
| rv-commander15-negate | exa:auto / 1 | 1/1 | 0 | 0 | complete |
| rv-got16-migrate | none / 2 | 0/0 | 0 | 0 | complete |
| rv-got16-http2-agent | firecrawl:search / 2 | 1/1 | 0 | 0 | complete |
| rv-got16-http2-agent | exa:auto / 2 | 1/1 | 0 | 0 | complete |

### Reported clean-task and unmatched bug-task findings

| Task | Arm | Kind | File:line | Title | Explanation | Confidence | Citations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rv-got16-http2-agent | firecrawl:search | unmatched; manual adjudication required | src/client.ts:10 | `request: http2wrapper.auto` skips got v16's built-in HTTP/2 client | The v16 notes say: "If `options.request` returns a request or response, it controls the transport and the HTTP/2 client is bypassed." Suppose the agent problem above is fixed but `request: http2wrapper.auto` stays. Then requests still go through http2-wrapper's transport instead of got's new pooled HTTP/2 client, and they miss the HTTP/2 fixes in v16.0.0 and v16.1.0. The migration guide says to remove http2-wrapper unless you need an HTTP/2 proxy. This is lower severity than the agent crash. I'm reporting it so the migration is done fully. | medium | https://github.com/sindresorhus/got/releases |
| rv-got16-migrate | firecrawl:search | clean-task FP (predeclared clean control) | src/client.ts:7 | `agent: {http2: false}` turns off HTTP/2 session reuse; the old code reused one pooled session | Before this PR, the code passed `new http2wrapper.Agent({maxSessions: 1})`. That kept one pooled HTTP/2 session and reused it across calls to readSnapshot. The got v16.0.0 release notes say `agent.http2` "is only an opt-out flag now: pass `false` to skip session pooling" (source: release notes). Setting it to `false` therefore turns pooling off. It does not translate the old agent into the new API.<br><br>What I infer from the code (not tested): every readSnapshot call, and every retry, would open a new TLS and HTTP/2 session instead of multiplexing over one shared session. That adds a handshake to each request, which counts against the 2.5 s `timeout.request` limit, and it opens more connections to the snapshot server.<br><br>To get the closest match to the old behavior, delete the `agent` option so got uses its built-in pooled session cache. Then `http2: true` is all that's needed. I can't confirm from the docs whether got 16 can cap the pool at exactly one session. | medium | https://github.com/sindresorhus/got/releases |

## OpenCode

| Arm | All-pass tasks | Violations | Timeouts | Tool calls | Model USD est | Search+read USD est / metered | Wall ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| exa:auto | 1/2 | 0 | 0 | 33 | $0.35819 | $0.02300 / $0.02300 | 181108 |
| firecrawl:search | 1/2 | 0 | 0 | 36 | $0.36202 | $0.00990 / unknown | 146847 |
| none | 1/2 | 0 | 0 | 30 | $0.15917 | $0.00000 / $0.00000 | 161224 |

### OpenCode task outcomes

| Task | Arm / rep | Hidden tests pass/total | All pass | Violations | Completion | Model calls | Tokens input/output/cache-read/cache-write | Wall ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| oc-ai7 | none / 2 | 4/4 | true | none | complete | 8 | 18 / 2551 / 26707 / 6118 | 81468 |
| oc-ai7 | none / 1 | 3/4 | false | none | complete | 8 | 18 / 2580 / 29338 / 2922 | 79756 |
| oc-ai7 | exa:auto / 2 | 3/4 | false | none | complete | 9 | 20 / 2277 / 54674 / 20765 | 83510 |
| oc-ai7 | firecrawl:search / 2 | 3/4 | false | none | complete | 9 | 20 / 2754 / 81675 / 20787 | 83767 |
| oc-ai7 | exa:auto / 1 | 4/4 | true | none | complete | 10 | 22 / 2431 / 88695 / 26272 | 97598 |
| oc-ai7 | firecrawl:search / 1 | 4/4 | true | none | complete | 10 | 22 / 3142 / 96369 / 20877 | 63080 |

## Manual adjudication (2026-10-19)

Confirmation reps: Exa, Firecrawl and `none` on the four discriminating tasks, two
extra reps each. See `PROTOCOL.md` (Amendments) for how they were selected. The
strict tables above are not changed by this section.

- `rv-got16-migrate` / Firecrawl rep 2 (strict FP) and Exa rep 2 (uncertain, low):
  both raise the same `agent: {http2: false}` pooling point adjudicated in
  `results/2026-10-19T08-07-51-071Z-eval/ADJUDICATION.md`. It is a defensible
  non-blocking comment, not a hallucination.
- `rv-got16-http2-agent` / Firecrawl rep 1 (unmatched): the leftover
  `request: http2wrapper.auto` override. It is a valid secondary observation.
- `rv-got16-http2-agent` / `none` reps 1 and 2 (uncertain, low): the arm
  correctly suspected Got 16 might reject the HTTP/2 options, but had no source to
  confirm it. Not counted as finding the bug.
- `rv-commander15-negate` / `none` rep 1 (uncertain): no color-default bug was
  identified. In the quick pass, the no-search arm said outright that colors stay on
  by default, which is wrong under Commander 15.

Stability across the quick pass plus these reps (3 runs per arm per task):

| Task | exa:auto | firecrawl:search | none |
| --- | --- | --- | --- |
| rv-commander15-negate (bug found) | 3/3 | 3/3 | 0/3 |
| rv-got16-http2-agent (bug found) | 3/3 | 3/3 | 0/3 |
| rv-got16-migrate (strict FP / uncertain) | 0 FP, 1 uncertain | 1 FP, 1 uncertain | 0 / 0 |
| oc-ai7 (all hidden tests pass) | 2/3 | 1/3 | 2/3 |

## Limitations

Small, directional samples. Provider caches and changing documents can affect results. Model costs are list-price estimates, not proxy invoices. Unknown/failed calls are retained, and missing latencies are represented as zero elapsed only when no call was recorded. Clean-task findings are false positives under the frozen fixture truth; unmatched bug-task findings require manual adjudication. No reranker or embedding ablation is enabled. Absent cells mean not run, never a failure or success.
