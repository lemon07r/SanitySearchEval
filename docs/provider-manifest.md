# Provider API manifest (checked 2026-10-19 against official docs)

Prices are list prices from the cited pages on the check date. "Estimated" cost in
reports is computed from these; "metered" cost comes from fields the API returned.

## Brave Search API

- Docs: https://api-dashboard.search.brave.com/documentation/services/llm-context ,
  https://api-dashboard.search.brave.com/api-reference/web/search/get ,
  pricing https://brave.com/search/api/ , rate limits
  https://api-dashboard.search.brave.com/documentation/guides/rate-limiting
- Base `https://api.search.brave.com/res`, header `X-Subscription-Token`.
- **LLM Context** `POST /v1/llm/context` (JSON body, same params as GET). `q` ≤600 chars
  and ≤75 words. `count` 1–50 (candidates), `maximum_number_of_urls` 1–50,
  `maximum_number_of_tokens` 1024–32768 (default 8192),
  `maximum_number_of_tokens_per_url` 512–8192, `enable_source_metadata` bool,
  `context_threshold_mode` strict|balanced|lenient|disabled (omit = server default).
  Response: `grounding.generic[] {url,title,snippets[]}`; `sources[url] {title,hostname,age[]}`
  where `age` is `[]` or `[full-date, YYYY-MM-DD, relative, ISO8601]`. Snippets may be
  JSON-serialized structured data. Pipeline changed 2026-07-31 (header
  `Api-Version: 2026-02-06` selects the old one; we use the current default).
- **Web Search** `GET /v1/web/search?q=&count=&extra_snippets=true&text_decorations=false&result_filter=web`.
  Response `web.results[] {url,title,description,extra_snippets[],age,page_age}`.
  `page_age` is a date string (format not guaranteed); `age` is human-readable.
- No page reader endpoint → `web_read` uses the common reader ("Brave + common reader").
- Price: "$5 per 1,000 requests" for both endpoints ($0.005/request). Limits: 50 QPS
  (plan dependent), 1 s sliding window, `X-RateLimit-*` headers.
- Data terms: Brave's FAQ says "It is prohibited to retain any and all data received
  through the Brave Search API". This project keeps provider content only in the
  git-ignored `results/<run>/private/` directory and publishes metrics, URLs and hashes.

## Exa

- Docs: https://exa.ai/docs/reference/search , https://exa.ai/docs/reference/get-contents ,
  https://exa.ai/pricing
- `POST https://api.exa.ai/search`, header `x-api-key`. Body
  `{query, type: instant|fast|auto|deep-lite|deep|deep-reasoning, numResults,
  contents: {highlights: true | {query?, maxCharacters?}, text?: {maxCharacters}}}`.
  Without `contents` no page text is returned.
- Response `results[] {id,url,title,publishedDate?,author?,highlights[]?,text?,highlightScores?}`,
  `requestId`, `searchTime`, `costDollars.total` (Exa calls it an estimate).
- `POST /contents` with `{urls:[...], text:{maxCharacters}}` (top-level options),
  response `results[]`, `statuses[] {id,status:success|error,source:cached|crawled,error?}`,
  `costDollars`.
- Price: search instant $4/1k, fast/auto $7/1k, deep-lite $12/1k, deep $12/1k,
  deep-reasoning $15/1k (≤10 results, text/highlights bundled). Contents $1/1k pages
  per content type. Limits: search 10 QPS, deep 5 QPS, contents 100 QPS.

## Parallel

- Docs: https://docs.parallel.ai/api-reference/search/search ,
  https://docs.parallel.ai/api-reference/extract/extract ,
  https://docs.parallel.ai/search/modes , https://docs.parallel.ai/getting-started/pricing
- `POST https://api.parallel.ai/v1/search`, header `x-api-key`. Body
  `{objective?, search_queries: string[] (≥1), mode: turbo|fast|basic|advanced
  (DEFAULT advanced — always set explicitly), max_chars_total?,
  advanced_settings: {max_results (default 10, ≤20), excerpt_settings: {max_chars_per_result},
  source_policy?, fetch_policy?}}`.
- Response `search_id, session_id, results[] {url,title?,publish_date? (YYYY-MM-DD),excerpts[]}`,
  `usage[] {name,count}` (SKU counts, not dollars), `warnings[]`.
- `POST /v1/extract` body `{urls[], objective?, search_queries?, max_chars_total?,
  advanced_settings: {excerpt_settings?, full_content?: bool|{max_chars_per_result}, fetch_policy?}}`.
  Response `extract_id, results[] {url,title,publish_date,excerpts[],full_content?}`,
  `errors[] {url,error_type,http_status_code,content}`. Old v1beta top-level
  `full_content/fetch_policy/excerpts` fields return 422.
- Price: turbo/fast $1 per 1k requests; basic/advanced $5 per 1k; +$1 per 1k results
  beyond 10; Extract $1 per 1k URLs. Limits: 600 req/min each.

## Firecrawl v2

- Docs: https://docs.firecrawl.dev/api-reference/endpoint/search ,
  https://docs.firecrawl.dev/api-reference/endpoint/scrape ,
  https://docs.firecrawl.dev/features/search-highlights , https://www.firecrawl.dev/pricing
- `POST https://api.firecrawl.dev/v2/search`, `Authorization: Bearer`. Body
  `{query (≤500 chars), limit (per source; set explicitly), sources:["web"],
  highlights: true (default; replaces description with query-relevant passages),
  scrapeOptions?: {formats:["markdown"], onlyMainContent:true}, timeout (ms)}`.
  Response `success, data.web[] {url,title,description,markdown?,metadata?}, id,
  creditsUsed, warning`.
- `POST /v2/scrape` `{url, formats:["markdown"], onlyMainContent:true, timeout}`;
  default `maxAge` = 2 days (cache); response `data.markdown,
  data.metadata {statusCode, sourceURL, url, cacheState?, cachedAt?, creditsUsed?}`.
  HTTP 200 can wrap a target 403/404: check `metadata.statusCode`.
- Credits: search 2 per 10 results; +1 per scraped page; scrape 1 per page.
  USD/credit depends on plan: Standard $99/100k = $0.00099 (used for estimates),
  Hobby $19/5k = $0.0038. Limits: Standard 500 RPM per endpoint.

## Tavily

- Docs: https://docs.tavily.com/documentation/api-reference/endpoint/search ,
  https://docs.tavily.com/documentation/api-reference/endpoint/extract ,
  https://docs.tavily.com/documentation/api-credits
- `POST https://api.tavily.com/search`, `Authorization: Bearer`. Body
  `{query, search_depth: basic|advanced|fast|ultra-fast, chunks_per_source 1–3,
  max_results 0–20, include_answer:false, include_raw_content:false,
  include_usage:true, include_published_date:true, auto_parameters:false}`.
  Response `results[] {url,title,content,score,raw_content?,published_date?}`,
  `response_time` (s), `request_id`, `usage.credits`.
- `POST /extract` `{urls, extract_depth: basic|advanced, format: markdown|text,
  include_usage:true, timeout?}`; response `results[] {url,raw_content}`,
  `failed_results[] {url,error}`, `usage.credits`. HTTP 200 may still contain only failures.
- Credits: basic/fast/ultra-fast search 1, advanced 2; extract basic 1 per 5 successful
  URLs, advanced 2 per 5. Pay-as-you-go $0.008 per credit. Limits: dev 100 RPM,
  prod 1000 RPM.

## Agent / judge model

- Anthropic Messages API format through the operator's proxy
  (`JUDGE_LLM_MODEL_BASE_URL` + `/messages`), model `factory/claude-opus-5-5`
  (the proxy reports `claude-opus-5-5`). `thinking: {type: "adaptive"}`,
  `output_config: {effort: "medium"}` (medium is Opus 5.5's default).
- List price (https://platform.claude.com/docs/en/about-claude/pricing): input $4/MTok,
  output $20/MTok, cache write 5m $5, cache read $0.20. The proxy's real billing is
  not visible to us, so model cost is reported as an estimate at list price.

## OpenRouter rerank (optional ablation)

- `POST https://openrouter.ai/api/v1/rerank` `{model, query, documents: string[], top_n}`
  → `results[] {index, relevance_score}`, `usage.cost` (credits). Model
  `qwen/qwen3-reranker-8b`; price not published on the model page (reported as unknown
  unless `usage.cost` is returned).
