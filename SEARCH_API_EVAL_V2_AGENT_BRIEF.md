# Search API Eval v2 — agent implementation and execution brief

> **Your assignment:** Build and **run** a small, rigorous, reproducible comparison of five web-search providers—**Brave, Exa, Parallel, Firecrawl and Tavily**—to decide what should power (1) **Revera**, an automated GitHub PR reviewer, and (2) **OpenCode**, potentially through a purpose-built search/fetch plugin. This is a practical engineering/evaluation project, not a new search platform. Deliver tested results, raw evidence, a candid analysis, and implementation recommendations.
>
> The operator will place API keys in `.env`. Work autonomously using available keys. Do not stop after scaffolding or produce an unrun benchmark. If important credentials are absent, run everything feasible and accurately mark the blocked experiments. **Do not deploy or modify Revera/OpenCode themselves**; evaluate and propose integrations first.

## 1. Success criteria and constraints

1. **Answer two different questions independently:**
   - **Revera:** Which search+read implementation helps a bounded, cautious PR reviewer verify external library behavior, version-specific contracts, upstream issues, security advisories and breaking changes **without increasing false positives**?
   - **OpenCode:** Which search+read implementation helps an agent find applicable API/docs/examples and **complete real code changes correctly**, at reasonable latency, tokens and cost?
2. Test **realistic optimized provider configurations**, not a deliberately weak generic API call applied to everyone. Also include a carefully normalized retrieval-only comparison so we can distinguish raw discovery quality from provider-specific content enrichment.
3. Favor **deterministic ground truth** (known correct documentation passages, tests, and defect/non-defect fixtures). LLM judges are supporting evidence, never the only ground truth.
4. Prioritize **fast implementation and bounded runtime**. Target a useful first report with approximately **24 search cases + 8 end-to-end agent cases**, not hundreds of open-ended searches. Use a pilot to decide modes. Offer an optional second-pass confirmation for close contenders.
5. No dashboards that consume days, no browser automation unless genuinely necessary, no vector database, no microservices, no unnecessary abstraction. A single TypeScript CLI and a simple generated HTML/Markdown report are sufficient.
6. Do not assume any vendor's benchmark claims or the previous SanityWebEval ranking are correct. The prior eval (`https://sanityboard.lr7.dev/evals/web-search`) is background only: it had six distinct search scenarios repeated three times and mixed search relevance, embedding scores, reranker scores and extraction heuristics. **Do not reuse its scoring formula.**
7. **Keep failure data.** Timeouts, zero results, parse failures, quota errors, incomplete pages, bad citations and unsupported features count against a provider. Never compute a provider's main score only from successful requests.
8. Predeclare the protocol and freeze holdout data/configurations before running the main evaluation. No tweaking until a favored provider wins.

## 2. Stack and layout: minimum viable but sound

Use **Bun + TypeScript**, built-in `fetch`, a small HTML-to-text extraction library for shared fetching, and Bun's test runner. Use lightweight packages only when they save actual engineering time. Prefer JSON/JSONL files and static report generation to a database or frontend application. Do not install an MCP server for each provider. REST adapters are sufficient; native SDKs are acceptable only if they demonstrably simplify the implementation.

Suggested structure (adjust modestly for clarity):

```text
README.md                       # 5-minute setup, commands, limits
.env.example                    # placeholder variable NAMES ONLY
.gitignore                      # .env, private traces, fixtures' temp workspaces
package.json
src/
  cli.ts                        # doctor, pilot, run, report, resume
  types.ts                      # normalized contracts
  config.ts                     # profiles, budgets, input validation
  providers/{brave,exa,parallel,firecrawl,tavily}.ts
  web-read.ts                   # shared safe reader/fallback (if needed)
  agent.ts                      # ONE small provider-independent tool-calling loop
  score.ts                      # deterministic checks + optional blinded judge
  report.ts                     # transparent tables and recommendations
cases/
  pilot.json                    # non-overlapping mode-tuning cases
  search-holdout.json           # target facts/URLs and evaluation metadata
  agent-holdout.json            # PR and coding tasks with fixture paths
fixtures/                         # small pinned reproducible repositories/tests
results/<timestamp>/             # manifest, sanitized JSONL, scores, report
```

Scripts/CLI should support the equivalent of:

```bash
bun install
bun run doctor                       # credentials, modes, rate limits, smoke test
bun run pilot                        # short, budgeted mode selection
bun run eval -- --suite search        # held-out retrieval
bun run eval -- --suite agents        # held-out end-to-end
bun run eval -- --suite all           # both, within caps
bun run report -- --run results/<id>  # regenerate without network calls
```

Implement `--providers`, `--limit`, `--concurrency`, `--max-cost-usd`, `--max-minutes`, `--dry-run`, `--resume`, `--seed` (deterministic provider/case order), and `--no-judge`. Default to sensible limits and **refuse unexpectedly expensive plans before running**. Support resumable append-only data; do not charge again for completed calls by accident.

### Credentials / `.env`

```dotenv
BRAVE_API_KEY=
EXA_API_KEY=
PARALLEL_API_KEY=
FIRECRAWL_API_KEY=
TAVILY_API_KEY=

# Optional: the SAME tool-calling model for ALL agent runs.
AGENT_LLM_API_KEY=
AGENT_LLM_BASE_URL=https://openrouter.ai/api/v1
AGENT_LLM_MODEL=

# Optional: one fixed judge model, separate from ground-truth creation.
JUDGE_LLM_API_KEY=
JUDGE_LLM_BASE_URL=https://openrouter.ai/api/v1
JUDGE_LLM_MODEL=

# Optional for an isolated post-search reranking ablation.
OPENROUTER_API_KEY=
RERANK_MODEL=
EMBEDDING_MODEL=
```

Accept simple aliases/configurable env names if useful. If the same OpenRouter key serves the agent, judge, embeddings and reranker, allow that without duplication. Never print, persist or commit keys. Treat credentials from the user's `.env` as secrets: sanitize request URLs, headers, error traces, source excerpts, and report artifacts; `.gitignore` raw traces and `.env`. Never send private repository contents to public search APIs. Read-only, explicitly controlled API calls only.

## 3. Provider implementations: check CURRENT official APIs first

**Read current official documentation and capture the exact parameters, endpoint versions, request/response shapes, model/mode choices and pricing in a dated manifest.** Do not assume older blog posts or previous code still reflect the API. Build one production-plausible baseline per provider, then pilot at most **one alternative mode** per provider where there is a meaningful tradeoff.

| Provider | Realistic initial profile | Pilot alternative / considerations |
| --- | --- | --- |
| **Brave** | **LLM Context API**, `GET/POST /res/v1/llm/context`, small controlled context-token budget (not legacy Web Search only). Return source URLs, metadata and relevant content chunks. | Compare traditional `/res/v1/web/search` with `extra_snippets=true`, plus the **same shared page reader** if needed. Record that LLM Context is a separate endpoint. |
| **Exa** | `/search`, `type: "auto"`, `contents: { highlights: true }`; use `/contents` when agent opens a result. | Deep search on pilot only if it promises meaningful improvement. Measure extra time/cost; never compare Exa Deep full-page text against 500-character snippets and call it fair. |
| **Parallel** | Current **`/v1/search`**, `mode: "fast"`, with a clear `objective` and suitable `search_queries`; current **`/v1/extract`** for reads. | `mode: "advanced"` pilot; **do not silently use the default (Advanced)**. Inspect current v1 extract schema, especially `advanced_settings` (not older v1beta fields). |
| **Firecrawl** | Current v2 `/search`, with native query-relevant highlights; use `/scrape` or appropriate `scrapeOptions` when reading. | Pilot whether search with bundled markdown or summary significantly improves real answers; include all scraping latency and credits. |
| **Tavily** | `/search`, `search_depth: "advanced"` with small `chunks_per_source`; use `/extract` when opening a source. | Pilot `basic` versus `advanced` for cost/latency tradeoff, or use the simpler setting as production profile if quality is statistically similar. |

Official starting references:
- Brave LLM Context: https://api-dashboard.search.brave.com/documentation/services/llm-context
- Brave Web Search: https://api-dashboard.search.brave.com/documentation/web-search
- Exa Search: https://exa.ai/docs/reference/search
- Exa search guidance: https://github.com/exa-labs/agent-skills/blob/main/skills/build-with-exa/references/search.md
- Parallel Search GA: https://docs.parallel.ai/search/search-quickstart
- Parallel modes: https://docs.parallel.ai/search/modes
- Firecrawl Search: https://docs.firecrawl.dev/features/search
- Tavily Search: https://docs.tavily.com/documentation/api-reference/endpoint/search
- Tavily extract: https://help.tavily.com/articles/3363168593-extracting-web-content-using-tavily

For each provider, verify whether result content is snippets, highlights, excerpts or full text. Verify source URLs and titles; some services provide more structured provenance than others. **Do not replace raw search with provider-generated answers or use a separate agent/research product.** That would compare end-to-end proprietary agents, not search tools. Use domain restrictions only when warranted by the task (e.g., searching exact Rust or framework docs); the other providers should have equivalent task intent. Include external page-fetch support because a real code reviewer often needs to confirm an exact statement, not just read a snippet.

### Required normalized tool contract

Build the same two agent-facing tools for every provider:

- `web_search({query, purpose?})` → `[{id, title, url, published_at?, snippet_or_excerpt, source?}]`. **Never invent** dates or fill null data with guesses.
- `web_read({result_id})` → `{id, url, title?, text, available, error?, provenance}`. IDs must come from prior search output; do not allow arbitrary agent-supplied URLs. Preserve document sections, code examples and version numbers as far as possible.

Provider adapters can internally use any sensible native approach. If Brave or another provider has no equivalent page-reader endpoint, use one **common controlled HTTP/HTML reader** for fallback, and clearly attribute results and costs to `Brave + common reader` rather than Brave's native API. Common reader must block localhost/private IPs, redirects to them, non-HTTPS where not appropriate, huge responses and non-document URLs. Do not turn it into a full browser product.

Keep source/result identity, content provenance and `search_request_id` so a model can cite what it actually encountered. Apply the **same model-visible output budget** (suggest ~3,000–5,000 tokens per search call, with max five visible results) using deterministic section-preserving trimming. Do **not** naively take only the first 500 characters of long pages. Store both untrimmed provider output sizes and the exact normalized model-visible payload. Count provider-side retrieval plus subsequent fetches as one workflow's true latency/cost.

## 4. Fairness: two separate tracks, not one opaque blended score

### Track A — controlled discovery/retrieval

Same task query, max five **visible** source results, fixed output-token budget, same network timeout policy, same source-verification logic. Compare:

- URL/source recall@1/3/5 against preverified acceptable sources.
- **Evidence recall:** did the result actually expose the *load-bearing* correct version-specific fact/code example, not merely mention its topic?
- Source validity / authority and **citation support** (is the claimed answer genuinely supported by the cited text?).
- Information density (relevant evidence per visible token), extract/read completeness and fetch success.
- Latency p50/p90, errors, rate limits, true search+read cost, and tokens consumed.

**Distinguish `URL found` from `evidence found`:** an authoritative docs URL without the required detail should not count as a successful answer. Exact URL matching alone is insufficient; allow documented canonical/redirect equivalents.

### Track B — real provider-native agent usage (the PRIMARY decision track)

Expose the same `web_search`/`web_read` schemas, but let each provider use the sensible native endpoint and configured mode. Use the **same frozen tool-calling LLM**, prompt, local-file tools, budgets, and tasks. Allow the agent to choose to search or not. This answers whether provider-specific features translate into **better results**, rather than just benchmark-friendly snippets. Also run **no-web-search** baseline agents: web search should prove incremental utility rather than being assumed necessary.

Do not force all providers to use the same search parameters internally: Parallel's `objective` and Exa's natural-language query are different interfaces. Do fix the agent prompt and user task, record each transformed provider request, and never rewrite a failing query after seeing the holdout outcome.

The normalized track is an explanatory diagnostic; **do not override more important end-to-end outcomes just because one service scores higher on cosine similarity or a reranker confidence scale**.

## 5. Small, credible task sets

### Pilot (mode calibration) — 5–6 cases, NOT reused in holdout

Select a mix of exact technical fact, obscure API behavior, version-specific documentation, historical breaking change, and a GitHub issue/release note. Try primary and one justified alternate mode per provider. Choose one deployment configuration per provider **before** holdout based on quality, time and cost together (favor simpler/cheaper if results are comparable). Record all rejected configurations; do not tune further on holdout.

### Search holdout — approximately 24 UNIQUE cases

Balanced across the two intended products, chosen **before testing**:

- **12 Revera-like:** external contract verification for a dependency/API, older/newer version mismatch, upstream breaking behavior, security advisory conditions, library default semantics, cross-language/platform gotchas. Include at least **four negative/trap cases**: misleading blog post, fixed regression, unsupported/unreachable scenario, or version-inapplicable documentation. These specifically test whether web search makes a reviewer overconfident.
- **12 OpenCode-like:** new/changed SDK usage, exact CLI flags, obscure error troubleshooting, migration instructions, current recommended APIs, official examples versus old snippets, multi-source/ambiguous documentation.

Use a variety of ecosystems (e.g. Rust, TypeScript, Python, GitHub APIs, containers, databases). Include more than one website, but do not turn this into a generalized news benchmark.

Each case needs `id`, category, task/question **without answer leakage**, relevant package/version/time constraints, preverified `gold_facts`, `acceptable_source_urls`/domains (plural allowed), short source excerpts with precise URLs or saved local snapshots, negative conditions, date pinned/checked, and difficulty. Prefer independently verifiable primary sources, versioned upstream docs and official GitHub releases. Keep evaluator-owned truth separate from all agent-visible inputs. **Do not use any of the five candidate search providers to establish ground truth**; author it from primary source material and review a sample manually. A fixed public archive/snapshot is preferable for facts liable to drift. Record if a live document changed, and mark it unscorable rather than quietly rewriting truth.

### Agent holdout — 8 tasks total (4 Revera + 4 OpenCode), plus no-search baseline

**Revera tasks:** a small checked-out codebase + PR diff + safe local `read_file`/`grep_repo`. Include **two real introduced bugs involving external contracts** and **two clean/non-defect controls**, with a reachable-input analysis and known package versions. Reviewer must output structured candidates and citations; optionally use a second independent validator step **identically for every provider** if implementation stays simple. Score only grounded, validated issues, not enthusiasm or number of comments. Treat false positives as particularly damaging.

**OpenCode tasks:** small isolated repositories with a real needed change (migration, API usage, bug fix, config/CLI integration) requiring external docs. Agents get identical `read_file`, `edit_file`, and **allowlisted test command** tools. Score via clean, hidden deterministic tests plus code inspection for prohibited changes. Include a reasonably hard case; avoid tasks solvable through mere package-name recognition. Sandbox workspaces; no network during test execution. Tests must be authored **before** provider results are seen.

Use one run per provider per task in the quick pass (5 providers × 8 = 40 runs), plus eight no-search baseline runs. Then optionally repeat the top two contenders and baseline on the four most discriminating tasks (preselect rule, no cherry-picking). **This sample is small and directional; never claim 1–2 passes establish statistical superiority.** If time/cost runs out, prioritize all five providers completing the same smaller paired task set rather than an uneven partial matrix.

Optional follow-up after the quick pass: enlarge the holdout or repeat all arms on a frozen fixture set. Never label pilot and holdout pooled scores as a clean held-out estimate.

## 6. The agent harness: intentionally tiny

For end-to-end tasks, use **one** frozen LLM model and tool-calling API. It must be able to actually call tools; verify with a smoke test before running anything expensive. Set consistent reasoning effort/temperature where supported and record the actual provider/model settings. Do not allow silent provider/model fallbacks. If no tool-capable agent LLM key is provided, complete retrieval-only evaluation and mark the agent track blocked.

Approximate per-task limits (configurable in a single file):

- Agent LLM calls: maximum **6–8**.
- Search calls: maximum **2**; read calls: maximum **2**.
- Five visible results/search; **same final context budget** per provider.
- Agent wall time: **90 seconds**; search request timeout: **15 seconds**, read: **20 seconds**; honor provider rate limits.
- Concurrency: 3–5 across agents, with **per-provider throttles**. Interleave provider ordering to avoid ordering/time-of-day bias; use a deterministic seed.
- No arbitrary shell from LLM; allow only bounded file edits in ephemeral fixtures and predeclared test commands. Fail safely if a task cannot finish within budget.

Prompt should explain: prioritize repository facts, verify exact package versions, use web search only when helpful, distinguish source fact from code evidence, cite source URLs, do not speculate, and conclude when sufficient evidence exists. **Never require a citation for a task to pass unless the task genuinely requires external evidence**; otherwise a no-search control is artificially handicapped.

Maintain full **sanitized** audit trails: model ID and settings, prompt version/hash, messages, tool-call counts, provider-native request parameters (minus secrets), visible search/read payloads, model output, token usage, deterministic score and reported costs. Prompts and judge outputs must be reproducible from the frozen run manifest.

## 7. Scoring: transparent, outcome-first, failure-inclusive

Produce separate tables for **Revera**, **OpenCode**, and **retrieval-only**. Report raw numerators/denominators alongside rates; do not use one misleading weighted 0–100 ranking.

**Revera primary:** correctly validated introduced bugs / available known bugs; **false-positive findings per clean PR** (report exact count), missed bugs, uncertain findings, review completion, and latency/cost. Show the actual problematic finding text and why it was wrong. If a provider leads in recall but causes more confident false positives, call this out rather than hiding it in an average.

**OpenCode primary:** deterministic **tests passing / total tasks** (and partial test counts), correct implementation, regression violations, timeouts, tool-use efficiency and **total** cost (model + search + read). Keep search spend and model spend separately as well.

**Retrieval primary:** ground-truth evidence present at rank k, citation accuracy, version applicability, read success; latency and USD cost per successful evidenced query. Report provider availability/error rate separately.

**For all:** show search latency versus full search→read latency, p50/p90 (or per-run values when samples too small for meaningful tails), median visible tokens, model tokens, provider fees, retries, and failure causes. Explicitly distinguish cost estimated from pricing docs versus cost metered in API usage. If missing, show `unknown`, never `$0`.

For tiny samples use paired case tables and **confidence ranges when appropriate**, with warnings about low power. Don't run NHST on six cases or claim that nominal 82% versus 80% proves a winner. Report timing variability and caching. Do not treat cosine similarity, provider relevance scores, judge confidence, number of returned characters, or mean score of only successful calls as independently validated quality.

### Optional LLM judging

If a judge key/model exists, use **one fixed, explicitly named external judge model** for nuanced support/relevance grading *after* objective checks. Blind provider names, shuffle comparison order, supply the frozen truth + actual cited text, ask for structured JSON with:

- evidence support (`supported` / `contradicted` / `insufficient`),
- version applicability,
- source authority,
- concise quote or reference supporting the judgment,
- confidence and reason.

Judge only what is genuinely subjective; do not ask it to replace hidden tests or known defect truth. Spot-check at least six judgments manually or via a separate verifier and report disagreements. A shared judge can still be biased toward certain writing styles; preserve raw artifacts so a human can audit.

### Optional embeddings/reranker: only as a small A/B study

Do **not** add embeddings, a vector index, or reranking to the core comparison by default. Their scores are not inherently ground-truth relevance. If an `OPENROUTER_API_KEY` and `RERANK_MODEL` are supplied **and the core run is complete**, test a shared reranker on the **same exact raw candidate pool per provider** for 6–8 prechosen ambiguous retrieval cases, with a fixed source count/content cap. Compare each provider **with and without** reranking, tally added USD, latency, tokens and evidence@k. Use OpenRouter `POST /api/v1/rerank` (verify supported model/current schema). Embeddings `POST /api/v1/embeddings` are useful only if there is a concrete hypothesis to test, such as retrieval quality with a common semantic postfilter; never silently introduce them into one provider's primary results. Avoid expensive/irrelevant combinations.

References: https://openrouter.ai/docs/api/api-reference/rerank/create-rerank and https://openrouter.ai/docs/api/api-reference/embeddings/create-embeddings

## 8. Runtime, cost and reliability controls

**Default run budget:** target approximately **20–35 minutes** for the meaningful quick pass, recognizing real-world API/LLM times vary. Default maximum total spend **US$20**, configurable. Show a pre-run estimated call matrix and spend; demand explicit override only if predicted/observed costs exceed the configured cap. Pilot is small and separate from holdout. Use global concurrency and per-provider rate limits; preserve fair paired completion if stopping early.

- A quick successful first run is better than massive coverage. Avoid repeated retries that dominate the benchmark; use at most one justified retry for transient 429/5xx/timeouts with a bounded backoff and charge/report it.
- **No result caching** for primary cold performance measurements (or use a clearly labeled separate warm test). Internal API/server cache cannot always be disabled; log cache headers and time-of-run when exposed. Caching evaluation inputs for offline reruns is encouraged; reuse captured content for judge/report rebuilds, not for live latency figures.
- Failures/timeouts count in completion denominators. Abort gracefully when caps are reached and save partial results and reasons.
- If an API has no usable paid quota or key, record `blocked`, not `loser`, and don't manufacture sample calls.
- Store sanitized exact HTTP provider response status, provider request IDs where available, timestamps, usage and pagination info. Capture versions of docs/pricing and source snapshots when license/robots permit; otherwise store enough citations and hashes to reproduce evidence checks.
- Output should be deterministic from saved raw artifacts; do not require any LLM calls to regenerate the report.
- Add unit tests for response normalization, failures, token trimming (must retain relevant code blocks), provenance/URLs, parser edge cases, scoring including failed calls, cost accounting and leaked-secret redaction.

## 9. Decide what actually to integrate

At the end, produce **two independent recommendations**, not one universal winner:

**For Revera:** choose primary provider/mode and backup only if operationally justified; suggested Rust implementation using existing `reqwest`/`ToolBox`, `web_search` + `web_read`, conservative opt-in/default, rate/cost budgets, version-aware prompts, fresh validation and honest `partial`/`uncertain` handling. Explicitly judge whether adding search at all improves over the no-search baseline, especially on clean PRs. Avoid leaking private code in search queries.

**For OpenCode:** choose provider/mode and suggested optimal integration (**native provider versus custom lightweight plugin/search+read tools**). Explain whether adaptive query construction, domain targeting, controlled context budgets and selective source reading improve coding outcomes. **Do not build an OpenCode plugin as a prerequisite to the evaluation**; the provider-independent agent harness is sufficient for selection. Only if clearly quick and useful, provide a small plugin integration sketch or scaffold *after* results. Explain any differences from today's OpenCode native behavior; do not assume a vendor's 'advanced' API maps to OpenCode's built-in default.

Address whether a common fallback provider is warranted, whether the same provider suits both products, and what additional data would change your mind. If statistically indistinguishable, say so and prefer simplicity, reliability, latency, data handling and cost. Never write marketing language or an invented definitive winner.

## 10. Concrete deliverables and definition of done

The project is finished only when the following exist:

1. **Working command-line runner**, five real provider adapters, common tool contract, retries/timeouts, budgeted concurrency, resumability, tests, and `doctor` smoke checks.
2. **Frozen input corpus** with documented, independently verified truth, negatives and local fixture tests. Pilot and holdout separate.
3. **Executed quick-pass results** for every usable credential; baseline comparisons; sanitized per-case JSONL/manifest. No quietly skipped providers/cases.
4. `results/<run>/REPORT.md` with separated Revera/OpenCode recommendations, transparent paired tables, successes, false positives, failure logs, actual native parameter choices, latency, costs and limitations.
5. A small static `results/<run>/report.html` is optional and must take little time; prefer report completeness to UI polish.
6. `README.md` documenting `bun install`, `.env`, `doctor`, `pilot`, `eval`, `report`, and how to safely rerun/extend cases.
7. A **short implementation handoff** (`INTEGRATION_RECOMMENDATIONS.md`) for Revera and OpenCode: tool schemas, default provider/mode, configuration/API-key patterns, security boundaries and specific files/hooks to change where verified.
8. A `LIMITATIONS.md` or report section honestly listing what was not tested, small-sample uncertainty, price estimates, changes over time and whether the judge/re-rank experiments were enabled.

**Order of execution:** inspect current APIs → small adapters/normalization/tests → `doctor` → author/freeze independent ground truth → run pilot and freeze profiles → run held-out retrieval → run end-to-end agent fixtures and no-web baseline → optional rerank/judge checks → score/report → only then suggest integration. Keep the project lean and finish the useful work rather than spending all effort building a framework.

**Do not claim an evaluation was completed unless its calls actually ran and artifacts were recorded.** If execution is blocked, provide the exact blocker, results from completed parts, and one command to resume.
