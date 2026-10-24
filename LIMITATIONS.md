# Limitations

Read every number in `REPORT.md` as directional. This section lists what the
evaluation does not show and what could have biased it.

## Sample size

- **Retrieval:** 24 held-out cases, one search per case. The Wilson 95% intervals for
  evidence@5 overlap for Exa, Parallel, Tavily and Brave. Only Firecrawl is clearly
  lower (46.7–82.0% vs 86.2–100% for Exa and Parallel). The 6-case pilot saturated:
  most profiles scored 6/6, so it could rule alternatives in but not prove baselines
  better.
- **Revera agent track:** 4 tasks, only 2 of which contain a bug. "Search finds the
  bug, no-search does not" held in 18 of 18 search runs vs 0 of 6 no-search runs,
  counting confirmation reps for Exa and Firecrawl. That is a strong signal on
  two bugs of the same kind (breaking changes in a new major version). It says nothing
  about logic bugs, security reviews or non-JavaScript ecosystems.
- **OpenCode agent track:** 4 tasks, and 3 of them were solved by every arm,
  including no-search. Only `oc-ai7` varied, and the confirmation reps show it is
  noisy for every arm. The track cannot separate providers.
- **One rep in the quick pass.** Confirmation reps covered only Exa, Firecrawl and
  no-search on 4 tasks. Brave, Parallel and Tavily agent results are single runs.

## Fixture and harness limits

- **The no-search baseline was strong, and the reason is not established.** One
  hypothesis is that Claude Opus 5.5 already knows these upgrades (ky 2, execa 10,
  TypeScript 7 config) from training data; the visible tests and error messages
  also gave clues. This evaluation did not test either explanation. Tasks built on
  releases newer than the model's training data would test the first one.
- **Agents cannot read `node_modules` or run `tsc`.** This was deliberate, so that
  agents could not read the answer from installed type definitions. But it means
  `oc-ai7`'s type-check failures (the web arms trusted docs that show a non-generic
  `ToolExecutionOptions`) would probably have been caught by a real OpenCode
  session.
- **One clean control was weaker than intended.** `rv-got16-migrate` contains a
  debatable change: it drops HTTP/2 session pooling. Search arms often flagged it.
  Strict scores count those flags as false positives; manual adjudication treats
  them as defensible comments. Both views are in the run's `REPORT.md`.
- **A harness bug corrupted `oc-ky2` writes in the first quick pass** (redaction of
  `Bearer ${...}`). It was fixed and all 6 arms were rerun. The superseded rows are
  kept. See the `PROTOCOL.md` amendments.
- **Same model for agent and judge.** The optional retrieval judge is also Opus 5.5.
  It agreed exactly with the deterministic metric on all 120 judged units
  ("supported" iff evidence was found in the search results or the read page). I
  spot-checked 6 judgments against the stored source text (Got 15 for Tavily and
  Brave, ESLint 10 for Firecrawl, mise for Exa, chalk 6 for Parallel, Quart for
  Firecrawl). All 6 verdicts were right, but one reason described a text glitch
  ("Source set Xct") that does not appear in the source. It is a consistency check,
  not independent validation.
- **Fixed, small budgets:** at most 2 searches and 2 reads per agent task, 5 results
  per search, 4,000/6,000 visible tokens. Deeper research loops, larger budgets or
  adaptive query rewriting were not tested.
- **The reader policy affects Brave only.** Brave has no page reader, so it used the
  common HTTPS-only reader. Brave's 2 retrieval errors came from that reader: npm
  returned 403, and one site redirected HTTPS to plain HTTP. Another reader would
  change those cells.

## Provider and plan constraints

- **Brave LLM Context was not tested.** The key is on Brave's legacy "Free AI" plan,
  and `/res/v1/llm/context` returns `OPTION_NOT_IN_PLAN`. Brave was evaluated with
  `/res/v1/web/search` plus `extra_snippets`. The block is hard-coded. With an
  upgraded plan: delete `blocked_reason: BRAVE_CONTEXT_BLOCKED` from the
  `brave:llm-context` profile in `src/config.ts`, run `bun run doctor` to confirm the
  endpoint answers, run `bun run pilot -- --providers brave`, set `"brave"` in
  `config/frozen-profiles.json` to whichever profile wins under the pilot rule, then
  rerun the evals.
- **Rate-limited plans were paced:** Brave at 1 request/s, and Firecrawl's Free plan
  (10 requests/min per endpoint) at 1 request per 6.5 s. Pacing waits are excluded
  from reported latency. Paid plans would not need them, but they did lengthen agent
  wall time slightly.
- **Provider caches:** some pilot queries had been sent during setup, and Tavily's
  sub-100 ms pilot latencies suggest cache hits. Holdout queries had not been sent
  before, but provider-side caching across arms is not controlled.
- **Point in time.** Search indexes, page content, provider ranking models and
  prices change. These are results from 2026-10-19.

## Costs

- Provider costs are mostly **estimates** from public price pages
  (`docs/provider-manifest.md`). Exa is the only provider that returns a metered
  dollar cost per request. Firecrawl is priced at Standard-plan credit cost, and
  Tavily at $0.008 per credit. Brave is priced at $5 per 1,000 requests.
- Model costs use Anthropic list prices for Opus ($4/$20 per million input/output
  tokens; cache read $0.20, cache write $5) because the proxy's billing is not
  visible. Real spend through the proxy may differ.
- Totals for this evaluation: search-provider fees of about $1.70 (estimated), and
  model usage of about $16.30 at list prices (agents about $7.47 including the
  discarded first `oc-ky2` attempt, judge about $8.86).

## Not tested

- Reranking and embedding ablations (the optional `RERANKER_MODEL_*` and
  `EMBEDDING_MODEL_*` settings were not used).
- Provider fallback chains in practice: no outage was observed, so failover value is
  untested.
- Non-English queries, private or internal documentation, very long pages, PDFs, and
  domain targeting such as `include_domains`.
- OpenCode's own native web search tools or plugins. All agents used this harness's
  normalized tools, so native OpenCode defaults (for example its result count or
  search depth) were not measured.
- Revera itself. No Revera or OpenCode code was changed or run.
## Post-hoc additions (2026-10-24)

- The new profiles were chosen after the 2026-10-19 results were known, and run once
  without a pilot. Treat them as exploratory, not as a frozen held-out test.
- The same 24 holdout cases were reused, so they are no longer unseen by the person
  choosing configurations. Ground truth was not changed.
- No LLM judge was run on the post-hoc retrieval units.
- Exa caches results with a key that ignores `objective`. One comparison was voided
  and rerun with cache-busting `maxCharacters` values. Other providers may cache
  repeated queries too: latency for queries also sent on 2026-10-19 may be flattered,
  and this is not controlled.
- Agent runs are one rep per arm on 8 tasks. `oc-ai7` was noisy before; its one
  post-hoc failure was not diagnosed because hidden-test output is not kept.
