import type { RawResult } from "../types";
export function normalizeTavily(data: any): RawResult[] {
  if (!Array.isArray(data?.results)) throw new SyntaxError("Tavily response missing results");
  return data.results.filter((r: any) => typeof r.url === "string").map((r: any) => ({url: r.url, title: r.title ?? "", published_at: r.published_date ?? null, snippet_or_excerpt: r.content ?? "", source: "tavily"}));
}
export function readTavily(data: any, url: string) {
  const failed = data?.failed_results?.find((r: any) => r.url === url) ?? (!data?.results?.length ? data?.failed_results?.[0] : undefined);
  if (failed) return {text: "", error: {class: "empty" as const, message: `Tavily extract failed: ${failed.error ?? "unknown"}`}};
  if (!Array.isArray(data?.results)) throw new SyntaxError("Tavily response missing results");
  const row = data.results.find((r: any) => r.url === url) ?? data.results[0];
  return {text: row?.raw_content ?? "", title: row?.title};
}
