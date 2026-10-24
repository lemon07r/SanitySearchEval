// Aggregates committed run artifacts into site/data.json for the results page and README charts.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { readJSONL } from "../src/store";
import { percentile, wilson } from "../src/score";
import type { Unit } from "../src/types";

const RUNS = {
  pilot: "results/2026-10-19T07-49-42-905Z-pilot",
  retrieval: "results/2026-10-19T07-57-39-681Z-eval",
  agents: "results/2026-10-19T08-07-51-071Z-eval",
  confirmation: "results/2026-10-19T08-26-06-898Z-eval",
};
const POSTHOC_RUNS = {
  retrieval_same_day: "results/2026-10-24T10-41-00-663Z-eval",
  retrieval_exa_uncached: "results/2026-10-24T10-53-26-808Z-eval",
  revera: "results/2026-10-24T10-51-54-910Z-eval",
  opencode: "results/2026-10-24T10-57-52-872Z-eval",
};
type Arm = {arm: string; provider: string; profile: string};
const PROVIDERS = [
  {arm: "exa:auto", provider: "Exa", profile: "auto"},
  {arm: "parallel:fast", provider: "Parallel", profile: "fast"},
  {arm: "tavily:advanced", provider: "Tavily", profile: "advanced"},
  {arm: "brave:web", provider: "Brave", profile: "web"},
  {arm: "firecrawl:search", provider: "Firecrawl", profile: "search"},
  {arm: "none", provider: "No search", profile: "baseline"},
];
const round = (n: number | null, d = 4) => n === null ? null : Number(n.toFixed(d));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const est = (u: Unit, kind: "provider" | "model") => u.costs[kind]?.estimated_usd ?? 0;
const metered = (us: Unit[]) => us.every(u => u.costs.provider?.metered_usd != null) ? sum(us.map(u => u.costs.provider.metered_usd!)) : null;
const byArm = (us: Unit[], arm: string) => us.filter(u => u.arm === arm);
const units = async (run: string) => readJSONL<Unit>(`${run}/units.jsonl`);

const cases = JSON.parse(await readFile("cases/search-holdout.json", "utf8")).cases as any[];
const caseInfo = new Map(cases.map(c => [c.id, c]));
const retrievalUnits = await units(RUNS.retrieval);
const judgments = await readJSONL(`${RUNS.retrieval}/judgments.jsonl`);
const sliceOf = (id: string) => id.startsWith("r-") ? "revera" : "opencode";

function retrievalArm(p: Arm, sourceUnits: Unit[], sourceJudgments: any[] | null) {
  const us = byArm(sourceUnits, p.arm), n = us.length;
  const hit = (key: string, k?: number) => us.filter(u => k ? u.metrics[key]?.[k] : u.metrics[key]).length;
  const e5 = hit("evidence", 5), [lo, hi] = wilson(e5, n);
  const slice = (keep: (u: Unit) => boolean) => { const xs = us.filter(keep); return {n: xs.length, evidence1: xs.filter(u => u.metrics.evidence?.[1]).length, evidence5: xs.filter(u => u.metrics.evidence?.[5]).length, in_read: xs.filter(u => u.metrics.evidence_in_read).length}; };
  const errors: Record<string, number> = {}; for (const u of us) for (const c of u.metrics.error_classes ?? []) errors[c] = (errors[c] ?? 0) + 1;
  const js = sourceJudgments?.filter((j: any) => j.arm === p.arm) ?? [];
  const m = metered(us);
  return {
    ...p, n,
    url: {1: hit("url", 1), 3: hit("url", 3), 5: hit("url", 5)},
    evidence: {1: hit("evidence", 1), 3: hit("evidence", 3), 5: e5},
    evidence5_wilson: [round(lo, 3), round(hi, 3)],
    read_ok: hit("read_ok"), evidence_in_read: hit("evidence_in_read"),
    search_ms: {p50: round(percentile(us.map(u => u.metrics.search_ms ?? 0), .5), 0), p90: round(percentile(us.map(u => u.metrics.search_ms ?? 0), .9), 0)},
    total_ms: {p50: round(percentile(us.map(u => u.metrics.total_ms ?? 0), .5), 0), p90: round(percentile(us.map(u => u.metrics.total_ms ?? 0), .9), 0)},
    visible_tokens_p50: round(percentile(us.map(u => u.metrics.visible_tokens ?? 0), .5), 0),
    usd_per_query: round((m ?? sum(us.map(u => est(u, "provider")))) / n),
    usd_basis: m === null ? "estimate" : "metered",
    slices: {revera: slice(u => sliceOf(u.caseId) === "revera"), opencode: slice(u => sliceOf(u.caseId) === "opencode"), traps: slice(u => !!caseInfo.get(u.caseId)?.trap)},
    errors,
    judge: sourceJudgments === null ? null : {n: js.length, supported: js.filter((j: any) => j.judgment?.support === "supported").length, insufficient: js.filter((j: any) => j.judgment?.support === "insufficient").length, contradicted: js.filter((j: any) => j.judgment?.support === "contradicted").length},
  };
}
const retrieval = PROVIDERS.filter(p => p.arm !== "none").map(p => retrievalArm(p, retrievalUnits, judgments));

const retrievalCases = cases.map(c => ({
  id: c.id, slice: sliceOf(c.id), trap: !!c.trap, category: c.category, difficulty: c.difficulty, question: c.question,
  ranks: Object.fromEntries(PROVIDERS.filter(p => p.arm !== "none").map(p => {
    const u = retrievalUnits.find(x => x.caseId === c.id && x.arm === p.arm);
    return [p.arm, u ? {evidence_rank: u.metrics.evidence_rank ?? null, read_error: u.status === "error"} : null];
  })),
}));

const agentUnits = await units(RUNS.agents), confirmUnits = await units(RUNS.confirmation);
const tasks = await Promise.all(["rv-commander15-negate", "rv-got16-http2-agent", "rv-got16-migrate", "rv-ky2-migrate", "oc-ai7", "oc-execa10", "oc-ky2", "oc-ts7-config"].map(async id => {
  const t = JSON.parse(await readFile(`fixtures/${id}/task.json`, "utf8"));
  return {id, product: t.product, title: t.title, clean: !!t.clean};
}));
function aggregateAgentArm(us: Unit[], product: string, p: Arm) {
  const xs = us.filter(u => u.arm === p.arm && u.metrics.product === product), n = xs.length;
  const base = {...p, runs: n, model_usd_mean: round(sum(xs.map(u => est(u, "model"))) / n), search_usd_mean: round((metered(xs) ?? sum(xs.map(u => est(u, "provider")))) / n), search_usd_basis: metered(xs) === null || p.arm === "none" ? "estimate" : "metered", wall_s_mean: round(sum(xs.map(u => u.metrics.wall_ms ?? 0)) / n / 1000, 1), model_calls: sum(xs.map(u => u.metrics.model_calls ?? 0)), searches: sum(xs.map(u => u.metrics.search_count ?? 0)), reads: sum(xs.map(u => u.metrics.read_count ?? 0))};
  if (product === "revera") return {...base, bugs_found: sum(xs.map(u => u.metrics.matched_bug_ids?.length ?? 0)), bugs_available: sum(xs.map(u => u.metrics.bugs_available ?? 0)), strict_fps: sum(xs.map(u => u.metrics.false_positives?.length ?? 0)), uncertain: sum(xs.map(u => u.metrics.uncertain?.length ?? 0))};
  return {...base, all_pass: xs.filter(u => u.metrics.all_pass).length, tasks: n};
}
const agentArm = (us: Unit[], product: string) => PROVIDERS.map(p => aggregateAgentArm(us, product, p));
const outcome = (u: Unit) => u.metrics.product === "revera"
  ? {rep: u.rep, bugs_found: u.metrics.matched_bug_ids?.length ?? 0, bugs_available: u.metrics.bugs_available ?? 0, strict_fps: u.metrics.false_positives?.length ?? 0, uncertain: u.metrics.uncertain?.length ?? 0, reads: u.metrics.read_count ?? 0, searches: u.metrics.search_count ?? 0}
  : {rep: u.rep, all_pass: !!u.metrics.all_pass, tests_pass: u.metrics.hidden_tests?.pass ?? null, tests_total: u.metrics.hidden_tests?.total ?? null, searches: u.metrics.search_count ?? 0, reads: u.metrics.read_count ?? 0};
const agentMatrix = tasks.map(t => ({...t, arms: Object.fromEntries(PROVIDERS.map(p => [p.arm, [...agentUnits, ...confirmUnits].filter(u => u.caseId === t.id && u.arm === p.arm).sort((a, b) => a.rep - b.rep).map(outcome)]))}));

const allRuns = [RUNS.pilot, RUNS.retrieval, RUNS.agents, RUNS.confirmation];
const everyUnit = (await Promise.all(allRuns.map(units))).flat();
const superseded = await readJSONL<Unit>(`${RUNS.agents}/units.superseded-oc-ky2-redaction-bug.jsonl`);
const allJudgments = (await Promise.all([RUNS.pilot, RUNS.retrieval].map(r => readJSONL(`${r}/judgments.jsonl`)))).flat();
const agentModel = sum([...everyUnit, ...superseded].filter(u => u.suite === "agents").map(u => est(u, "model")));
const judgeModel = sum(allJudgments.map((j: any) => j.cost?.estimated_usd ?? 0));
const providerFees = sum([...everyUnit, ...superseded].map(u => est(u, "provider")));

const controlArms = new Set(PROVIDERS.filter(p => p.arm !== "none").map(p => p.arm));
const posthocFlags = (arm: string) => ({posthoc: !controlArms.has(arm), ...(controlArms.has(arm) ? {control: true} : {})});
const posthocArms = (us: Unit[]): Arm[] => [...new Set(us.map(u => u.arm))].sort().map(arm => {
  const [provider, profile] = arm.split(":");
  return {arm, provider: PROVIDERS.find(p => p.arm.split(":")[0] === provider)?.provider ?? provider, profile};
});
const posthocRetrieval = (us: Unit[]) => posthocArms(us).map(p => ({...retrievalArm(p, us, null), ...posthocFlags(p.arm)}));
const posthocAgents = (us: Unit[], product: string) => {
  const valid = us.filter(u => u.metrics.product === product);
  return posthocArms(valid).map(p => {
    const row = aggregateAgentArm(valid, product, p);
    return {...row, n: row.runs, ...posthocFlags(p.arm)};
  });
};
const sameDayUnits = (await units(POSTHOC_RUNS.retrieval_same_day)).filter(u => u.arm !== "exa:auto-objective");
const posthoc = {
  run_date: "2026-10-24",
  runs: POSTHOC_RUNS,
  notes: [
    "exa:auto-objective in the same-day run is void (Exa cache ignores objective); use the uncached pair",
    "OpenCode units of results/2026-10-24T10-51-54-910Z-eval are void (fixture deps missing); rerun in results/2026-10-24T10-57-52-872Z-eval",
    "No LLM judge on post-hoc runs",
  ],
  retrieval_same_day: posthocRetrieval(sameDayUnits).map(row => ({...row, ...(row.arm === "exa:auto" ? {latency_note: "about half of searches were Exa cache hits; use exa:auto-uncached for latency"} : {})})),
  retrieval_exa_uncached: posthocRetrieval(await units(POSTHOC_RUNS.retrieval_exa_uncached)),
  revera: posthocAgents(await units(POSTHOC_RUNS.revera), "revera"),
  opencode: posthocAgents(await units(POSTHOC_RUNS.opencode), "opencode"),
};

const data = {
  generated_from: RUNS,
  run_date: "2026-10-19",
  model: "Claude Opus 5.5 (adaptive thinking, medium effort)",
  blocked: [{arm: "brave:llm-context", reason: "OPTION_NOT_IN_PLAN on the key's Free AI plan"}],
  retrieval: {cases: cases.length, slices: {revera: retrievalCases.filter(c => c.slice === "revera").length, opencode: retrievalCases.filter(c => c.slice === "opencode").length, traps: retrievalCases.filter(c => c.trap).length}, profiles: retrieval, matrix: retrievalCases},
  revera: {quick_pass: agentArm(agentUnits, "revera"), pooled: agentArm([...agentUnits, ...confirmUnits], "revera")},
  opencode: {quick_pass: agentArm(agentUnits, "opencode"), pooled: agentArm([...agentUnits, ...confirmUnits], "opencode")},
  agent_matrix: agentMatrix,
  eval_cost: {provider_fees_usd: round(providerFees, 2), agent_model_usd: round(agentModel, 2), judge_model_usd: round(judgeModel, 2), model_basis: "Anthropic list-price estimate; proxy billing not visible"},
  posthoc,
};
await mkdir("site", {recursive: true});
await writeFile("site/data.json", JSON.stringify(data, null, 2) + "\n");
console.log("site/data.json written");
