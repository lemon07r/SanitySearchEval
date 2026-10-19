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
`` `Bearer ${config.getToken()}` `` was saved as `Bearer [REDACTED]}`. The fix,
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
