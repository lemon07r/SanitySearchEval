import type { RawResult } from "../types";
export function normalizeBrave(data: any, mode = "llm-context"): RawResult[] {
  const rows = mode === "web" ? data?.web?.results : data?.grounding?.generic;
  if (rows === undefined && (data?.web || data?.grounding)) return [];
  if (!Array.isArray(rows)) throw new SyntaxError("Brave response missing results");
  return rows.filter(r => typeof r.url === "string").map(r => ({url: r.url, title: r.title ?? data.sources?.[r.url]?.title ?? "", published_at: mode === "web" ? r.page_age ?? null : data.sources?.[r.url]?.age?.[1] ?? null, snippet_or_excerpt: mode === "web" ? [r.description, ...(r.extra_snippets ?? [])].filter(Boolean).join("\n\n") : (r.snippets ?? []).map((s: any) => typeof s === "string" ? s : JSON.stringify(s)).join("\n\n"), source: data.sources?.[r.url]?.hostname ?? "brave"}));
}
