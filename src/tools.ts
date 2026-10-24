import { LIMITS, sumCosts } from "./config";
import { trimText, trimResults } from "./trim";
import type { Adapter, SearchPayload, ReadPayload, RawResult, Outcome } from "./types";
export const WEB_TOOLS = [
  {name: "web_search", description: "Search public external library documentation. Never include private repository code or proprietary identifiers.", input_schema: {type: "object", properties: {query: {type: "string"}, purpose: {type: "string"}}, required: ["query"], additionalProperties: false}},
  {name: "web_read", description: "Read a result returned by web_search, by result id only.", input_schema: {type: "object", properties: {result_id: {type: "string"}}, required: ["result_id"], additionalProperties: false}}
];
export class ToolSession {
  private results = new Map<string, {raw: RawResult; query: string; purpose?: string}>();
  readonly trace: {kind: "search" | "read"; outcome: Outcome<any>; visible: SearchPayload | ReadPayload}[] = [];
  private sequence = 0;
  constructor(readonly adapter: Adapter) {}
  async web_search(input: {query: string; purpose?: string}): Promise<SearchPayload> {
    const id = `s${++this.sequence}`;
    if (typeof input.query !== "string" || !input.query.trim()) return {search_request_id: id, results: [], error: {class: "parse", message: "query required"}};
    const outcome = await this.adapter.search(input.query, input.purpose);
    const profile = this.adapter.profile;
    const results = outcome.value.slice(0, profile.max_results ?? LIMITS.results).map((raw, i) => {
      const result_id = `${id}r${i + 1}`; this.results.set(result_id, {raw, query: input.query, purpose: input.purpose});
      return {id: result_id, title: raw.title, url: raw.url, published_at: raw.published_at, snippet_or_excerpt: "", source: raw.source, raw_chars: raw.snippet_or_excerpt.length, visible_chars: 0};
    });
    const payload: SearchPayload = {search_request_id: id, results, ...(outcome.error ? {error: outcome.error} : {})};
    // Profiles that mirror a host tool which shows results untrimmed skip the shared visible budget.
    if (profile.untrimmed) {
      results.forEach((r, i) => { r.snippet_or_excerpt = outcome.value[i].snippet_or_excerpt; r.visible_chars = r.snippet_or_excerpt.length; });
      this.trace.push({kind: "search", outcome, visible: payload});
      return payload;
    }
    const maxChars = LIMITS.search_tokens * 4;
    const base = JSON.stringify(payload).length;
    // JSON escaping and metadata count toward the visible payload budget too.
    let budget = Math.max(0, maxChars - base - 64);
    for (let pass = 0; pass < 8; pass++) {
      const texts = trimResults(outcome.value.slice(0, results.length).map(r => r.snippet_or_excerpt), input.query, budget);
      results.forEach((r, i) => { r.snippet_or_excerpt = texts[i]; r.visible_chars = texts[i].length; });
      const excess = JSON.stringify(payload).length - maxChars;
      if (excess <= 0) break;
      budget = Math.max(0, budget - excess - 32);
    }
    if (JSON.stringify(payload).length > maxChars) { for (const r of results) { r.snippet_or_excerpt = ""; r.visible_chars = 0; r.title = trimText(r.title, input.query, 200); } }
    this.trace.push({kind: "search", outcome, visible: payload});
    return payload;
  }
  async web_read(input: {result_id: string}): Promise<ReadPayload> {
    const stored = this.results.get(input.result_id);
    if (!stored) return {id: input.result_id ?? "", url: "", text: "", available: false, error: {class: "blocked", message: "Unknown result_id; arbitrary URLs are forbidden"}, provenance: "none", raw_chars: 0, visible_chars: 0};
    const outcome = await this.adapter.read(stored.raw, stored.purpose ?? stored.query);
    const payload: ReadPayload = {id: input.result_id, url: stored.raw.url, title: outcome.value.title ?? stored.raw.title, text: "", available: !outcome.error && !!outcome.value.text, provenance: outcome.value.provenance, raw_chars: outcome.value.text.length, visible_chars: 0, ...(outcome.error ? {error: outcome.error} : {})};
    const metadata = outcome.value.metadata;
    // Metadata stays in the private trace, not in model context.
    if (metadata) outcome.raw = {response: outcome.raw, metadata};
    let budget = Math.max(0, LIMITS.read_tokens * 4 - JSON.stringify(payload).length - 32);
    for (let pass = 0; pass < 8; pass++) {
      payload.text = trimText(outcome.value.text, stored.query, budget); payload.visible_chars = payload.text.length;
      const excess = JSON.stringify(payload).length - LIMITS.read_tokens * 4;
      if (excess <= 0) break;
      budget = Math.max(0, budget - excess - 32);
    }
    if (!payload.text.trim() && !payload.error) { payload.available = false; payload.error = {class: "empty", message: "No visible read text after trimming"}; }
    this.trace.push({kind: "read", outcome, visible: payload}); return payload;
  }
  get cost() { return sumCosts(this.trace.map(t => t.outcome.cost)); }
  get requests() { return this.trace.filter(t => t.outcome.http).map(t => ({kind: t.kind, ...t.outcome.http!.request, attempts: t.outcome.http!.attempts, ms: t.outcome.ms, pacing_ms: t.outcome.http!.pacing_ms ?? 0, error: t.outcome.error, cost: t.outcome.cost})); }
  get urls() { return [...new Set(this.trace.flatMap(t => t.kind === "search" ? (t.visible as SearchPayload).results.map(r => r.url) : [(t.visible as ReadPayload).url]))]; }
}
