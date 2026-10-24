# Integration recommendations

Based on the 2026-10-19 runs in [REPORT.md](REPORT.md). Nothing in Revera or
OpenCode was changed. File and line references were checked against the local
Revera checkout (`VeraTools/revera`) and OpenCode `v2.0.32` source on the same date.

## Revera

### Decision

- **Keep web search opt-in** (`web_search.enabled: false` by default) and keep
  **Exa as the primary provider**, using the keyed REST path (`type: "auto"`). In
  this evaluation every search arm found both breaking-change bugs and the
  no-search arm found neither (18/18 vs 0/6 bug-task runs, including confirmation
  reps). Exa had the best rank-1
  evidence on review-style lookups (11/12) and no strict false positives in
  4 clean-control runs.
- **A second provider is optional, not required for quality.** No provider failed
  during the evaluation, so there is no measured reliability gain. If you want
  failover anyway, Parallel `fast` is the best candidate: 24/24 evidence@5,
  0.5 s p50 search, about $0.001 per search plus $0.001 per extract.
- **Do not switch to Brave Web, Firecrawl or Tavily for Revera.** Firecrawl
  found evidence on 5/12 review-style cases. Brave needs a separate page reader.
  Tavily `advanced` was about 2–9x the per-query cost of the others with no
  accuracy gain.

### Changes worth making to the current Exa integration

These come from comparing Revera's current request shape (verified in code) with
the configuration that was evaluated:

| Setting | Revera today | Evaluated | Evidence |
| --- | --- | --- | --- |
| Search highlights | `contents: {highlights: true}`; joined highlights cut to 1,000 bytes (`src/web.rs:298-304`, `src/web.rs:436-469`) | `highlights.maxCharacters: 4000` per result, 4,000 visible tokens per search | Cutting each Exa result's highlights to 1,000 characters lowers Exa's evidence@5 from 24/24 to 22/24 on the holdout (re-scored offline from stored payloads). |
| Read size | `/contents` `text.maxCharacters: 6000` (`src/web.rs:298-304`) | `maxCharacters: 60000`, then query-aware trimming to 6,000 tokens (about 24,000 characters) | In 6 of 24 Exa reads, the first gold-fact match was more than 6,000 characters into the page (release notes and advisories with long preambles). |
| Request cap | 9 s per request (`src/web.rs:11,152-165`) | 15 s search / 20 s read | Exa `auto` search maxed at 6.25 s across all runs (p50 4.5 s, p90 6.2 s), so 9 s is enough. |

Recommended edits, all in `src/web.rs` unless noted:

1. **Search:** request `contents: {highlights: {maxCharacters: 2000–4000}}` and raise
   the 1,000-byte joined-highlight cap to match, keeping the 5-result limit.
   Measure with this repo first: add a profile with Revera's exact parameters to
   `src/config.ts` and run `bun run eval -- --suite search --profiles <id>`.
2. **Read:** request more text (for example `maxCharacters: 30000`) and keep the
   model-visible budget small with **query-aware block trimming**, not head
   truncation. This repo's `src/trim.ts` keeps the paragraphs and code blocks that
   overlap most with the query, restores their original order and marks gaps with
   `[…]`. That is a few dozen lines to port to Rust.
3. **Optional failover backend** (only if wanted): add a `Parallel` variant next to
   the existing Exa backends.
   - `POST https://api.parallel.ai/v1/search` with `{objective, search_queries: [query], mode: "fast", advanced_settings: {max_results: 5, excerpt_settings: {max_chars_per_result: 4000}}}`.
   - `POST https://api.parallel.ai/v1/extract` with `{urls: [url], objective, advanced_settings: {full_content: {max_chars_per_result: N}}}`.
   - Auth uses the `x-api-key` header, with the key read from `PARALLEL_API_KEY`.
     Exact request and response shapes are in `docs/provider-manifest.md` and
     `src/providers/parallel.ts`.
   - Reuse the existing failover rule (429, 5xx, timeout, malformed) and shared
     budget counting (`src/web.rs:254-272`, `182-211`).
   - Config (`src/config.rs:504-527`): add `fallback_provider: none|parallel` and
     `fallback_api_key_env: PARALLEL_API_KEY`, both off by default. Update
     `src/cli.rs` (doctor, around lines 929-954), `docs/configuration.md` (the
     `web_search` section), `revera.example.yaml:50-58` and the wire-contract
     tests in `src/web_tests.rs`.
4. **Keep everything else.** The current design already matches what worked here:
   - ID-only reads (`web_read` takes `result_id` matching `^r[1-9][0-9]*$`, with no
     free URLs).
   - Query screening against leaking source or secrets (`src/web.rs:474-529`).
   - The `allow_private` consent gate.
   - Shared per-review budgets (4 searches + 4 reads by default; this evaluation
     used 2 + 2 and still found both bugs).
   - The investigator prompt ("never send source, PR text or secrets"; "read
     load-bearing evidence").
   - Validator-side independent checking and the uncertain channel. In the runs,
     the only wrong web-induced claim ("`^16.1.0` may not exist") went to
     *uncertain*, not to findings.

### Tool schema (unchanged)

The existing schemas (`src/tools.rs:433-445`) are already the contract this
evaluation used:

```json
{"name": "web_search", "input_schema": {"type": "object", "required": ["query"],
  "properties": {"query": {"type": "string", "maxLength": 300}}}}
{"name": "web_read", "input_schema": {"type": "object", "required": ["result_id"],
  "properties": {"result_id": {"type": "string", "pattern": "^r[1-9][0-9]*$"}}}}
```

### Prompting

Keep the version-specific instructions. In every successful run, the reviewer
searched for the exact major version's release notes or migration guide and cited
official sources. Some reviewers also read a page, but several found the bug from
search excerpts alone (for example Exa runs with zero reads), so this evaluation
does not show that a mandatory read is needed. One addition is worth testing: a short instruction that
a behavior change visible only in docs (such as "pass `false` to skip pooling")
should be filed as a non-blocking question unless it breaks documented behavior.
That was the only source of strict clean-control flags.

## OpenCode

### Decision

- **Provider:** Parallel `fast` for interactive coding: 24/24 evidence@5,
  12/12 at rank 1 on coding-style lookups, 0.53 s p50, the lowest cost. Exa `auto`
  is equally accurate but about 8x slower per search (4.5 s p50).
- **Update 2026-10-24 (post-hoc, [REPORT.md](REPORT.md#post-hoc-additions-2026-10-24)):**
  cache-free Exa `auto` searches now take 0.47 s p50, vs 0.55 s for Parallel `fast`
  on the same day, so latency no longer separates them. Exa had more evidence at
  rank 1 (23 vs 21 of 24) and Parallel costs about 4x less. Either is a sound
  choice. Exa `lite` (same evidence, $0.004 per search) sits between them. If Exa is
  used, pass the agent's purpose as `objective`: Exa recommends it, and it was
  neutral here. If Firecrawl is used, prefer `/v2/search/developer` for code
  questions (19/24 vs 16/24 evidence@5) and general search for advisories.
- **Expected benefit is small for well-known libraries.** No-search passed 4/4
  coding tasks, the same as the best search arm. A likely but untested explanation
  is that the model already knew these upgrades. Search should be a tool the model chooses to call, not something
  run on every task.

### Native provider or plugin

OpenCode v2.0.32's built-in `websearch` only exposes `websearch.provider` (a
provider ID, `random`, or `false`). Request parameters cannot be configured
(`packages/schema/src/config/websearch.ts:6-17`). The built-ins **do not send what
was evaluated here**:

| Provider | OpenCode v2.0.32 native request | Evaluated here |
| --- | --- | --- |
| Parallel | hosted MCP `search.parallel.ai/mcp`, `web_search` with `{objective: query, search_queries: [query]}`, no mode or result count (`packages/core/src/plugin/websearch/parallel.ts:9-89`) | REST `/v1/search`, `mode: fast`, 5 results, 4,000 chars each, `objective` = task purpose |
| Exa | hosted MCP `mcp.exa.ai/mcp`, `web_search_exa` with `{query, numResults: 8}` (`.../exa.ts:8-83`) | REST `/search`, `type: auto`, 5 results, highlights up to 4,000 chars |
| Tavily | REST `/search`, `search_depth: "basic"`, 8 results (`.../tavily.ts:8-64`) | `advanced`, 5 results |
| Firecrawl | hosted MCP `firecrawl_search`, `limit: 8`, no scraping (`.../firecrawl.ts:9-80`) | REST `/v2/search`, 5 results |

`webfetch` does a direct GET of any http(s) URL, with a 5 MiB cap and a 30 s default
timeout. It has **no private-address (SSRF) guard**
(`packages/core/src/tool/plugin/webfetch.ts:12-163`).

**Recommendation:**

1. **Lowest effort:** set `"websearch": {"provider": "parallel"}` and provide
   `PARALLEL_API_KEY` (or `/connect`). This is a reasonable default, but it is
   *not* the configuration measured here. Its result count, excerpt size and mode
   are whatever Parallel's hosted MCP chooses.
2. **To get the measured behavior, write a small plugin.** It would register a
   websearch provider with `Plugin.define({id, setup(ctx)})` and
   `ctx.websearch.transform(e => e.add({id, name, execute}))`. Its `execute` calls
   Parallel REST `/v1/search` with `mode: "fast"`, 5 results and about 4,000
   characters per result. It can also add a `web_read` tool through
   `ctx.tool.transform(...)` that only reads URLs returned by an earlier search,
   using Parallel `/v1/extract` with query-aware trimming to about 6,000 tokens.
   That also avoids `webfetch`'s missing SSRF guard for search-driven reads.
   - The existing `opencode-exa-parallel` plugin is a working template for
     provider registration and delegation (`exa-parallel.js:113-115,163-169`). Its
     order (Exa first, Parallel as fallback) favors accuracy over latency; for
     interactive use, consider swapping the order.
3. **Budgets:** 2 searches and 2 reads per task were enough in every coding run. A
   per-session cap avoids runaway cost. At these prices, cost is negligible next to
   model tokens: search arms used about 1.8x the model spend of no search through extra context, while
   provider fees were $0.001–0.016 per task.

Things not tested that a plugin could enable: domain targeting (for example
official docs and GitHub releases first), adaptive query rewriting, and reranking.
In this evaluation a single well-formed query per lookup was enough for the top
providers.

### OpenCode v1

v1 offers Exa or Parallel hosted MCP search only when enabled
(`OPENCODE_ENABLE_EXA=1` / `OPENCODE_ENABLE_PARALLEL=1`, or with OpenCode's own
plans). The plugin API differs from v2. The same advice applies: prefer Parallel,
and use a custom tool if you want the evaluated parameters.

## Shared questions

- **Same provider for both?** Exa would work for both: it is already in Revera
  and equally accurate for OpenCode, only slower. Parallel is the better
  interactive choice. Running two providers is justified only by latency
  preference, not by accuracy.
- **Common fallback?** Not justified by this data: no search failed. Add one only
  if production telemetry (Revera already records per-backend errors in
  `stats.tools[].backends`) shows real outages or 429s.
- **Data handling:** queries and selected URLs go to a third party with every
  provider. Brave's terms forbid storing results, which matters for any caching
  layer. Keep Revera's private-repository consent gate whichever provider is used.
- **What would change this:**
  - More Revera bug fixtures beyond version-upgrade bugs, and other ecosystems.
  - OpenCode tasks on libraries released after the model's training data.
  - Brave LLM Context on a plan that includes it.
  - Repeated retrieval runs over time; Exa and Parallel are within noise of each
    other.