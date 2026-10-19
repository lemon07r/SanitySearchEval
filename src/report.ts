import { readJSONL, writeSafe, sha256 } from "./store";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { sumCosts } from "./config";
import { percentile, wilson } from "./score";
import type { Unit, Cost } from "./types";
const fmt = (n: number | null | undefined, digits = 1) => n === null || n === undefined ? "unknown" : n.toFixed(digits);
const money = (n: number | null | undefined) => n === null || n === undefined ? "unknown" : `$${n.toFixed(5)}`;
const escape = (s: unknown) => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
function table(head: string[], rows: unknown[][]) { return ["| " + head.join(" | ") + " |", "| " + head.map(() => "---").join(" | ") + " |", ...rows.map(r => "| " + r.map(escape).join(" | ") + " |")].join("\n"); }
const ratio = (n: number, d: number) => `${n}/${d} (${d ? (100 * n / d).toFixed(1) : "0.0"}%)`;
const groups = (units: Unit[]) => [...new Set(units.map(u => u.arm))].sort().map(arm => ({arm, units: units.filter(u => u.arm === arm)}));
const cost = (units: Unit[], kind: "provider" | "model"): Cost => sumCosts(units.map(u => u.costs[kind] ?? {estimated_usd: null, metered_usd: null, basis: "missing"}));
function latency(units: Unit[], key: string) { const xs = units.map(u => Number(u.metrics[key] ?? 0)); return `${fmt(percentile(xs, .5))} / ${fmt(percentile(xs, .9))}`; }
const usage = (us: Unit[]) => ["input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"].map(k => us.reduce((n, u) => n + (u.metrics.usage?.[k] ?? 0), 0)).join(" / ");
export async function report(dir: string) {
  const units = await readJSONL<Unit>(join(dir, "units.jsonl")); const judgments = await readJSONL(join(dir, "judgments.jsonl"));
  const sections = ["# Search API evaluation", "Directional small-sample results; no blended score or claim of statistical superiority. Failures remain in every denominator. Costs distinguish estimates from returned dollars; unknown is not zero. Latencies include retries. No recommendation is inferred without completed evaluations."];
  let manifest: any; try { manifest = JSON.parse(await readFile(join(dir,"manifest.json"),"utf8")); } catch(e:any) { if (e.code !== "ENOENT") throw e; }
  const blocked = manifest?.blocked_profiles ?? [];
  if (blocked.length) sections.push("## BLOCKED profiles (not evaluated)", "These arms were not called and are excluded from outcome denominators, not scored as failures or losers.", table(["Profile","Status","Reason","Skipped units"],blocked.map((p:any)=>[p.id,"BLOCKED",p.reason,p.skipped_units??"not scheduled"])));
  const search = units.filter(u => u.suite === "search");
  sections.push("## Retrieval", table(["Profile", "url@1 / @3 / @5", "evidence@1 / @3 / @5", "evidence@5 Wilson 95%", "read_ok", "evidence_in_read", "search p50/p90 ms", "search+read p50/p90 ms", "median visible tokens", "USD/query est / metered", "USD/evidenced query est / metered", "Errors"], groups(search).map(({arm, units: us}) => {
    const n = us.length, hit = (key: string, k?: number) => us.filter(u => k ? u.metrics[key]?.[k] : u.metrics[key]).length;
    const e5 = hit("evidence", 5), interval = wilson(e5, n), c = cost(us, "provider");
    const errors: Record<string, number> = {}; for (const u of us) for (const cls of (u.metrics.error_classes ?? (u.error ? [u.error.class] : []))) errors[cls] = (errors[cls] ?? 0) + 1;
    return [arm, [1,3,5].map(k => ratio(hit("url", k), n)).join(" / "), [1,3,5].map(k => ratio(hit("evidence", k), n)).join(" / "), interval.map(x => (100*x).toFixed(1) + "%").join("–"), ratio(hit("read_ok"), n), ratio(hit("evidence_in_read"), n), latency(us, "search_ms"), latency(us, "total_ms"), fmt(percentile(us.map(u => u.metrics.visible_tokens ?? 0), .5), 0), `${money(c.estimated_usd === null ? null : c.estimated_usd/n)} / ${money(c.metered_usd === null ? null : c.metered_usd/n)}`, `${money(e5 && c.estimated_usd !== null ? c.estimated_usd/e5 : null)} / ${money(e5 && c.metered_usd !== null ? c.metered_usd/e5 : null)}`, Object.entries(errors).sort().map(([k,v]) => `${k}:${v}`).join(", ") || "none"];
  })));
  const traps = new Set<string>();
  let trapNote = "";
  for (const f of manifest?.case_files ?? []) {
    let raw: Buffer; try { raw = await readFile(f.path); } catch { trapNote = `Trap slice unavailable: ${f.path} is missing.`; continue; }
    if (sha256(raw) !== f.sha256) { trapNote = `Trap slice unavailable: ${f.path} changed since this run.`; continue; }
    for (const c of JSON.parse(raw.toString("utf8")).cases ?? []) if (c.trap) traps.add(c.id);
  }
  const slices: [string, (u: Unit) => boolean][] = [["Revera-like (r-)", u => u.caseId.startsWith("r-")], ["OpenCode-like (o-)", u => u.caseId.startsWith("o-")], ["Traps", u => traps.has(u.caseId)]];
  if (search.some(u => /^[ro]-/.test(u.caseId))) sections.push("### Retrieval by case slice", "Each cell: evidence@1 / evidence@5 / evidence_in_read, out of the slice size." + (trapNote ? " " + trapNote : ""), table(["Profile", ...slices.map(s => s[0])], groups(search).map(({arm, units: us}) => [arm, ...slices.map(([, keep]) => { const xs = us.filter(keep); return `${xs.filter(u => u.metrics.evidence?.[1]).length} / ${xs.filter(u => u.metrics.evidence?.[5]).length} / ${xs.filter(u => u.metrics.evidence_in_read).length} of ${xs.length}`; })])));
  const arms = [...new Set(search.map(u => u.arm))].sort();
  sections.push("### Per-case paired evidence matrix", table(["Case", ...arms], [...new Set(search.map(u => u.caseId))].sort().map(id => [id, ...arms.map(arm => { const matches = search.filter(u => u.caseId === id && u.arm === arm).sort((a,b) => a.rep-b.rep); return matches.length ? matches.map(u => `${matches.length > 1 ? `rep${u.rep}:` : ""}${u.status === "error" ? "ERR" : u.metrics.evidence_rank ?? "✗"}`).join(", ") : "not run"; })])));
  const review = units.filter(u => u.suite === "agents" && u.metrics.product === "revera");
  sections.push("## Revera", table(["Arm", "Bugs found / available", "Reported FPs / clean PRs", "Uncertain", "Completion", "Model calls", "Tokens input/output/cache-read/cache-write", "Model USD est", "Search+read USD est / metered", "Wall ms"], groups(review).map(({arm, units: us}) => {
    const c = cost(us, "provider"), m = cost(us, "model"); const completions: Record<string, number> = {}; for (const u of us) completions[u.metrics.completion] = (completions[u.metrics.completion] ?? 0)+1;
    return [arm, `${us.reduce((s,u) => s+(u.metrics.matched_bug_ids?.length ?? 0),0)}/${us.reduce((s,u) => s+(u.metrics.bugs_available ?? 0),0)}`, `${us.reduce((s,u) => s+(u.metrics.false_positives?.length ?? 0),0)} / ${us.filter(u => u.metrics.clean).length}`, us.reduce((s,u) => s+(u.metrics.uncertain?.length ?? 0),0), JSON.stringify(completions), us.reduce((s,u) => s+(u.metrics.model_calls ?? 0),0), usage(us), money(m.estimated_usd), `${money(c.estimated_usd)} / ${money(c.metered_usd)}`, us.reduce((s,u) => s+(u.metrics.wall_ms ?? 0),0)];
  })));
  sections.push("### Revera task outcomes", table(["Task", "Arm / rep", "Bugs", "FPs", "Uncertain", "Completion"], review.map(u => [u.caseId, `${u.arm} / ${u.rep}`, `${u.metrics.matched_bug_ids?.length ?? 0}/${u.metrics.bugs_available ?? 0}`, u.metrics.false_positives?.length ?? 0, u.metrics.uncertain?.length ?? 0, u.metrics.completion])));
  sections.push("### Reported clean-task and unmatched bug-task findings", table(["Task", "Arm", "Kind", "File:line", "Title", "Explanation", "Confidence", "Citations"], review.flatMap(u => [...(u.metrics.false_positives ?? []).map((f: any) => ({...f, kind: "clean-task FP (predeclared clean control)"})), ...(u.metrics.unmatched_reported ?? []).map((f: any) => ({...f, kind: "unmatched; manual adjudication required"}))].map(f => [u.caseId, u.arm, f.kind, `${f.file}:${f.line}`, f.title, f.explanation, f.confidence, f.citations.join(", ")]))));
  const code = units.filter(u => u.suite === "agents" && u.metrics.product === "opencode");
  sections.push("## OpenCode", table(["Arm", "All-pass tasks", "Violations", "Timeouts", "Tool calls", "Model USD est", "Search+read USD est / metered", "Wall ms"], groups(code).map(({arm, units: us}) => { const c = cost(us,"provider"), m = cost(us,"model"); return [arm, `${us.filter(u => u.metrics.all_pass).length}/${us.length}`, us.reduce((s,u) => s+(u.metrics.violations?.length ?? 0),0), us.filter(u => u.metrics.completion === "timeout" || u.metrics.hidden_tests?.timed_out).length, us.reduce((s,u) => s+Object.values(u.metrics.tool_counts ?? {}).reduce<number>((a,b) => a+Number(b),0),0), money(m.estimated_usd), `${money(c.estimated_usd)} / ${money(c.metered_usd)}`, us.reduce((s,u) => s+(u.metrics.wall_ms ?? 0),0)]; })));
  sections.push("### OpenCode task outcomes", table(["Task", "Arm / rep", "Hidden tests pass/total", "All pass", "Violations", "Completion", "Model calls", "Tokens input/output/cache-read/cache-write", "Wall ms"], code.map(u => [u.caseId, `${u.arm} / ${u.rep}`, `${u.metrics.hidden_tests?.pass ?? "unknown"}/${u.metrics.hidden_tests?.total ?? "unknown"}`, !!u.metrics.all_pass, (u.metrics.violations ?? []).join(", ") || "none", u.metrics.completion, u.metrics.model_calls ?? 0, usage([u]), u.metrics.wall_ms ?? 0])));
  if (judgments.length) sections.push("## Optional blinded judge (does not override scores)", table(["Profile", "Judgments", "Supported", "Contradicted", "Insufficient", "Errors"], [...new Set(judgments.map(j => j.arm))].sort().map(arm => { const js = judgments.filter(j => j.arm === arm); return [arm, js.length, ...["supported","contradicted","insufficient"].map(s => js.filter(j => j.judgment?.support === s).length), js.filter(j => j.error).length]; })), "Judgments require manual spot-checking; no independent verifier was run automatically.");
  try { sections.push((await readFile(join(dir, "ADJUDICATION.md"), "utf8")).trim()); } catch (e: any) { if (e.code !== "ENOENT") throw e; }
  sections.push("## Limitations", "Small, directional samples. Provider caches and changing documents can affect results. Model costs are list-price estimates, not proxy invoices. Unknown/failed calls are retained, and missing latencies are represented as zero elapsed only when no call was recorded. Clean-task findings are false positives under the frozen fixture truth; unmatched bug-task findings require manual adjudication. No reranker or embedding ablation is enabled. Absent cells mean not run, never a failure or success.");
  const md = sections.join("\n\n") + "\n";
  const htmlEscape = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  // Static, escaped preformatted Markdown preserves exactly the same tables, without a renderer dependency.
  await writeSafe(join(dir, "REPORT.md"), md);
  await writeSafe(join(dir, "report.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Search evaluation report</title><style>body{font:14px/1.5 monospace;margin:2rem}pre{white-space:pre;overflow:auto}</style><body><pre>${htmlEscape(md)}</pre></body></html>\n`);
  return {units: units.length, judgments: judgments.length};
}
