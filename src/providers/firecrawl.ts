import type { RawResult } from "../types";
export function normalizeFirecrawl(data: any): RawResult[] {
  if (data?.success === false) throw new SyntaxError("Firecrawl success=false");
  if (!Array.isArray(data?.data?.web)) throw new SyntaxError("Firecrawl response missing data.web");
  return data.data.web.filter((r: any) => typeof r.url === "string").map((r: any) => ({url: r.url, title: r.title ?? "", published_at: r.metadata?.publishedDate ?? r.metadata?.published_date ?? null, snippet_or_excerpt: [r.description, r.markdown].filter(Boolean).join("\n\n"), source: "firecrawl", markdown: r.markdown, metadata: r.metadata}));
}
export function normalizeFirecrawlDeveloper(data: any): RawResult[] {
  if (data?.success === false) throw new SyntaxError("Firecrawl developer success=false");
  if (!Array.isArray(data?.results)) throw new SyntaxError("Firecrawl developer response missing results");
  return data.results.filter((r: any) => typeof r?.url === "string").map((r: any) => ({title: r.title?.trim() || r.url, url: r.url, published_at: null, snippet_or_excerpt: (r.passages ?? []).map((p: any) => p.text).join("\n\n"), source: "firecrawl-developer", metadata: {id: r.id, type: r.type ?? (typeof r.id === "string" ? r.id.split(":")[0] : null)}}));
}
export function readFirecrawl(data: any) {
  if (data?.success === false) return {text: "", error: {class: "empty" as const, message: "Firecrawl scrape failed"}};
  if (!data?.data) throw new SyntaxError("Firecrawl response missing data");
  const status = Number(data.data.metadata?.statusCode);
  if (status >= 400) return {text: "", metadata: data.data.metadata, error: {class: status === 429 ? "http_429" as const : status >= 500 ? "http_5xx" as const : "http_4xx" as const, message: `Firecrawl target HTTP ${status}`}};
  return {text: data.data.markdown ?? "", title: data.data.metadata?.title, metadata: data.data.metadata};
}
