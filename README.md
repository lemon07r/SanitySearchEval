# Sanity Search Eval v2

A small, reproducible comparison of five web search APIs (**Brave, Exa, Parallel,
Firecrawl, Tavily**). It answers two separate questions:

1. **Revera** (automated PR reviewer): does web search help a cautious reviewer catch
   breaking library changes without adding false positives, and which provider is best?
2. **OpenCode** (coding agent): which search setup helps an agent finish real code
   changes (hidden tests pass) at reasonable latency and cost?

Everything here was actually run on 2026-10-19. Start with **[REPORT.md](REPORT.md)**
for findings, **[INTEGRATION_RECOMMENDATIONS.md](INTEGRATION_RECOMMENDATIONS.md)**
for what to change, and **[LIMITATIONS.md](LIMITATIONS.md)** for what this does not show.
The frozen method is in **[PROTOCOL.md](PROTOCOL.md)**.

## Results at a glance

| Question | Result (small samples, directional) |
| --- | --- |
| Revera: search vs none | Every search arm found both known bugs (18 of 18 runs counting confirmation reps); no-search found 0 of 6. |
| Revera: provider | Exa `auto`: best rank-1 evidence on review-style lookups and no strict false positives. Parallel `fast` is the close, faster, cheaper alternative. |
| OpenCode: search vs none | No measurable gain on these 4 tasks. No-search matched the best search arm. |
| OpenCode: provider | Pick on retrieval quality plus latency: Parallel `fast` (0.5 s p50, 24/24 evidence@5). |
| Retrieval (24 held-out cases) | evidence@5: Exa 24, Parallel 24, Tavily 22, Brave 21, Firecrawl 16. |

## Setup (about 5 minutes)

Requires [Bun](https://bun.sh) 1.3+ on Linux. The agent workspaces use
`unshare -rn` to run tests without network access.

```sh
bun install
cp .env.example .env        # then fill in the keys you have
bun run fixtures:setup      # installs pinned deps for the 8 agent fixtures (outside agent view)
bun run doctor              # one tiny search+read per provider, plus an LLM check
```

`.env` variables (names only; see `.env.example`):

- `BRAVE_API_KEY`, `EXA_API_KEY`, `PARALLEL_API_KEY`, `FIRECRAWL_API_KEY`,
  `TAVILY_API_KEY`. `PARRELLEL_API_KEY` is accepted as an alias for the Parallel key.
- `JUDGE_LLM_MODEL_API_KEY`, `JUDGE_LLM_MODEL_BASE_URL`, `JUDGE_LLM_MODEL_ID`: an
  Anthropic Messages-compatible endpoint (`<base>/messages`). It is used by the agent
  track and the optional judge. `AGENT_LLM_*` overrides it for the agent only.
- `RERANKER_MODEL_*` and `EMBEDDING_MODEL_*` are reserved for an optional ablation and
  are not used by default.

A missing key never fails silently: the affected arms are reported as blocked or
errored.

## Commands

```sh
bun run doctor                                  # smoke checks; writes results/<ts>-doctor
bun run truth:check                             # re-verify every gold fact against its primary source
bun run pilot                                   # 6 pilot cases × all profiles (mode tuning)
bun run eval -- --suite search                  # Track A: 24 held-out retrieval cases × frozen profiles
bun run eval -- --suite agents                  # Track B: 8 agent tasks × 5 providers + no-search
bun run report -- --run results/<id>            # regenerate REPORT.md / report.html for a run
bun run judge  -- --run results/<id>            # optional blinded LLM judge for retrieval runs
bun test                                        # harness unit tests
```

Useful flags: `--dry-run` (plan and cost estimate, no calls), `--resume results/<id>`
(continue an interrupted run; the inputs must match), `--providers exa,none`,
`--profiles exa:auto`, `--cases <file>`, `--limit N`, `--reps N`, `--seed 42`,
`--concurrency 3`, `--max-cost-usd 20`, `--max-minutes 45`, `--no-judge`,
`--keep-work`.

The CLI refuses to start when the planning estimate is above `--max-cost-usd`.
`eval` requires `config/frozen-profiles.json`, which is written from the pilot.

## How it works

- **One tool contract for every provider:** `web_search({query, purpose?})` returns
  at most 5 results, and `web_read({result_id})` reads only a URL from an earlier
  result. Visible output is capped at 4,000 tokens per search and 6,000 per read,
  using identical deterministic trimming. Each provider's native reader is used
  (Exa `/contents`, Parallel `/v1/extract`, Firecrawl `/v2/scrape`, Tavily
  `/extract`). Brave has no reader, so it uses a common HTTPS-only reader with an
  SSRF guard.
- **Track A (retrieval):** one search plus a read of the top result, per case.
  Scoring is deterministic: url@k, evidence@k (gold-fact regexes against
  provider-returned text), read success, latency, visible tokens and cost. An
  optional blinded judge is reported separately and never overrides scores.
- **Track B (agents):** Claude Opus 5.5 (adaptive thinking, medium effort) gets
  sandboxed file tools plus the web tools, with fixed call and wall-clock limits.
  Revera tasks are PR reviews (2 real breaking-change bugs, 2 clean controls).
  OpenCode tasks are dependency-upgrade repairs scored by hidden tests that run
  without network.
- **Failures stay in denominators.** Blocked arms (such as Brave LLM Context on this
  key's plan) are listed as blocked, not as losers.

## Layout

```
src/                 CLI, provider adapters (src/providers), tool contract, agent loop,
                     sandboxed workspace, scoring, judge, report
cases/               pilot.json, search-holdout.json, agent-holdout.json,
                     agent-confirmation.json, truth-check.json (verification log)
fixtures/<id>/       agent tasks: repo/, pr.diff, hidden/ tests, reference/, EVIDENCE.md
config/              frozen-profiles.json (pilot decision)
docs/                provider-manifest.md (API parameters and prices, dated)
results/<id>/        manifest.json, units.jsonl, judgments.jsonl, REPORT.md, report.html,
                     ADJUDICATION.md (manual notes); private/ is git-ignored
```

The runs behind the report are:

| Run | What |
| --- | --- |
| `results/2026-10-19T07-23-58-565Z-doctor` | Smoke checks (Brave LLM Context `OPTION_NOT_IN_PLAN`) |
| `results/2026-10-19T07-49-42-905Z-pilot` | Pilot, 6 cases × 9 runnable profiles |
| `results/2026-10-19T07-57-39-681Z-eval` | Retrieval holdout, 24 cases × 5 frozen profiles, plus judge |
| `results/2026-10-19T08-07-51-071Z-eval` | Agent quick pass, 8 tasks × 6 arms |
| `results/2026-10-19T08-26-06-898Z-eval` | Agent confirmation reps (Exa, Firecrawl, none × 4 tasks × 2) |

## Data handling

- `.env`, `results/*/private/` (raw provider payloads and full transcripts) and
  `results/*/work/` are git-ignored. Committed JSONL keeps metrics, URLs and request
  parameters, and is passed through a secret redactor.
- Brave's API terms do not allow storing its results. For Brave arms, committed
  files drop result URLs, judge reasons and finding explanations (shown as
  `[brave result not retained]`) and keep only derived scores; everything else
  stays under `private/`.

## Rerunning and extending

- **Add a retrieval case:** append to `cases/search-holdout.json` (or a new file passed
  with `--cases`). Each case needs `query`, `question`, `gold_facts[].patterns`
  (regex groups) and `acceptable_sources`, with excerpts from a primary source. Then
  run `bun run truth:check --cases <file>`. A case whose source no longer matches is
  unscorable; do not rewrite it after seeing provider output.
- **Add an agent task:** create `fixtures/<id>/` like the existing ones (`task.json`,
  `repo/` with `bun.lock`, `hidden/` tests, `reference/`, `EVIDENCE.md`), add it to
  `cases/agent-holdout.json`, run `bun run fixtures:setup`, then
  `bun fixtures/validate.ts <id>`. The initial state must fail and the reference must
  pass.
- **Add a provider or profile:** add an adapter in `src/providers/`, a profile in
  `src/config.ts`, and the plan's rate limits in `PROVIDER_LIMITS`. Then rerun
  `doctor` and the pilot before freezing.
- Provider indexes, caches and pages change over time, so a rerun will not reproduce
  exact numbers. Compare runs, not single cells.
