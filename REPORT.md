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
  deterministic match on all 120 units ("supported" exactly when the gold fact was
  found in the search results or the read page; this is not evidence@5 alone). "Insufficient" was given for 3 Firecrawl
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
  was noisy for every arm (Exa 2/3, Firecrawl 1/3, none 2/3), and every
  repeat failure, including the no-search one, was the same `tsc` error.
- **Conclusion:** on these tasks the search arms used about 1.8x the model spend of no search, without
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
## Post-hoc additions (2026-10-24)

Added after the frozen evaluation and reported separately. Nothing above was
rewritten. Why these were added, what was changed, and the two problems found
during the reruns are recorded in the [PROTOCOL.md](PROTOCOL.md) amendments dated
2026-10-24. Short version: the frozen protocol tested one baseline plus at most one
alternative per provider and never surveyed each provider's full API. That missed
Firecrawl's Developer Index (`/v2/search/developer`, launched 2026-08-20) and Exa's
`objective` field. A doc audit of all five providers found no request bugs in the
frozen profiles. Brave LLM Context is still `OPTION_NOT_IN_PLAN` on this key.

Runs (one rep each, no LLM judge):

- Retrieval, same-day: [results/2026-10-24T10-41-00-663Z-eval](results/2026-10-24T10-41-00-663Z-eval/REPORT.md)
- Retrieval, Exa cache-controlled pair: [results/2026-10-24T10-53-26-808Z-eval](results/2026-10-24T10-53-26-808Z-eval/REPORT.md)
- Agents, Revera tasks: [results/2026-10-24T10-51-54-910Z-eval](results/2026-10-24T10-51-54-910Z-eval/REPORT.md) (its OpenCode rows are void, see below)
- Agents, OpenCode rerun: [results/2026-10-24T10-57-52-872Z-eval](results/2026-10-24T10-57-52-872Z-eval/REPORT.md)

### Retrieval (same 24 holdout cases, same-day controls)

Provider indexes change over time, so the five frozen profiles were rerun on the
same day as controls. Compare new arms with these rows, not with the 2026-10-19 table.

| Profile | Kind | evidence@1 | evidence@5 | url@5 | evidence in read page | search p50 / p90 ms | median visible tokens | USD per query |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| exa:auto-uncached | control (cache-free) | 23/24 | 24/24 | 24 | 24/24 | 468 / 510 | 5693 | $0.0080 metered |
| exa:auto-objective-uncached | new | 23/24 | 24/24 | 24 | 24/24 | 462 / 509 | 5682 | $0.0080 metered |
| exa:auto-dynamic | new | **24/24** | 24/24 | 24 | 24/24 | 654 / 1429 | 5160 | $0.0080 metered |
| exa:lite | new | 23/24 | 24/24 | 24 | 24/24 | 439 / 486 | 5891 | $0.0050 metered |
| parallel:fast | control | 21/24 | 24/24 | 21 | 21/24 | 546 / 673 | 6538 | $0.0020 est |
| tavily:advanced | control | 20/24 | 20/24 | 18 | 21/24 | 2674 / 4363 | 5371 | $0.0177 est |
| brave:web | control | 14/24 | 21/24 | 15 | 20/24 | 494 / 571 | 4885 | $0.0050 est |
| brave:web-nospell | new | 14/24 | 21/24 | 15 | 20/24 | 466 / 524 | 4885 | $0.0050 est |
| firecrawl:developer | new | 10/24 | **19/24** | 5 | 16/24 | 1086 / 1967 | 6820 | $0.0030 est |
| firecrawl:search | control | 13/24 | 16/24 | 20 | 18/24 | 781 / 879 | 3884 | $0.0030 est |

What changed:

- **Firecrawl Developer Index helps, but doesn't catch up.** It found gold
  evidence on 19/24 cases vs 16/24 for Firecrawl's general search on the same day:
  it won 4 cases (ESLint 10, Got 15, Got 16, uv) and lost 1 (Strawberry). On the
  Revera-like slice it found 7/12 vs 5/12. It still trails Exa and Parallel (24/24).
  It missed 5 cases: four security-advisory questions (mise, PyMongo, Quart,
  Strawberry) and the Go loopvar version question. General search missed three of
  those same advisories and Go loopvar too, so on the 6 advisory-style cases both
  Firecrawl modes found evidence on only 2. The gain came from library and migration
  questions.
  105 of its 120 results were github.com URLs, and it rarely returned the canonical
  page itself (url@5: 5/24): the evidence usually came from an issue or PR quoting it.
  Its evidence also sat lower in the list (evidence@1: 10 vs 13).
- **Exa `objective` made no measurable difference.** With caching controlled, it
  changed the result list in 5 of 24 cases and the evidence rank in none. Exa
  was already at the ceiling on this set.
- **Exa dynamic highlights (beta)** put evidence at rank 1 on all 24 cases (one more
  than `auto`) with about 9% fewer visible tokens, but about 190 ms slower at p50.
  That's a one-case difference, within noise.
- **Exa `lite`** matched `auto` on evidence at 0.44 s p50 with the tightest p90
  of any arm, and costs about 40% less ($0.005 vs $0.008 per search plus read).
- **Exa is now as fast as Parallel.** Cache-free `auto` searches had a p50 of 0.47 s
  (p90 0.51 s), down from 4.5 s on 2026-10-19, vs 0.55 s for Parallel `fast` on the
  same day. This removes the main reason the OpenCode recommendation preferred
  Parallel. Parallel is still about 4x cheaper per search plus read.
- **Brave `spellcheck: false`** returned identical results on all 24 cases; none of
  these queries were being rewritten.
- **Drift in the controls:** Tavily dropped from 22 to 20 at evidence@5 (Chalk 6,
  Quart), Brave swapped one case for another, and Exa, Parallel and Firecrawl were
  unchanged.

### Agents (Revera 4 tasks, OpenCode 4 tasks; one run per arm)

| Arm | Revera bugs found | Revera clean-control findings / uncertain | OpenCode all-pass | Model USD est per task | Search USD per task |
| --- | --- | --- | --- | --- | --- |
| firecrawl:developer | 2/2 | 0 / 1 | 4/4 | $0.11 Revera, $0.10 OpenCode | $0.004 / $0.002 est |
| exa:auto-objective | 2/2 | 0 / 0 | 3/4 | $0.07 Revera, $0.11 OpenCode | $0.007 / $0.006 metered |

- Both arms found both breaking-change bugs. The one uncertain item from
  `firecrawl:developer` is the same defensible pooling comment on `rv-got16-migrate`
  described above, kept out of findings.
- OpenCode: three tasks passed for both arms. Exa's one miss was `oc-ai7` (3/4
  hidden tests), the task that failed at random for every arm on 2026-10-19, including no
  search. The failing test was not captured, so its cause is unchecked. As before,
  this track cannot rank providers.

### Two problems found during the reruns (both fixed, both recorded in PROTOCOL.md)

- **Exa result cache ignores `objective`.** In the first same-day run, whichever of
  `exa:auto` / `exa:auto-objective` ran second came back from cache (about 90 ms, identical
  URLs) in all 24 pairs, so that comparison is void. Its `exa:auto` latency is also
  cache-flattered. The cache-controlled pair above replaces both. Anyone A/B testing
  Exa parameters should vary something that is part of the cache key, or expect
  cached answers.
- **Missing fixture dependencies.** The fixtures' installed packages had been
  deleted since 2026-10-19, and the harness silently ran without them, so every
  OpenCode task in the first post-hoc agent run failed on import. The harness now
  refuses to run in that state. Reference solutions were checked to pass, and the
  OpenCode tasks were rerun.

### Bottom line of the additions

- **Revera:** no change. Exa `auto` stays. `objective` is harmless and Exa recommends
  passing it from agents, but it gained nothing here.
- **OpenCode:** Exa and Parallel are now about equal on speed. Exa had more evidence
  at rank 1 (23 vs 21) and Parallel costs less. Exa `lite` is a reasonable middle
  option. Either is fine. These new data don't settle which is better.
- **Firecrawl:** if you use Firecrawl, use the Developer Index for code questions
  (19 vs 16). Neither Firecrawl mode handled security advisories well (2 of 6
  each). It is still not a match for Exa or Parallel on this set.

Cost of the additions: about $4.80 at list prices (retrieval $1.93, agents $2.87), no judge.
