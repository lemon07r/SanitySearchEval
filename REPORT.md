# Search API Eval v2: report

Run date 2026-10-19. Providers: Brave, Exa, Parallel, Firecrawl, Tavily. Agent and
judge model: Claude Opus 5.5 (adaptive thinking, medium effort) through an Anthropic
Messages-compatible proxy. The method was frozen in [PROTOCOL.md](PROTOCOL.md)
before any holdout call. All samples are small, so treat every comparison as
directional. There is no blended score: each product question is answered
separately.

Generated per-run reports (full tables, per-task rows, failures and parameters):

- Pilot: [results/2026-10-19T07-49-42-905Z-pilot/REPORT.md](results/2026-10-19T07-49-42-905Z-pilot/REPORT.md)
- Retrieval holdout: [results/2026-10-19T07-57-39-681Z-eval/REPORT.md](results/2026-10-19T07-57-39-681Z-eval/REPORT.md)
- Agent quick pass: [results/2026-10-19T08-07-51-071Z-eval/REPORT.md](results/2026-10-19T08-07-51-071Z-eval/REPORT.md) (includes manual adjudication)
- Agent confirmation reps: [results/2026-10-19T08-26-06-898Z-eval/REPORT.md](results/2026-10-19T08-26-06-898Z-eval/REPORT.md)

## Bottom line

**Revera.** Web search clearly helps on breaking-change bugs. Every search arm
found both known bugs: 18/18 bug-task runs including confirmation reps (12/12 for
Exa and Firecrawl, the two arms that got reps); no-search found neither (0/6). Exa `auto` is the recommended provider. Revera already uses it, it had
the best rank-1 evidence on review-style lookups (11/12), and it produced no strict
false positives. Parallel `fast` is statistically indistinguishable on evidence@5 and
is 8x faster and about 4x cheaper per search-plus-read ($0.002 vs $0.008; 7x on
search alone, $0.001 vs $0.007). It is a reasonable backup, but it does not have to
replace Exa.

**OpenCode.** On these four tasks, search did not improve outcomes: no-search
passed all hidden tests on 4/4 tasks, the same as the best search arm. A likely
explanation (not tested here) is that the model already knows these upgrades, and
the visible tests and error messages also gave clues. Provider choice therefore
rests on the retrieval track and latency. Parallel `fast` (24/24 evidence@5,
0.53 s p50 search, about $0.002 per search-plus-read) is the best fit for an interactive
agent, and Exa `auto` is equally accurate but about 4.5 s per search.

**Same provider for both?** Exa would serve both acceptably. A shared fallback is
not justified by this data: no provider call failed in 174 retrieval units or in
the 105 provider requests made during agent runs (the two Brave read failures came
from the common reader). See [INTEGRATION_RECOMMENDATIONS.md](INTEGRATION_RECOMMENDATIONS.md).

## Arms and frozen profiles

| Provider | Frozen profile | Search request (native) | Read |
| --- | --- | --- | --- |
| Brave | `web` (LLM Context BLOCKED: `OPTION_NOT_IN_PLAN` on the key's Free AI plan) | `GET /res/v1/web/search` `count=5, extra_snippets=true, result_filter=web` | common HTTPS-only reader (Brave has none) |
| Exa | `auto` | `POST /search` `type:auto, numResults:5, contents.highlights.maxCharacters:4000` | `POST /contents` `text.maxCharacters:60000` |
| Parallel | `fast` | `POST /v1/search` `mode:fast, objective:<purpose>, search_queries:[q], max_results:5, 4000 chars/result` | `POST /v1/extract` `full_content` |
| Firecrawl | `search` | `POST /v2/search` `limit:5, sources:[web], highlights:true` | `POST /v2/scrape` `markdown, onlyMainContent` |
| Tavily | `advanced` | `POST /search` `search_depth:advanced, chunks_per_source:3, max_results:5` | `POST /extract` `extract_depth:basic, markdown` |

Pilot decision (6 cases): no alternative profile gained a case on evidence@5, so each
provider kept its baseline (`deep-lite`, `advanced`, `search-md` and `basic` were
not adopted). The pilot saturated, so this did not test the baselines hard. All
profiles get the same visible budget: at most 5 results, 4,000 tokens per search and
6,000 per read. Parallel's API also receives the case's question as `objective`,
which the other APIs have no field for.

## Track A: retrieval (24 held-out cases, one search plus a top-result read each)

| Profile | evidence@1 | evidence@5 (Wilson 95%) | url@1 / url@5 | evidence in read page | search p50 / p90 ms | median visible tokens | USD per query |
| --- | --- | --- | --- | --- | --- | --- | --- |
| exa:auto | 23/24 | **24/24** (86–100%) | 22 / 24 | 24/24 | 4456 / 6185 | 5683 | $0.0080 metered |
| parallel:fast | 20/24 | **24/24** (86–100%) | 11 / 21 | 19/24 | 531 / 624 | 5649 | $0.0020 est |
| tavily:advanced | 21/24 | 22/24 (74–98%) | 8 / 20 | 21/24 | 3383 / 5476 | 4980 | $0.0177 est |
| brave:web | 14/24 | 21/24 (69–96%) | 8 / 15 | 20/24 | 517 / 559 | 4211 | $0.0050 est |
| firecrawl:search | 12/24 | 16/24 (47–82%) | 13 / 20 | 17/24 | 942 / 1763 | 3761 | $0.0030 est |

"Evidence" means the gold fact's regex patterns matched provider-returned text (the
deterministic score). By case slice (evidence@1 / evidence@5, out of 12; traps
out of 6):

| Profile | Revera-like | OpenCode-like | Traps |
| --- | --- | --- | --- |
| exa:auto | 11 / 12 | 12 / 12 | 6 / 6 |
| parallel:fast | 8 / 12 | 12 / 12 | 5 / 6 |
| tavily:advanced | 9 / 10 | 12 / 12 | 6 / 6 |
| brave:web | 6 / 9 | 8 / 12 | 3 / 4 |
| firecrawl:search | 4 / 5 | 8 / 11 | 2 / 3 |

Observations:

- The **Revera-like slice** separates providers: version ranges in advisories,
  default changes and platform-specific CVEs. Exa and Parallel found evidence on all
  12. Firecrawl found 5, and its misses were mostly about returning a different
  library or ecosystem (for example ArangoDB and Kestrel results for a Got
  `strictContentLength` query).
- **OpenCode-like** lookups (release notes, config changes) were easy for Exa,
  Parallel and Tavily (12/12 at rank 1).
- **Errors:** 2 Brave units failed at the read step in the common reader (npm 403,
  and an HTTPS→HTTP redirect refused by policy). No search call failed for any
  provider.
- **Blinded judge** (same model, does not override scores): it agreed with the
  deterministic metric on all 120 units. "Insufficient" was given for 3 Firecrawl
  and 2 Tavily units, and "contradicted" never. I spot-checked six judgments by hand
  against the stored source text. All six verdicts were right, though one reason
  invented a small detail.

## Track B: Revera (PR review, 4 tasks: 2 real bugs, 2 clean controls)

Quick pass, one run per arm:

| Arm | Bugs found | Strict clean-control findings | Adjudicated hallucinated FPs | Uncertain | Model USD est per review | Search USD per review | Mean wall s |
| --- | --- | --- | --- | --- | --- | --- | --- |
| exa:auto | 2/2 | 0 | 0 | 0 | $0.073 | $0.0075 metered | 40.0 |
| firecrawl:search | 2/2 | 0 | 0 | 1 | $0.118 | $0.0040 | 49.4 |
| parallel:fast | 2/2 | 1 | 0 | 1 | $0.109 | $0.0018 | 49.1 |
| brave:web | 2/2 | 1 | 0 | 0 | $0.095 | $0.0063 | 45.7 |
| tavily:advanced | 2/2 | 1 | 0 | 0 | $0.111 | $0.0220 | 52.4 |
| none | 0/2 | 0 | 0 | 1 | $0.039 | $0 | 39.6 |

Confirmation (quick pass plus 2 reps, 3 runs each):

| Task | exa:auto | firecrawl:search | none |
| --- | --- | --- | --- |
| rv-commander15-negate: bug found | 3/3 | 3/3 | 0/3 |
| rv-got16-http2-agent: bug found | 3/3 | 3/3 | 0/3 |
| rv-got16-migrate (clean): strict FP / uncertain | 0 / 1 | 1 / 1 | 0 / 0 |

What happened:

- **No-search reviewers missed both bugs.** On Commander 15, the no-search
  reviewer asserted that colors stay on by default. Commander 15 changed exactly
  that behavior, so this was wrong. On Got 16 it correctly suspected that the HTTP/2
  agent options might break, but with no source it only filed a low-confidence
  "check this" item. Search turned that suspicion into a cited, confirmed finding
  every time.
- **Every strict "false positive" was the same comment** on the clean
  `rv-got16-migrate` PR: the PR replaces a pooled HTTP/2 agent with
  `agent: {http2: false}`, which the Got 16 docs say disables session pooling. The
  premise is factually correct, and it is a reasonable non-blocking comment.
  Adjudication: not a hallucination, and the clean control was weaker than intended.
  You can only see it with the Got 16 docs, which is why the no-search arm never
  raised it. Strict counts are kept in the tables.
- **One web-induced false doubt:** Parallel's reviewer filed a low-confidence
  uncertain item: "`^16.1.0` may not exist (the releases page lists v16.0.0)". It
  was correctly kept out of the findings, but it shows a stale source can mislead.
- Search adds tokens: an Exa review cost about 1.9x the no-search model cost, with
  similar wall time. Exa used the fewest model calls among the search arms
  (16 vs 19–20).

## Track B: OpenCode (4 dependency-upgrade repair tasks, hidden tests)

| Arm | All hidden tests pass | Mean model USD est per task | Search USD per task | Mean wall s |
| --- | --- | --- | --- | --- |
| none | 4/4 | $0.059 | $0 | 54.5 |
| exa:auto | 4/4 | $0.105 | $0.0105 metered | 69.4 |
| brave:web | 3/4 | $0.089 | $0.0063 | 59.0 |
| firecrawl:search | 3/4 | $0.113 | $0.0027 | 55.6 |
| parallel:fast | 3/4 | $0.105 | $0.0013 | 59.8 |
| tavily:advanced | 3/4 | $0.105 | $0.0160 | 60.7 |

- Three tasks (`oc-execa10`, `oc-ky2`, `oc-ts7-config`) were solved by every arm.
  All differences come from `oc-ai7`, where every lost test was the same `tsc`
  error. Web arms copied a non-generic `ToolExecutionOptions` from docs, but it is
  generic in the installed `ai@7.0.143`. The harness hides `node_modules` and
  cannot run `tsc`, so the agents could not catch it. In confirmation reps `oc-ai7`
  was noisy for every arm (Exa 2/3, Firecrawl 1/3, none 2/3).
- **Conclusion:** on these tasks search added cost (about 1.8x model spend) without
  adding passes. One hypothesis is that the model already knows these releases; if
  so, search should matter more for releases newer than its training data or for
  obscure APIs. Testing that needs tasks built on such releases. This track cannot
  rank providers.

## Cost of this evaluation

Search-provider fees were about $1.70, estimated (Exa metered $0.46 of that).
Model usage was about $16.30 at Anthropic list prices: agents about $7.47
(including the discarded first `oc-ky2` attempt), judge about $8.86. Real proxy billing is not visible. Per-run accounting is in each
`manifest.json`.

## Recommendations (short form)

**Revera:** keep web search opt-in, and keep Exa REST `type:auto` with highlights
plus `/contents` reads as the primary path. If a backup is wanted for reliability,
add Parallel `fast` search and `/v1/extract` behind the existing failover rule. It is
not needed for quality. Keep version-specific prompting, ID-only reads and the
"uncertain" channel; they kept wrong doubts out of findings.

**OpenCode:** Parallel `fast` for interactive search, Exa `auto` as the
accuracy-equivalent alternative when latency does not matter. Search should stay
an optional tool the model calls when needed, not something run on every task.

Details, schemas and file-level changes: [INTEGRATION_RECOMMENDATIONS.md](INTEGRATION_RECOMMENDATIONS.md).

## What would change these conclusions

- More Revera bug fixtures, especially non-version bugs and other ecosystems
  (Rust, Python, Go). Two bugs of one kind is the main weakness.
- OpenCode tasks built on releases newer than the model's training data, and
  agents allowed to type-check.
- Brave LLM Context on a plan that includes it.
- Repeated retrieval runs over time, since the two leaders differ by at most
  3 cases at rank 1.

Full limitations: [LIMITATIONS.md](LIMITATIONS.md).