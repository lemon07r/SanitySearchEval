# Predeclared evaluation protocol (v1, frozen 2026-10-19 before any holdout run)

This file is written before pilot or holdout calls run. Changes after the pilot are
limited to the "Frozen profiles" section, which records the pilot decision. Any
later change is appended under "Amendments" with a reason and timestamp.

## Questions

1. **Revera**: which search+read setup helps a cautious PR reviewer verify external
   library contracts without adding false positives? Is any web search better than none?
2. **OpenCode**: which search+read setup helps a coding agent finish real code changes
   (hidden tests pass) at reasonable latency, tokens and cost?

## Arms

Five providers, one production-plausible baseline profile each, plus at most one
pilot alternative. The no-search arm (`none`) runs in the agent track only.

| Provider | Baseline profile | Pilot alternative | Reader for `web_read` |
| --- | --- | --- | --- |
| Brave | `llm-context` (`/res/v1/llm/context`, small token budget) | `web` (`/res/v1/web/search`, `extra_snippets=true`) | common reader (Brave has no page reader) |
| Exa | `auto` (`type:auto`, `contents.highlights`) | `deep-lite` | Exa `/contents` |
| Parallel | `fast` (`/v1/search`, `mode:fast`) | `advanced` | Parallel `/v1/extract` |
| Firecrawl | `search` (v2 `/search`, result snippets/highlights) | `search-md` (search with scraped markdown) | Firecrawl `/v2/scrape` |
| Tavily | `advanced` (`search_depth:advanced`, small `chunks_per_source`) | `basic` | Tavily `/extract` |

Exact native request parameters are recorded in each run's `manifest.json` and in
`docs/provider-manifest.md` (dated, with pricing sources).

## Normalized tool contract (both tracks)

- `web_search({query, purpose?})` returns at most 5 results:
  `{id, title, url, published_at?, snippet_or_excerpt, source}`. `published_at` is
  only what the provider returned; never guessed.
- `web_read({result_id})` takes an ID from earlier search output only (no free URLs)
  and returns `{id, url, title?, text, available, error?, provenance}`.
- Model-visible budget: **4,000 tokens per search call** and **6,000 tokens per read**
  (token = ceil(chars/4)). Trimming is deterministic, block-based (paragraphs and
  whole fenced code blocks), keeps the blocks with the most query-term overlap,
  restores original order, and marks gaps with `[…]`. It is identical for every
  provider. Untrimmed provider sizes are stored alongside the visible payload.
- Native read failures are failures. There is no silent fallback to another reader.

## Track A: retrieval (diagnostic)

For each case: one `web_search(query=case.query, purpose=case.question)` with the
frozen profile, then one `web_read` of the rank-1 result. Deterministic scores:

- `url@k` (k=1,3,5): an acceptable source (canonicalized URL or allowed URL prefix)
  appears in the top k.
- `evidence@k`: all load-bearing facts of the case match (regex groups, case
  insensitive) in the visible text of the top-k results combined. URL found without
  evidence does not count as evidence.
- `read_ok`, `evidence_in_read`, latency (search, search+read), cost, visible tokens,
  error class.
- Optional blinded judge (one fixed model) grades support of the gold facts by the
  visible payload: `supported | contradicted | insufficient`, version applicability,
  authority, quote, confidence. Judge output never overrides deterministic scores.

## Track B: end-to-end agents (primary)

One frozen tool-calling model for all arms: `claude-opus-5-5` through the
Anthropic Messages API on the operator's proxy, `thinking: adaptive`,
`effort: medium`. No silent model fallback: the response model must match.

Limits per task (in `src/config.ts`): Revera 8 model calls, OpenCode 12 model calls;
at most 2 `web_search` and 2 `web_read` calls; wall time 240 s (Revera) and 300 s
(OpenCode); search timeout 15 s; read timeout 20 s; one retry on 429/5xx/timeout.

The brief suggested 6–8 calls and 90 s. The OpenCode tasks need reading, editing and
running tests, and the model's medium-effort turns take 5–20 s, so the limits were
raised once, before any run, and apply to every arm equally.

Agents cannot read installed dependency sources (`node_modules` is outside the
workspace). This makes the tasks depend on external documentation, which is the
point of the comparison; a real agent could also read package sources, so the
no-search baseline here is a lower bound.

### Revera tasks (4)

A small repository at the post-PR state plus the PR diff; tools `read_file`,
`grep_repo`, `web_search`, `web_read`, `submit_review`. Two PRs introduce a real
defect involving an external contract; two are clean controls that look suspicious
to a reviewer with stale knowledge. Scoring:

- A finding with confidence `high` or `medium` is **reported**; `low` is **uncertain**.
- A reported finding **matches** the known bug when it names the right file and its
  text matches the bug's regex groups.
- Primary metrics: bugs found / bugs available; reported false positives per clean
  PR (exact counts, finding text shown); unmatched findings on bug PRs are listed
  and adjudicated by hand in the report; completion status.

### OpenCode tasks (4)

Small repositories that need a real change requiring external knowledge. Tools
`list_files`, `read_file`, `grep_repo`, `edit_file`, `write_file`, `run_tests`
(visible test command only, network disabled), `web_search`, `web_read`, `finish`.
After the agent stops, hidden tests (authored before any provider run) run with no
network. Protected files (tests, `package.json`) are hash-checked; a change counts as
a regression violation.

### Runs

Quick pass: 5 providers x 8 tasks + 8 no-search baseline runs, one run each.
Optional confirmation: top two providers + baseline repeated on the four most
discriminating tasks, chosen by this rule: tasks where the quick-pass outcomes
across arms are not all equal, ordered by case ID; ties broken by case ID.

## Case sets

- Pilot: 6 retrieval cases, not reused anywhere else.
- Search holdout: 24 cases (12 Revera-like incl. at least 4 traps, 12 OpenCode-like).
- Agent holdout: 8 tasks (4 Revera, 4 OpenCode).

Ground truth comes from primary sources (official docs, GitHub releases, advisories,
package registries) fetched directly, never from the five candidate providers. Each
excerpt is machine-verified against its source URL by `bun run truth:check`. A source
that changes later makes the case unscorable rather than rewritten.

## Pilot decision rule

Per provider, choose the alternative only if it beats the baseline by at least one
full case on `evidence@5` over the 6 pilot cases **and** its median search latency is
under 2x and its cost is under 2x the baseline's. Otherwise keep the baseline. The
decision is recorded below and frozen before holdout.

## Reporting

Separate tables for Revera, OpenCode and retrieval with numerators/denominators,
per-case paired tables, p50/p90 latency (or per-run values), visible tokens, model
tokens, provider fees (metered vs estimated, `unknown` when not known). Failures stay
in every denominator. No blended score. Small samples are directional only.

## Frozen profiles

Recorded 2026-10-19 from pilot run `results/2026-10-19T07-49-42-905Z-pilot`
(stored in `config/frozen-profiles.json`):

| Provider | Frozen profile | Pilot evidence@5 (baseline vs alternative) | Reason |
| --- | --- | --- | --- |
| Brave | `web` | llm-context BLOCKED vs 6/6 | Baseline unavailable on the key's plan (`OPTION_NOT_IN_PLAN`); the alternative is the only runnable profile. |
| Exa | `auto` | 6/6 vs 6/6 (`deep-lite`) | No case gained. |
| Parallel | `fast` | 6/6 vs 6/6 (`advanced`) | No case gained. |
| Firecrawl | `search` | 5/6 vs 5/6 (`search-md`) | No case gained. |
| Tavily | `advanced` | 6/6 vs 6/6 (`basic`) | No case gained. |

The pilot cases saturated (most profiles at 6/6), so the pilot could only rule
alternatives in, never prove baselines better.

## Amendments

- 2026-10-19, before the recorded pilot run: a first pilot attempt hit Firecrawl
  HTTP 429 on 2 of 12 Firecrawl units ("Consumed (req/min): 14"). The key is on
  Firecrawl's Free plan (10 req/min for `/search` and for `/scrape`, 2 concurrent
  browsers). Firecrawl was set to concurrency 1 with 6.5 s spacing between request
  starts, as Brave already was (1 req/s plan limit). Client-side pacing waits are now
  excluded from reported latency (recorded separately as `pacing_ms`); retries and
  provider backoff stay included. `total_ms` is now search_ms + read_ms; unit wall
  time is kept as `wall_ms`. The first attempt was discarded and the whole pilot rerun
  with these settings; its decision would have been the same.
- 2026-10-19, after the agent quick pass (`results/2026-10-19T08-07-51-071Z-eval`):
  the workspace `write_file`/`edit_file` tools wrote through the artifact redactor,
  so agent code containing `` `Bearer ${...}` `` was saved as `Bearer [REDACTED]}`.
  Only `oc-ky2` was affected (all 6 arms, every arm 1/4 hidden tests; detected by
  scanning every write/edit input for redactable patterns). Workspace writes now use
  plain file writes (regression test added); redaction still applies to stored
  artifacts. The 6 `oc-ky2` units were rerun with `--resume` in the same run
  directory; the superseded rows are kept in
  `units.superseded-oc-ky2-redaction-bug.jsonl`.
- 2026-10-19, confirmation reps: the protocol leaves "top two providers" undefined.
  Ranked on agent outcomes in this order: Revera bugs found, then fewer clean-control
  findings, then OpenCode all-pass tasks. That gives Exa (2/2, 0, 4/4) and Firecrawl
  (2/2, 0, 3/4); Brave, Parallel and Tavily each had 1 clean-control finding.
  Discriminating tasks (quick-pass outcomes not equal across arms): `oc-ai7`,
  `rv-commander15-negate`, `rv-got16-http2-agent`, `rv-got16-migrate` (exactly four).
  Run: Exa, Firecrawl and `none` × those 4 tasks × 2 extra reps
  (`cases/agent-confirmation.json`).
