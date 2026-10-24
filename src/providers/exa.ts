import type { RawResult, ErrorClass } from "../types";
export function normalizeExa(data: any): RawResult[] {
  if (!Array.isArray(data?.results)) throw new SyntaxError("Exa response missing results");
  return data.results.filter((r: any) => typeof r.url === "string").map((r: any) => ({url: r.url, title: r.title ?? "", published_at: r.publishedDate ?? null, snippet_or_excerpt: Array.isArray(r.highlights) ? r.highlights.join("\n\n") : r.text ?? "", source: "exa"}));
}
// Same text parsing as OpenCode 2's built-in Exa provider (parseResults in its websearch/exa.ts).
export function normalizeExaMcp(data: any): RawResult[] {
  if (data?.error) throw new SyntaxError(`Exa MCP error: ${String(data.error.message ?? "unknown")}`);
  const content = data?.result?.content;
  if (!Array.isArray(content)) throw new SyntaxError("Exa MCP response missing content");
  if (data.result.isError) throw new SyntaxError(`Exa MCP tool error: ${String(content[0]?.text ?? "").slice(0, 200)}`);
  const text: string = content.find((item: any) => item?.text)?.text ?? "";
  return text.split(/\n\n---\n\n/).flatMap(block => {
    const url = block.match(/^URL:\s*(.+)$/m)?.[1]?.trim();
    if (!url) return [];
    const title = block.match(/^Title:\s*(.+)$/m)?.[1]?.trim();
    const published = block.match(/^Published:\s*(.+)$/m)?.[1]?.trim();
    const body = block.match(/^(?:Highlights|Text):\s*\n?([\s\S]*)$/m)?.[1]?.trim();
    return [{url, title: title && title !== "N/A" ? title : "", published_at: published && published !== "N/A" ? published : null, snippet_or_excerpt: body ?? "", source: "exa"}];
  });
}
export function readExa(data: any, url: string) {
  const failed = data?.statuses?.find((s: any) => s.status === "error" && (!s.id || s.id === url)) ?? (!data?.results?.length ? data?.statuses?.find((s: any) => s.status === "error") : undefined);
  if (failed) {
    const status = Number(failed.error?.httpStatusCode), tag = failed.error?.tag;
    const classification: ErrorClass = ["CRAWL_TIMEOUT", "CRAWL_LIVECRAWL_TIMEOUT"].includes(tag) ? "timeout" : status === 429 ? "http_429" : status >= 500 ? "http_5xx" : status >= 400 ? "http_4xx" : "empty";
    return {text: "", error: {class: classification, message: `Exa contents status error${tag ? `; tag=${tag}` : ""}${Number.isFinite(status) ? `; HTTP ${status}` : ""}`}};
  }
  if (!Array.isArray(data?.results)) throw new SyntaxError("Exa response missing results");
  const row = data.results.find((r: any) => r.url === url || r.id === url) ?? data.results[0];
  return {text: row?.text ?? "", title: row?.title, metadata: {statuses: data.statuses}};
}
