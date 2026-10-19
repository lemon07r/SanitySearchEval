import type { RawResult } from "../types";
export function normalizeExa(data: any): RawResult[] {
  if (!Array.isArray(data?.results)) throw new SyntaxError("Exa response missing results");
  return data.results.filter((r: any) => typeof r.url === "string").map((r: any) => ({url: r.url, title: r.title ?? "", published_at: r.publishedDate ?? null, snippet_or_excerpt: Array.isArray(r.highlights) ? r.highlights.join("\n\n") : r.text ?? "", source: "exa"}));
}
export function readExa(data: any, url: string) {
  if (data?.statuses?.some((s: any) => s.status === "error" && (!s.id || s.id === url)) || (!data?.results?.length && data?.statuses?.some((s: any) => s.status === "error"))) return {text: "", error: {class: "empty" as const, message: "Exa contents status error"}};
  if (!Array.isArray(data?.results)) throw new SyntaxError("Exa response missing results");
  const row = data.results.find((r: any) => r.url === url || r.id === url) ?? data.results[0];
  return {text: row?.text ?? "", title: row?.title, metadata: {statuses: data.statuses}};
}
