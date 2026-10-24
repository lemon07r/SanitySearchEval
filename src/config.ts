import type { Profile, Provider, Cost } from "./types";
export const LIMITS = { search_tokens: 4000, read_tokens: 6000, results: 5, search_ms: 15000, read_ms: 20000, body_bytes: 3 * 1024 * 1024, redirects: 5, provider_concurrency: 2, concurrency: 3, max_cost_usd: 20, max_minutes: 45, revera: { calls: 8, wall_ms: 240000 }, opencode: { calls: 12, wall_ms: 300000 }, web_search: 2, web_read: 2 };
export const PROVIDER_LIMITS: Record<Provider, {concurrency: number; min_interval_ms: number}> = {
  brave: {concurrency: 1, min_interval_ms: 1100},
  exa: {concurrency: 2, min_interval_ms: 0},
  parallel: {concurrency: 2, min_interval_ms: 0},
  firecrawl: {concurrency: 1, min_interval_ms: 6500},
  tavily: {concurrency: 2, min_interval_ms: 0}
};
export const BRAVE_CONTEXT_BLOCKED = "OPTION_NOT_IN_PLAN: the key's Brave plan ('Free AI') does not include LLM Context (checked 2026-10-19)";
export const PRICES = { brave: 0.005, exa: {auto: 0.007, "deep-lite": 0.012, "auto-objective": 0.007, "auto-dynamic": 0.007, "auto-uncached": 0.007, "auto-objective-uncached": 0.007, lite: 0.004, read: 0.001}, parallel: {fast: 0.001, advanced: 0.005, read: 0.001}, firecrawl_credit: 0.00099, tavily_credit: 0.008, model: {input: 4, output: 20, cache_read: 0.20, cache_write: 5} };
const p = (provider: Provider, mode: string, baseline: boolean, search: Profile["search"], read: Profile["read"]): Profile => ({id: `${provider}:${mode}`, provider, mode, baseline, search, read});
const post = (url: string, params: any) => ({url, method: "POST", params});
export const PROFILES: Profile[] = [
  {...p("brave", "llm-context", true, post("https://api.search.brave.com/res/v1/llm/context", {q: "$query", count: 10, maximum_number_of_urls: 5, maximum_number_of_tokens: 4096, maximum_number_of_tokens_per_url: 1024, enable_source_metadata: true}), {url: "$result_url", method: "GET", params: {reader: "common-reader"}}), blocked_reason: BRAVE_CONTEXT_BLOCKED},
  p("brave", "web", false, {url: "https://api.search.brave.com/res/v1/web/search", method: "GET", params: {q: "$query", count: 5, extra_snippets: true, text_decorations: false, result_filter: "web"}}, {url: "$result_url", method: "GET", params: {reader: "common-reader"}}),
  ...["auto", "deep-lite"].map(mode => p("exa", mode, mode === "auto", post("https://api.exa.ai/search", {query: "$query", type: mode, numResults: 5, contents: {highlights: {maxCharacters: 4000}}}), post("https://api.exa.ai/contents", {urls: ["$result_url"], text: {maxCharacters: 60000}}))),
  ...["fast", "advanced"].map(mode => p("parallel", mode, mode === "fast", post("https://api.parallel.ai/v1/search", {objective: "$purpose_or_query", search_queries: ["$query"], mode, max_chars_total: 20000, advanced_settings: {max_results: 5, excerpt_settings: {max_chars_per_result: 4000}}}), post("https://api.parallel.ai/v1/extract", {urls: ["$result_url"], objective: "$purpose_or_query", advanced_settings: {full_content: {max_chars_per_result: 60000}}}))),
  ...["search", "search-md"].map(mode => p("firecrawl", mode, mode === "search", post("https://api.firecrawl.dev/v2/search", {query: "$query", limit: 5, sources: ["web"], highlights: true, timeout: 15000, ...(mode === "search-md" ? {scrapeOptions: {formats: ["markdown"], onlyMainContent: true}} : {})}), post("https://api.firecrawl.dev/v2/scrape", {url: "$result_url", formats: ["markdown"], onlyMainContent: true, timeout: 20000}))),
  ...["advanced", "basic"].map(mode => p("tavily", mode, mode === "advanced", post("https://api.tavily.com/search", {query: "$query", search_depth: mode, chunks_per_source: 3, max_results: 5, include_answer: false, include_raw_content: false, include_usage: true, include_published_date: true, auto_parameters: false}), post("https://api.tavily.com/extract", {urls: ["$result_url"], extract_depth: "basic", format: "markdown", include_usage: true}))),
  // Added after the frozen evaluation on 2026-10-24; keep the original profiles unchanged.
  {...p("firecrawl", "developer", false, post("https://api.firecrawl.dev/v2/search/developer", {query: "$query", k: 5, passages: 5, types: ["doc", "issue", "pull_request", "readme"]}), post("https://api.firecrawl.dev/v2/scrape", {url: "$result_url", formats: ["markdown"], onlyMainContent: true, timeout: 20000})), posthoc: true},
  ...["auto-objective", "auto-dynamic", "lite"].map(mode => ({...p("exa", mode, false, post("https://api.exa.ai/search", {query: "$query", type: mode === "lite" ? "lite" : "auto", numResults: 5, objective: "$purpose", contents: {highlights: mode === "auto-dynamic" ? {dynamic: true} : {maxCharacters: 4000}}}), post("https://api.exa.ai/contents", {urls: ["$result_url"], text: {maxCharacters: 60000}})), posthoc: true as const, ...(mode === "auto-dynamic" ? {headers: {"Exa-Beta": "dynamic-highlights-2026-08-28"}} : {})})),
  // Exa's result cache ignores `objective` but keys on highlight maxCharacters, so this pair uses distinct, otherwise
  // negligible maxCharacters values to get uncached, independent auto vs auto+objective results.
  ...[["auto-uncached", 3998, false], ["auto-objective-uncached", 3999, true]].map(([mode, chars, objective]) => ({...p("exa", mode as string, false, post("https://api.exa.ai/search", {query: "$query", type: "auto", numResults: 5, ...(objective ? {objective: "$purpose"} : {}), contents: {highlights: {maxCharacters: chars}}}), post("https://api.exa.ai/contents", {urls: ["$result_url"], text: {maxCharacters: 60000}})), posthoc: true as const})),
  {...p("brave", "web-nospell", false, {url: "https://api.search.brave.com/res/v1/web/search", method: "GET", params: {q: "$query", count: 5, extra_snippets: true, text_decorations: false, result_filter: "web", spellcheck: false}}, {url: "$result_url", method: "GET", params: {reader: "common-reader"}}), posthoc: true},
];
export function template(value: any, vars: Record<string, string | undefined>): any {
  const keep = (v: any) => v !== "$purpose" || !!vars["$purpose"]?.trim();
  if (value === "$purpose") return keep(value) ? vars[value] : undefined;
  if (typeof value === "string") return vars[value] ?? value;
  if (Array.isArray(value)) return value.filter(keep).map(v => template(v, vars));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, v]) => keep(v)).map(([k, v]) => [k, template(v, vars)]));
  return value;
}
export const unknownCost = (basis = "unavailable"): Cost => ({estimated_usd: null, metered_usd: null, basis});
export function sumCosts(costs: Cost[]): Cost {
  if (!costs.length) return {estimated_usd: 0, metered_usd: 0, basis: "no calls"};
  return {estimated_usd: costs.every(c => c.estimated_usd !== null) ? costs.reduce((s, c) => s + c.estimated_usd!, 0) : null, metered_usd: costs.every(c => c.metered_usd !== null) ? costs.reduce((s, c) => s + c.metered_usd!, 0) : null, basis: [...new Set(costs.map(c => c.basis))].join("; ")};
}
