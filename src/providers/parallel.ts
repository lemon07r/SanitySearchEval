import type { RawResult } from "../types";
export function normalizeParallel(data: any): RawResult[] {
  if (!Array.isArray(data?.results)) throw new SyntaxError("Parallel response missing results");
  return data.results.filter((r: any) => typeof r.url === "string").map((r: any) => ({url: r.url, title: r.title ?? "", published_at: r.publish_date ?? null, snippet_or_excerpt: (r.excerpts ?? []).join("\n\n"), source: "parallel"}));
}
export function readParallel(data: any, url: string) {
  const failed = data?.errors?.find((e: any) => e.url === url) ?? (!data?.results?.length ? data?.errors?.[0] : undefined);
  if (failed) return {text: "", error: {class: failed.http_status_code === 429 ? "http_429" as const : failed.http_status_code >= 500 ? "http_5xx" as const : failed.http_status_code >= 400 ? "http_4xx" as const : "empty" as const, message: `Parallel extract: ${failed.error_type ?? "error"}`}};
  if (!Array.isArray(data?.results)) throw new SyntaxError("Parallel response missing results");
  const row = data.results.find((r: any) => r.url === url) ?? data.results[0];
  return {text: row?.full_content || (row?.excerpts ?? []).join("\n\n"), title: row?.title};
}
