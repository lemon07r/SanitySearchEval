import type { SearchCase, SearchPayload, ReadPayload, Finding, Task } from "./types";
export function canonicalURL(input: string): string {
  try { const u = new URL(input); u.hostname = u.hostname.toLowerCase().replace(/^www\./, ""); u.hash = ""; for (const key of [...u.searchParams.keys()]) if (/^utm_/i.test(key)) u.searchParams.delete(key); u.searchParams.sort(); u.pathname = u.pathname.replace(/\/+$/, "") || "/"; return u.href.replace(/\/(?=\?|$)/, ""); } catch { return input; }
}
export function urlMatches(actual: string, target: {url: string; prefix?: boolean}): boolean {
  const a = canonicalURL(actual), b = canonicalURL(target.url);
  if (a === b) return true;
  if (target.prefix && a.startsWith(b) && (/[/?]$/.test(b) || /^[/?]/.test(a.slice(b.length)))) return true;
  try {
    const x = new URL(a), y = new URL(b);
    const gx = x.pathname.match(/^\/([^/]+\/[^/]+)\/blob\/[^/]+\/(.+)$/), gy = y.pathname.match(/^\/([^/]+\/[^/]+)\/blob\/[^/]+\/(.+)$/);
    return x.hostname === "github.com" && y.hostname === x.hostname && !!gx && !!gy && gx[1].toLowerCase() === gy[1].toLowerCase() && gx[2] === gy[2];
  } catch { return false; }
}
export const normalizeWhitespace = (text: string) => text.replace(/\s+/g, " ").trim();
// Markdown formatting is removed before matching so "**NOT**", `code` and escaped "set\\_var" match plain-text patterns.
export const normalizeForMatch = (text: string) => normalizeWhitespace(text.replace(/\\([\\`*_{}\[\]()#+\-.!<>|~])/g, "$1").replace(/\*\*|__|`/g, ""));
export function matchesGroups(text: string, patterns: string[][]): boolean { const normalized = normalizeForMatch(text); return patterns.some(group => group.length > 0 && group.every(p => new RegExp(p, "i").test(normalized))); }
export function evidence(text: string, c: SearchCase) { const facts = c.gold_facts.filter(f => f.load_bearing); return facts.length > 0 && facts.every(f => matchesGroups(text, f.patterns)); }
export function scoreSearch(c: SearchCase, search?: SearchPayload, read?: ReadPayload) {
  const result: any = {url: {}, evidence: {}, read_ok: !!read?.available, evidence_in_read: !!read?.available && evidence(read.text, c)};
  for (const k of [1, 3, 5]) { const top = search?.results.slice(0, k) ?? []; result.url[k] = top.some(r => c.acceptable_sources.some(s => urlMatches(r.url, s))); result.evidence[k] = !search?.error && evidence(top.map(r => `${r.title}\n${r.snippet_or_excerpt}`).join("\n"), c); }
  result.evidence_rank = search?.error ? null : (search?.results.findIndex((_, i) => evidence(search.results.slice(0, i + 1).map(r => `${r.title}\n${r.snippet_or_excerpt}`).join("\n"), c)) ?? -1) + 1 || null;
  return result;
}
export function scoreReview(task: Task, findings: Finding[]) {
  const reported = findings.filter(f => f.confidence === "high" || f.confidence === "medium");
  const matched = new Set<string>(); const unmatched: Finding[] = [];
  for (const f of reported) {
    const bugs = (task.known_bugs ?? []).filter(b => (f.file === b.file || f.file.endsWith("/" + b.file)) && matchesGroups(`${f.title} ${f.explanation}`, b.patterns));
    if (bugs.length) bugs.forEach(b => matched.add(b.id)); else unmatched.push(f);
  }
  return {clean: !!task.clean, bugs_available: task.known_bugs?.length ?? 0, matched_bug_ids: [...matched], reported, false_positives: task.clean ? reported : [], unmatched_reported: task.clean ? [] : unmatched, uncertain: findings.filter(f => f.confidence === "low")};
}
export function wilson(n: number, total: number): [number, number] { if (!total) return [0, 1]; const z = 1.96, p = n / total, d = 1 + z * z / total, center = (p + z * z / (2 * total)) / d, margin = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / d; return [center - margin, center + margin]; }
export function percentile(xs: number[], q: number): number | null { if (!xs.length) return null; const sorted = [...xs].sort((a, b) => a - b); const at = (sorted.length - 1) * q, lo = Math.floor(at); return sorted[lo] + (sorted[Math.ceil(at)] - sorted[lo]) * (at - lo); }
