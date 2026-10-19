// Deterministic, dependency-free README graphics. Source: site/data.json only.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

type Retrieval = {
  arm: string; provider: string; profile: string; n: number;
  evidence: { "1": number; "5": number };
  evidence5_wilson: [number, number];
  search_ms: { p50: number; p90: number };
  usd_per_query: number; usd_basis: "metered" | "estimate";
};
type ReviewOutcome = { bugs_found: number; bugs_available: number; strict_fps: number; uncertain: number };
type CodeOutcome = { all_pass: boolean; tests_pass: number; tests_total: number };
type Task = { id: string; product: "revera" | "opencode"; clean: boolean; arms: Record<string, (ReviewOutcome | CodeOutcome)[]> };
type Data = {
  run_date: string;
  retrieval: { profiles: Retrieval[] };
  revera: { pooled: ({ arm: string } & ReviewOutcome)[] };
  opencode: { quick_pass: { arm: string; all_pass: number; tasks: number }[] };
  agent_matrix: Task[];
};

const root = new URL("../", import.meta.url);
const data = JSON.parse(await readFile(new URL("site/data.json", root), "utf8")) as Data;
const providers = [
  { arm: "exa:auto", name: "Exa", profile: "auto", color: "#6366f1" },
  { arm: "parallel:fast", name: "Parallel", profile: "fast", color: "#06b6d4" },
  { arm: "tavily:advanced", name: "Tavily", profile: "advanced", color: "#10b981" },
  { arm: "brave:web", name: "Brave", profile: "web", color: "#f97316" },
  { arm: "firecrawl:search", name: "Firecrawl", profile: "search", color: "#f43f5e" },
  { arm: "none", name: "No search", profile: "baseline", color: "#9ca3af" },
];
function requireData(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Chart data missing or invalid: ${message}`);
}
const numeric = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
requireData(typeof data.run_date === "string", "run_date");
const retrieval = providers.slice(0, 5).map(p => {
  const row = data.retrieval.profiles.find(r => r.arm === p.arm);
  requireData(row, p.arm);
  requireData(numeric(row.n) && row.n > 0, `${p.arm} n`);
  requireData([row.evidence?.[1], row.evidence?.[5]].every(n => numeric(n) && n >= 0 && n <= row.n), `${p.arm} evidence`);
  requireData(row.evidence[1] <= row.evidence[5], `${p.arm} evidence order`);
  requireData(row.evidence5_wilson?.length === 2 && row.evidence5_wilson.every(n => numeric(n) && n >= 0 && n <= 1), `${p.arm} Wilson interval`);
  requireData(row.evidence5_wilson[0] <= row.evidence5_wilson[1], `${p.arm} Wilson order`);
  requireData(numeric(row.search_ms?.p50) && row.search_ms.p50 > 0 && numeric(row.search_ms.p90) && row.search_ms.p90 >= row.search_ms.p50, `${p.arm} latency`);
  requireData(numeric(row.usd_per_query) && row.usd_per_query >= 0 && ["metered", "estimate"].includes(row.usd_basis), `${p.arm} cost`);
  return { ...row, ...p };
}).sort((a, b) => b.evidence[5] - a.evidence[5] || b.evidence[1] - a.evidence[1] || a.arm.localeCompare(b.arm));
const n = retrieval[0]!.n;
requireData(retrieval.every(r => r.n === n), "shared retrieval denominator");
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const reviews = providers.map(p => {
  const row = data.revera.pooled.find(r => r.arm === p.arm);
  requireData(row && numeric(row.bugs_found) && numeric(row.bugs_available), `${p.arm} pooled review`);
  return row;
});
// Sum bug opportunities, not clean-control runs or provider-level percentages.
const searchReviews = reviews.filter(r => r.arm !== "none");
const searchFound = sum(searchReviews.map(r => r.bugs_found));
const searchAvailable = sum(searchReviews.map(r => r.bugs_available));
const noReview = reviews.find(r => r.arm === "none")!;
const quickCode = providers.map(p => {
  const row = data.opencode.quick_pass.find(r => r.arm === p.arm);
  requireData(row && numeric(row.all_pass) && numeric(row.tasks) && row.tasks > 0, `${p.arm} quick-pass coding`);
  return row;
});
const noCode = quickCode.find(r => r.arm === "none")!;
requireData(quickCode.every(r => r.tasks === noCode.tasks), "shared quick-pass task denominator");
const bestCode = quickCode.filter(r => r.arm !== "none").sort((a, b) => b.all_pass - a.all_pass || a.arm.localeCompare(b.arm))[0]!;
const bestCodeName = providers.find(p => p.arm === bestCode.arm)!.name;
const reviewTasks = data.agent_matrix.filter(t => t.product === "revera");
const codeTasks = data.agent_matrix.filter(t => t.product === "opencode");
requireData(reviewTasks.length === 4 && codeTasks.length === 4, "four tasks per agent grid");
for (const task of [...reviewTasks, ...codeTasks]) for (const p of providers) {
  const outcomes = task.arms[p.arm];
  requireData(outcomes?.length, `${task.id} / ${p.arm} runs`);
  for (const run of outcomes) {
    if (task.product === "revera") {
      const r = run as ReviewOutcome;
      requireData([r.bugs_found, r.bugs_available, r.strict_fps, r.uncertain].every(n => numeric(n) && n >= 0), `${task.id} review outcome`);
      requireData(r.bugs_available === (task.clean ? 0 : 1) && r.bugs_found <= r.bugs_available, `${task.id} bug opportunities`);
    } else {
      const r = run as CodeOutcome;
      requireData(typeof r.all_pass === "boolean" && numeric(r.tests_pass) && numeric(r.tests_total), `${task.id} hidden tests`);
    }
  }
}

const themes = {
  light: { bg: "#ffffff", panel: "#f6f8fa", border: "#d8dee4", grid: "#d8dee4", ink: "#1f2328", muted: "#59636e", track: "#eaeef2", good: "#15803d", bad: "#cf222e", amber: "#9a6700" },
  dark: { bg: "#0d1117", panel: "#161b22", border: "#30363d", grid: "#30363d", ink: "#f0f6fc", muted: "#a5afba", track: "#21262d", good: "#3fb950", bad: "#f85149", amber: "#d29922" },
};
type Theme = typeof themes.light;
type Attrs = Record<string, string | number>;
const xml = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
const attrs = (a: Attrs) => Object.entries(a).map(([k, v]) => `${k}="${xml(v)}"`).join(" ");
// Keep coordinates compact and stable; no dates or environment-dependent formatting.
const f = (v: number) => Number(v.toFixed(3));
class SVG {
  parts: string[] = [];
  constructor(readonly theme: Theme) {}
  add(s: string) { this.parts.push(s); }
  rect(x: number, y: number, width: number, height: number, fill: string, extra: Attrs = {}) {
    this.add(`<rect ${attrs({ x: f(x), y: f(y), width: f(width), height: f(height), fill, ...extra })}/>`);
  }
  line(x1: number, y1: number, x2: number, y2: number, stroke: string, extra: Attrs = {}) {
    this.add(`<line ${attrs({ x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2), stroke, ...extra })}/>`);
  }
  circle(cx: number, cy: number, r: number, fill: string, extra: Attrs = {}) {
    this.add(`<circle ${attrs({ cx: f(cx), cy: f(cy), r, fill, ...extra })}/>`);
  }
  text(x: number, y: number, label: string | number, size = 14, extra: Attrs = {}) {
    this.add(`<text ${attrs({ x: f(x), y: f(y), "font-size": size, fill: this.theme.ink, ...extra })}>${xml(label)}</text>`);
  }
  muted(x: number, y: number, label: string | number, size = 13, extra: Attrs = {}) {
    this.text(x, y, label, size, { fill: this.theme.muted, ...extra });
  }
  heading(title: string, subtitle: string) {
    this.text(30, 47, title, 24, { "font-weight": 700, "letter-spacing": "-0.4" });
    this.muted(30, 76, subtitle, 14);
  }
  render(name: string, title: string, description: string, height: number) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}" role="img" aria-labelledby="${name}-title ${name}-desc" font-family="Inter, -apple-system, Segoe UI, Helvetica, Arial, sans-serif">
<title id="${name}-title">${xml(title)}</title>
<desc id="${name}-desc">${xml(description)}</desc>
<rect x="0.5" y="0.5" width="999" height="${height - 1}" rx="20" fill="${this.theme.bg}" stroke="${this.theme.border}"/>
${this.parts.join("\n")}
</svg>\n`;
  }
}
const ratio = (a: number, b: number) => `${a}/${b}`;
const cost = (r: Retrieval) => `$${r.usd_per_query} ${r.usd_basis === "metered" ? "metered" : "est"}`;
const retrievalDescription = retrieval.map(r => `${r.name}: evidence@5 ${ratio(r.evidence[5], r.n)}, evidence@1 ${ratio(r.evidence[1], r.n)}`).join("; ");

function overview(s: SVG) {
  const t = s.theme;
  s.muted(30, 31, "SANITY SEARCH EVAL V2", 11, { "font-weight": 700, "letter-spacing": 1.6 });
  s.text(30, 65, "Three views. No blended score.", 30, { "font-weight": 750, "letter-spacing": "-0.7" });
  s.muted(30, 90, "Five search APIs, a no-search baseline, and two very different agent tasks.", 14);
  for (const x of [24, 346, 668]) s.rect(x, 112, 308, 244, t.panel, { rx: 13, stroke: t.border });
  s.text(42, 141, "REVERA", 11, { "font-weight": 700, "letter-spacing": 1.4, fill: t.muted });
  s.text(42, 169, "Search finds", 21, { "font-weight": 700 });
  s.text(42, 194, "breaking-change bugs", 21, { "font-weight": 700 });
  s.muted(42, 228, "Search", 12);
  s.muted(202, 228, "No search", 12);
  s.text(42, 269, ratio(searchFound, searchAvailable), 39, { "font-weight": 750, fill: t.good });
  s.muted(171, 261, "vs", 13);
  s.text(202, 269, ratio(noReview.bugs_found, noReview.bugs_available), 39, { "font-weight": 750 });
  s.muted(42, 322, "Pooled · known-bug task runs", 13);
  s.text(364, 141, "OPENCODE", 11, { "font-weight": 700, "letter-spacing": 1.4, fill: t.muted });
  s.text(364, 169, `No gain on ${noCode.tasks} tasks`, 21, { "font-weight": 700 });
  s.muted(364, 228, "No search", 12);
  s.muted(524, 228, `Best search (${bestCodeName})`, 12);
  s.text(364, 269, ratio(noCode.all_pass, noCode.tasks), 39, { "font-weight": 750 });
  s.muted(493, 261, "vs", 13);
  s.text(524, 269, ratio(bestCode.all_pass, bestCode.tasks), 39, { "font-weight": 750 });
  s.muted(364, 322, "Quick pass · hidden tests all pass", 13);
  s.text(686, 141, "RETRIEVAL", 11, { "font-weight": 700, "letter-spacing": 1.4, fill: t.muted });
  s.text(686, 169, `Evidence@5 out of ${n}`, 21, { "font-weight": 700 });
  retrieval.forEach((r, i) => {
    const y = 202 + i * 28;
    s.text(686, y + 5, r.name, 12);
    s.rect(765, y - 7, 143, 12, t.track, { rx: 4 });
    s.rect(765, y - 7, 143 * r.evidence[5] / r.n, 12, r.color, { rx: 4 });
    s.text(956, y + 5, ratio(r.evidence[5], r.n), 13, { "font-weight": 650, "text-anchor": "end" });
  });
  s.muted(30, 386, `Run ${data.run_date} · small samples, directional · no blended score`, 13);
  return s.render("overview", "Search API evaluation: three separate views", `Revera search ${ratio(searchFound, searchAvailable)} versus no search ${ratio(noReview.bugs_found, noReview.bugs_available)} bug-task runs. OpenCode quick pass: no search ${ratio(noCode.all_pass, noCode.tasks)}, best search ${ratio(bestCode.all_pass, bestCode.tasks)}. ${retrievalDescription}.`, 410);
}

function retrievalChart(s: SVG) {
  const t = s.theme, x0 = 214, width = 626, x = (value: number) => x0 + value / n * width;
  s.heading(`Retrieval: gold evidence in top results (${n} held-out questions)`, "Same questions, frozen profiles · sorted by evidence@5, then evidence@1");
  s.rect(31, 97, 28, 12, t.muted, { rx: 3 });
  s.muted(68, 108, "Evidence@5", 12);
  s.rect(190, 97, 28, 12, t.muted, { rx: 3 });
  s.rect(190, 100, 21, 6, "#ffffff", { opacity: 0.65, rx: 2 });
  s.muted(227, 108, "Evidence@1 (light inset)", 12);
  s.line(443, 103, 475, 103, t.ink, { "stroke-width": 1.5 });
  for (const x of [443, 475]) s.line(x, 99, x, 107, t.ink, { "stroke-width": 1.5 });
  s.muted(485, 108, "95% Wilson interval for evidence@5", 12);
  for (const value of [0, n / 4, n / 2, 3 * n / 4, n]) {
    s.muted(x(value), 143, value, 12, { "text-anchor": "middle" });
    s.line(x(value), 152, x(value), 507, t.grid, { "stroke-dasharray": "3 5" });
  }
  retrieval.forEach((r, i) => {
    const y = 177 + i * 70;
    s.circle(38, y + 7, 4, r.color);
    s.text(51, y + 12, r.name, 16, { "font-weight": 650 });
    s.muted(51, y + 33, r.profile, 12);
    s.rect(x0, y, width, 18, t.track, { rx: 5 });
    s.rect(x0, y, x(r.evidence[5]) - x0, 18, r.color, { rx: 5 });
    s.rect(x0, y + 6, x(r.evidence[1]) - x0, 6, "#ffffff", { opacity: 0.65, rx: 2 });
    // Stored Wilson bounds are fractions; map them onto the count axis, without recomputing.
    const [lo, hi] = r.evidence5_wilson.map(bound => x(bound * r.n));
    s.line(lo!, y + 32, hi!, y + 32, t.ink, { "stroke-width": 1.5 });
    for (const end of [lo!, hi!]) s.line(end, y + 27, end, y + 37, t.ink, { "stroke-width": 1.5 });
    s.circle(x(r.evidence[5]), y + 32, 3, t.ink);
    s.text(958, y + 14, ratio(r.evidence[5], r.n), 18, { "font-weight": 700, "text-anchor": "end" });
    s.muted(958, y + 36, `@1: ${ratio(r.evidence[1], r.n)}`, 12, { "text-anchor": "end" });
  });
  s.muted(30, 551, "Evidence = a gold-fact match in provider-returned text; not a URL-only hit or an agent outcome.", 13);
  return s.render("retrieval", `Retrieval: gold evidence in top results (${n} held-out questions)`, `${retrievalDescription}. Whiskers show the stored 95% Wilson intervals for evidence@5.`, 578);
}

function speedChart(s: SVG) {
  const t = s.theme, left = 104, right = 920, top = 164, bottom = 482;
  const minSeconds = 0.3, maxSeconds = 10;
  const x = (ms: number) => left + Math.log((ms / 1000) / minSeconds) / Math.log(maxSeconds / minSeconds) * (right - left);
  const y = (evidence: number) => bottom - (evidence - n / 2) / (n / 2) * (bottom - top);
  requireData(retrieval.every(r => r.search_ms.p50 / 1000 >= minSeconds && r.search_ms.p90 / 1000 <= maxSeconds && r.evidence[5] >= n / 2), "scatter plotting bounds");
  s.heading("Search speed vs. evidence coverage", "Labels include USD/query · metered or est (estimate) · search latency only");
  s.line(31, 101, 81, 101, t.muted, { "stroke-width": 3 });
  s.circle(31, 101, 5, t.muted);
  s.line(81, 96, 81, 106, t.muted, { "stroke-width": 1.5 });
  s.muted(94, 106, "Point: p50 · line: p50 to p90 (not a confidence interval)", 12);
  s.rect(left, top, right - left, bottom - top, t.panel, { rx: 6 });
  for (const value of [n / 2, 2 * n / 3, 5 * n / 6, n]) {
    s.line(left, y(value), right, y(value), t.grid);
    s.muted(left - 14, y(value) + 4, value, 12, { "text-anchor": "end" });
  }
  for (const seconds of [0.3, 0.5, 1, 2, 5, 10]) {
    s.line(x(seconds * 1000), top, x(seconds * 1000), bottom, t.grid, { "stroke-dasharray": "3 5" });
    s.muted(x(seconds * 1000), bottom + 24, `${seconds} s`, 12, { "text-anchor": "middle" });
  }
  s.muted(31, 145, `Evidence@5 / ${n}`, 12);
  s.muted((left + right) / 2, 539, "Search latency · log scale · lower is faster", 14, { "text-anchor": "middle" });
  const offsets: Record<string, [number, number]> = {
    "exa:auto": [-15, -33], "parallel:fast": [-25, -33], "tavily:advanced": [6, 31],
    "brave:web": [-66, 37], "firecrawl:search": [21, 25],
  };
  for (const r of retrieval) {
    const px = x(r.search_ms.p50), p90x = x(r.search_ms.p90), py = y(r.evidence[5]);
    s.line(px, py, p90x, py, r.color, { "stroke-width": 4, "stroke-linecap": "round", opacity: 0.7 });
    s.line(p90x, py - 6, p90x, py + 6, r.color, { "stroke-width": 2 });
    s.circle(px, py, 7, r.color, { stroke: t.bg, "stroke-width": 2 });
    const [dx, dy] = offsets[r.arm]!;
    s.text(px + dx, py + dy, r.name, 16, { "font-weight": 700 });
    s.muted(px + dx, py + dy + 18, cost(r), 12);
  }
  s.muted(30, 581, `Evidence axis starts at ${n / 2}/${n}. Read latency and agent time are excluded.`, 13);
  return s.render("speed-vs-evidence", "Search speed vs. evidence coverage", retrieval.map(r => `${r.name}: p50 ${r.search_ms.p50 / 1000} seconds, p90 ${r.search_ms.p90 / 1000} seconds, evidence@5 ${ratio(r.evidence[5], r.n)}, ${cost(r)} per query`).join("; "), 608);
}

type State = "found" | "missed" | "clean" | "strict" | "pass" | "fail";
function marker(s: SVG, cx: number, cy: number, state: State, uncertain = false, description = state as string) {
  const t = s.theme, good = state === "found" || state === "pass", bad = state === "missed" || state === "fail";
  s.add(`<g><title>${xml(description + (uncertain ? "; uncertain comment also present" : ""))}</title>`);
  if (state === "strict") {
    s.add(`<path d="M ${cx} ${cy - 11} L ${cx + 11} ${cy} L ${cx} ${cy + 11} L ${cx - 11} ${cy} Z" fill="${t.amber}"/>`);
    s.text(cx, cy + 4, "!", 13, { fill: t.bg, "font-weight": 800, "text-anchor": "middle" });
  } else {
    s.circle(cx, cy, 9, good ? t.good : t.panel, { stroke: good ? t.good : bad ? t.bad : t.muted, "stroke-width": 1.8 });
    if (good) s.add(`<path d="M ${cx - 4} ${cy} l 3 3 l 5 -6" fill="none" stroke="${t.bg}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`);
    else if (bad) {
      s.line(cx - 3, cy - 3, cx + 3, cy + 3, t.bad, { "stroke-width": 1.8 });
      s.line(cx - 3, cy + 3, cx + 3, cy - 3, t.bad, { "stroke-width": 1.8 });
    } else s.line(cx - 3, cy, cx + 3, cy, t.muted, { "stroke-width": 1.8 });
  }
  if (uncertain) s.circle(cx + 10, cy - 10, 4, t.amber, { stroke: t.bg, "stroke-width": 1.2 });
  s.add("</g>");
}
function agentChart(s: SVG, product: "revera" | "opencode") {
  const t = s.theme, review = product === "revera", tasks = review ? reviewTasks : codeTasks;
  const title = review ? "Revera: review outcomes by task" : "OpenCode: hidden-test outcomes by task";
  s.heading(title, "Quick pass + confirmation reps · one marker per run, in source order · unequal repetitions");
  s.text(42, 127, "Task", 14, { "font-weight": 650 });
  s.muted(42, 147, review ? "Known bug or clean control" : "All hidden tests must pass", 12);
  providers.forEach((p, i) => {
    const cx = 343 + i * 114;
    s.rect(cx - 22, 99, 44, 3, p.color, { rx: 1.5 });
    s.text(cx, 127, p.name, 14, { "text-anchor": "middle", "font-weight": 650 });
    s.muted(cx, 147, p.profile, 12, { "text-anchor": "middle" });
  });
  tasks.forEach((task, row) => {
    const top = 166 + row * 78, cy = top + 39;
    s.rect(30, top, 940, 76, row % 2 === 0 ? t.panel : t.bg, { rx: 8 });
    s.text(42, cy + (review ? -2 : 5), task.id, 14, { "font-weight": 600 });
    if (review) s.muted(42, cy + 19, task.clean ? "Clean control" : "Known bug", 12);
    providers.forEach((p, col) => {
      const cx = 343 + col * 114, outcomes = task.arms[p.arm]!;
      s.line(cx - 57, top + 9, cx - 57, top + 67, t.grid);
      outcomes.forEach((outcome, index) => {
        const x = cx + (index - (outcomes.length - 1) / 2) * 27;
        requireData(outcomes.length <= 3, `${task.id} cell capacity`);
        if (review) {
          const r = outcome as ReviewOutcome;
          const state = task.clean ? r.strict_fps > 0 ? "strict" : "clean" : r.bugs_found === r.bugs_available ? "found" : "missed";
          marker(s, x, cy, state, r.uncertain > 0, `${task.id}, ${p.name}, run ${index + 1}: ${state}; bugs ${ratio(r.bugs_found, r.bugs_available)}, strict findings ${r.strict_fps}, uncertain ${r.uncertain}`);
        } else {
          const r = outcome as CodeOutcome;
          marker(s, x, cy, r.all_pass ? "pass" : "fail", false, `${task.id}, ${p.name}, run ${index + 1}: ${r.all_pass ? "pass" : "fail"}, hidden tests ${ratio(r.tests_pass, r.tests_total)}`);
        }
      });
    });
  });
  if (review) {
    const legend: [number, State, string][] = [[42, "found", "Bug found"], [210, "missed", "Bug missed"], [385, "clean", "Clean, no finding"], [626, "strict", "Strict clean-control finding"]];
    for (const [x, state, label] of legend) {
      marker(s, x, 515, state);
      s.muted(x + 18, 520, label, 13);
    }
    s.circle(42, 550, 4, t.amber);
    s.muted(60, 555, "Small amber dot: an uncertain comment was also present (not a strict finding).", 13);
    s.muted(30, 597, "Strict findings on rv-got16-migrate were the same correct-premise comment;", 13);
    s.muted(30, 618, "adjudicated not a hallucination.", 13);
  } else {
    marker(s, 42, 515, "pass"); s.muted(60, 520, "All hidden tests pass", 13);
    marker(s, 270, 515, "fail"); s.muted(288, 520, "At least one hidden test fails", 13);
    s.muted(30, 563, "All misses were oc-ai7 (one tsc generic-type error)", 13);
  }
  const description = tasks.map(task => `${task.id}: ${providers.map(p => `${p.name} ${task.arms[p.arm]!.map(r => review ? task.clean ? (r as ReviewOutcome).strict_fps > 0 ? "strict finding" : "clean" : (r as ReviewOutcome).bugs_found > 0 ? "bug found" : "bug missed" : (r as CodeOutcome).all_pass ? "pass" : "fail").join(", ")}`).join("; ")}`).join(". ");
  return s.render(product, title, `${description}. ${review ? "Amber dots mark additional uncertain comments. Strict clean-control findings were adjudicated not hallucinations." : "All misses were oc-ai7 (one tsc generic-type error)."}`, review ? 650 : 594);
}

const charts = [
  ["overview", overview], ["retrieval", retrievalChart], ["speed-vs-evidence", speedChart],
  ["revera", (s: SVG) => agentChart(s, "revera")], ["opencode", (s: SVG) => agentChart(s, "opencode")],
] as const;
const out = new URL("docs/img/", root);
await mkdir(out, { recursive: true });
for (const [name, draw] of charts) for (const variant of ["light", "dark"] as const) {
  const target = new URL(`${name}-${variant}.svg`, out);
  await writeFile(target, draw(new SVG(themes[variant])));
  console.log(fileURLToPath(target));
}
