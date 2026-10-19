import { readFile, mkdir, rm, stat } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import { ENV_NAMES, loadEnv, providerKey, modelEnv } from "./env";
import { PROFILES, LIMITS, PRICES, PROVIDER_LIMITS, unknownCost } from "./config";
import { log } from "./redact";
import { createAdapter } from "./providers";
import { ToolSession } from "./tools";
import { scoreSearch, scoreReview } from "./score";
import { sha256, Store, writeJSON, readJSONL } from "./store";
import { Budget, assertBudget, estimateUnit, accountedCost } from "./budget";
import { report } from "./report";
import { judge, shuffle } from "./judge";
import { truthCheck } from "./truth-check";
import { modelCall, MODEL_SETTINGS } from "./llm";
import { PROMPT_VERSION, REVIEW_PROMPT, CODE_PROMPT, JUDGE_PROMPT } from "./prompts";
import { prepareWorkspace } from "./workspace";
import { runAgent } from "./agent";
import { tokens } from "./trim";
import type { Profile, SearchCase, Task, Unit } from "./types";
export interface Flags { [key: string]: string | boolean | undefined }
const BOOL = new Set(["dry-run","no-network","no-judge","yes","keep-work","help"]);
const VALUE = new Set(["suite","providers","profiles","limit","concurrency","max-cost-usd","max-minutes","resume","seed","reps","run","cases"]);
export function parseArgs(argv: string[]) { const args = argv.filter(x => x !== "--"); const command = args.shift() ?? "help"; const flags: Flags = {}; for (let i = 0; i < args.length; i++) { const [raw, ...rest] = args[i].split("="); const key = raw.replace(/^--/,""); if (!raw.startsWith("--") || !BOOL.has(key) && !VALUE.has(key)) throw Error(`Unknown flag ${raw}`); if (BOOL.has(key)) { if (rest.length) throw Error(`${raw} takes no value`); flags[key] = true; } else { const value = rest.length ? rest.join("=") : args[++i]; if (!value || value.startsWith("--")) throw Error(`Missing value for ${raw}`); flags[key] = value; } } return {command,flags}; }
function num(flags: Flags, key: string, fallback: number, integer = false) { const n = flags[key] === undefined ? fallback : Number(flags[key]); if (!Number.isFinite(n) || n < 0 || integer && (!Number.isInteger(n) || n < 1)) throw Error(`Invalid --${key}`); return n; }
function runDir(input: string) { const path = resolve(input.startsWith("results/") ? input : join("results",input)); const root = resolve("results"); if (!path.startsWith(root + "/") || path === root) throw Error("Run must be under results/"); return path; }
async function json(path: string) { return JSON.parse(await readFile(path,"utf8")); }
export function agentEntries(listing: any): {id:string; product?:"revera"|"opencode"; fixture_dir:string}[] {
  const entries = Array.isArray(listing) ? listing : Array.isArray(listing?.tasks) && (listing.version === undefined || listing.version === 1) ? listing.tasks.map((id:string)=>({id,fixture_dir:join("fixtures",id)})) : null;
  if (!entries) throw Error("Invalid agent task listing");
  const ids = new Set<string>();
  return entries.map((entry:any) => {
    if (!entry || typeof entry.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(entry.id) || ids.has(entry.id) || typeof entry.fixture_dir !== "string" || entry.product !== undefined && !["revera","opencode"].includes(entry.product)) throw Error("Invalid/duplicate agent task entry");
    ids.add(entry.id);
    const fixture = resolve(entry.fixture_dir), root = resolve("fixtures");
    if (!fixture.startsWith(root+"/")) throw Error("Fixture directory must be under fixtures/");
    return {...entry,fixture_dir:entry.fixture_dir};
  });
}
async function casesAt(path: string, limit: number) {
  const file = await json(path); if (file.version !== 1 || !Array.isArray(file.cases)) throw Error(`Invalid case file ${path}`);
  const ids = new Set<string>(); for (const c of file.cases as SearchCase[]) { if (!c.id || c.id.includes("|") || ids.has(c.id) || !c.query || !c.question || !Array.isArray(c.gold_facts) || !Array.isArray(c.acceptable_sources)) throw Error(`Invalid/duplicate case in ${path}`); ids.add(c.id); for (const f of c.gold_facts) for (const group of f.patterns) for (const p of group) new RegExp(p,"i"); }
  return (file.cases as SearchCase[]).slice(0,limit);
}
export async function selectedProfiles(command: string, flags: Flags): Promise<Profile[]> {
  let profiles = PROFILES;
  if (command === "eval") {
    let frozen: any; try { frozen = await json("config/frozen-profiles.json"); } catch { throw Error("eval requires config/frozen-profiles.json from the completed pilot"); }
    const providers = ["brave","exa","parallel","firecrawl","tavily"];
    for (const provider of providers) if (!PROFILES.some(p => p.provider === provider && p.id === frozen[provider])) throw Error(`Invalid frozen profile for ${provider}`);
    profiles = PROFILES.filter(p => frozen[p.provider] === p.id);
  }
  if (flags.profiles) { const ids = String(flags.profiles).split(","); for (const id of ids) if (!PROFILES.some(p => p.id === id)) throw Error(`Unknown profile ${id}`); profiles = PROFILES.filter(p => ids.includes(p.id)); }
  if (flags.providers) { const ids = String(flags.providers).split(","); for (const id of ids) if (id !== "none" && !PROFILES.some(p => p.id === id || p.provider === id)) throw Error(`Unknown provider/profile ${id}`); profiles = profiles.filter(p => ids.some(id => id === p.id || id === p.provider)); }
  return profiles;
}
type Plan = {suite:"search"|"agents"; caseId:string; arm:string; rep:number; profile?:Profile; c?:SearchCase; task?:Task; fixture?:string; estimate:number; key:string};
function interleave(items: Plan[], seed: number) { const arms = shuffle([...new Set(items.map(p => p.arm))],seed); const queues = arms.map((arm,i) => shuffle(items.filter(p => p.arm === arm),seed+i+1)); const out: Plan[] = []; while (queues.some(q => q.length)) for (const q of queues) { const p = q.shift(); if (p) out.push(p); } return out; }
async function versions() { const pkg = await json("package.json"); const packages: Record<string,string> = {}; for (const name of Object.keys({...pkg.dependencies,...pkg.devDependencies})) { try { packages[name] = (await json(join("node_modules",name,"package.json"))).version; } catch { packages[name] = "not installed"; } } return {bun:Bun.version,packages}; }
export async function runEvaluation(command: "pilot"|"eval", flags: Flags) {
  const suite = command === "pilot" ? "search" : String(flags.suite ?? "all"); if (!["search","agents","all"].includes(suite)) throw Error("--suite must be search|agents|all");
  const limit = num(flags,"limit",Number.MAX_SAFE_INTEGER,true), reps = num(flags,"reps",1,true), seed = num(flags,"seed",42), concurrency = num(flags,"concurrency",LIMITS.concurrency,true), cap = num(flags,"max-cost-usd",LIMITS.max_cost_usd), minutes = num(flags,"max-minutes",LIMITS.max_minutes);
  if (minutes <= 0) throw Error("--max-minutes must be positive");
  const requestedProfiles = await selectedProfiles(command,flags), profiles = requestedProfiles.filter(p=>!p.blocked_reason); const cases: SearchCase[] = []; const tasks: {task:Task; fixture:string}[] = []; const files: {path:string;sha256:string}[] = [];
  const addFile = async (path:string) => { files.push({path,sha256:sha256(await readFile(path))}); };
  if (suite !== "agents") { const path = String(flags.cases ?? (command === "pilot" ? "cases/pilot.json" : "cases/search-holdout.json")); cases.push(...await casesAt(path,limit)); await addFile(path); }
  if (suite !== "search") { const path = String(suite === "agents" && flags.cases ? flags.cases : "cases/agent-holdout.json"); const entries = agentEntries(await json(path)); await addFile(path); for (const entry of entries.slice(0,limit)) { const fixture = entry.fixture_dir, task = await json(join(fixture,"task.json")) as Task; if (task.id !== entry.id || !["revera","opencode"].includes(task.product) || entry.product && task.product !== entry.product || typeof task.prompt !== "string") throw Error(`Invalid fixture task ${entry.id}`); tasks.push({task,fixture}); await addFile(join(fixture,"task.json")); } }
  const blockedProfiles = requestedProfiles.filter(p=>p.blocked_reason).map(p=>({id:p.id,reason:p.blocked_reason,skipped_units:(cases.length+tasks.length)*reps}));
  const plans: Plan[] = [];
  const includeNone = flags.providers ? String(flags.providers).split(",").includes("none") : !flags.profiles;
  for (let rep = 1; rep <= reps; rep++) {
    for (const c of cases) for (const profile of profiles) plans.push({suite:"search",caseId:c.id,arm:profile.id,rep,profile,c,key:`search|${c.id}|${profile.id}|rep${rep}`,estimate:estimateUnit(profile)});
    for (const {task,fixture} of tasks) for (const profile of [...profiles,...(includeNone ? [undefined] : [])]) { const arm = profile?.id ?? "none"; plans.push({suite:"agents",caseId:task.id,arm,rep,profile,task,fixture,key:`agents|${task.id}|${arm}|rep${rep}`,estimate:estimateUnit(profile,task.product)}); }
  }
  if (!plans.length && !blockedProfiles.length) throw Error("Empty call matrix");
  const signature = sha256(JSON.stringify({command,suite,seed,reps,profiles:requestedProfiles,files,keys:plans.map(p=>p.key),limits:LIMITS,provider_limits:PROVIDER_LIMITS,models:{agent:modelEnv("agent").model,judge:modelEnv("judge").model},prompts:[REVIEW_PROMPT,CODE_PROMPT,JUDGE_PROMPT]}));
  const runId = flags.resume ? basename(String(flags.resume)) : `${new Date().toISOString().replace(/[:.]/g,"-")}-${command}`;
  const dir = flags.resume ? runDir(String(flags.resume)) : runDir(runId);
  const existing = flags.resume ? await readJSONL<Unit>(join(dir,"units.jsonl")) : [];
  if (flags.resume) { const manifest = await json(join(dir,"manifest.json")); if (manifest.signature !== signature) throw Error("Resume inputs differ from saved manifest (cases/profiles/prompts/models/seed/reps); use the original flags"); }
  const completed = new Set(existing.map(u=>u.key)); const pending = interleave(plans.filter(p=>!completed.has(p.key)),seed);
  const judgeEnv = modelEnv("judge"), autoJudge = !flags["no-judge"] && !!judgeEnv.key && !!judgeEnv.base && !!judgeEnv.model;
  const oldJudgments = flags.resume ? await readJSONL(join(dir,"judgments.jsonl")) : [];
  const judged = new Set(oldJudgments.map(j=>j.key));
  const estimate = pending.reduce((s,p)=>s+p.estimate,0) + (autoJudge ? plans.filter(p=>p.suite === "search" && !judged.has(p.key)).length*.052 : 0);
  log("Suite\tArm\tPending units\tSearch/read calls (max)\tEstimated USD");
  for (const blocked of blockedProfiles) log(`${suite}\t${blocked.id}\tBLOCKED (${blocked.skipped_units} units skipped)\tno calls\tunknown\t${blocked.reason}`);
  for (const arm of [...new Set(pending.map(p=>p.arm))].sort()) { for (const s of ["search","agents"] as const) { const ps = pending.filter(p=>p.arm===arm && p.suite===s); if (ps.length) log(`${s}\t${arm}\t${ps.length}\t${ps.length*(arm==="none"?0:s==="search"?1:2)} / ${ps.length*(arm==="none"?0:s==="search"?1:2)}\t${ps.reduce((a,b)=>a+b.estimate,0).toFixed(4)}`); } }
  log(`Estimated remaining spend: $${estimate.toFixed(4)} (including optional judge: ${autoJudge}); completed units skipped: ${completed.size}. Planning estimate is not a guaranteed upper bound.`);
  const previousSpent = existing.reduce((s,u)=>s+accountedCost([u.costs.provider,...(u.costs.model?[u.costs.model]:[])],plans.find(p=>p.key===u.key)?.estimate ?? 0),0) + oldJudgments.reduce((s,j)=>s+accountedCost([j.cost ?? unknownCost()],.052),0);
  assertBudget(previousSpent+estimate,cap);
  if (flags["dry-run"]) { log("Dry run: no network requests or run artifacts created."); return; }
  if (tasks.length) { const model = modelEnv("agent"); if (!model.key || !model.base || !model.model) throw Error("Agent evaluation blocked: missing model configuration"); }
  const store = new Store(dir); await store.init(); const budget = new Budget(cap,minutes); budget.spent = previousSpent;
  let manifest: any = flags.resume ? await json(join(dir,"manifest.json")) : {run_id:runId,command,signature,cli_args:process.argv.slice(2),seed,profiles:requestedProfiles,blocked_profiles:blockedProfiles,limits:LIMITS,provider_limits:PROVIDER_LIMITS,prices:PRICES,model_settings:MODEL_SETTINGS,models:{agent:{base:modelEnv("agent").base?"<private endpoint>":null,model:modelEnv("agent").model},judge:{base:judgeEnv.base?"<private endpoint>":null,model:judgeEnv.model}},prompts:{version:PROMPT_VERSION,revera:{text:REVIEW_PROMPT,sha256:sha256(REVIEW_PROMPT)},opencode:{text:CODE_PROMPT,sha256:sha256(CODE_PROMPT)},judge:{text:JUDGE_PROMPT,sha256:sha256(JUDGE_PROMPT)}},case_files:files,versions:await versions(),start_time:new Date().toISOString(),end_time:null,estimated_remaining_usd:estimate};
  manifest.resume_history ??= []; if (flags.resume) manifest.resume_history.push({at:new Date().toISOString(),args:process.argv.slice(2)});
  await writeJSON(join(dir,"manifest.json"),manifest);
  let next = 0;
  const worker = async () => {
    while (next < pending.length) {
      const plan = pending[next]; if (!budget.canStart(plan.estimate)) break; next++;
      const started_at = new Date().toISOString(), start = performance.now(); const session = plan.profile ? new ToolSession(createAdapter(plan.profile)) : undefined;
      const work = join(dir,"work",sha256(plan.key)); let unit: Unit; let privateData: any;
      try {
        if (plan.suite === "search") {
          const search = await session!.web_search({query:plan.c!.query,purpose:plan.c!.question}); const read = search.results[0] ? await session!.web_read({result_id:search.results[0].id}) : undefined;
          const error = search.error ?? read?.error; const search_ms = session!.trace.find(t=>t.kind === "search")?.outcome.ms ?? 0, read_ms = session!.trace.find(t=>t.kind === "read")?.outcome.ms ?? 0;
          unit = {key:plan.key,suite:plan.suite,caseId:plan.caseId,arm:plan.arm,rep:plan.rep,status:error?"error":"ok",started_at,ended_at:new Date().toISOString(),error,metrics:{...scoreSearch(plan.c!,search,read),search_ms,read_ms,total_ms:search_ms+read_ms,wall_ms:performance.now()-start,visible_tokens:tokens(JSON.stringify(search))+(read?tokens(JSON.stringify(read)):0),search_visible_tokens:tokens(JSON.stringify(search)),read_visible_tokens:read?tokens(JSON.stringify(read)):0,result_sizes:search.results.map(r=>({id:r.id,raw_chars:r.raw_chars,visible_chars:r.visible_chars})),read_sizes:read?{raw_chars:read.raw_chars,visible_chars:read.visible_chars}:null,error_classes:[...new Set([search.error?.class,read?.error?.class].filter(Boolean))],results:search.results.map(r=>({id:r.id,url:r.url,published_at:r.published_at,source:r.source}))},costs:{provider:session!.cost},requests:session!.requests,urls:session!.urls}; privateData = {trace:session!.trace};
        } else {
          const hashes = await prepareWorkspace(plan.fixture!,work,plan.task!); const result = await runAgent(plan.task!,plan.fixture!,work,hashes,session);
          const error = ["error","timeout"].includes(result.metrics.completion) ? {class:result.metrics.completion === "timeout" ? "timeout" as const : "parse" as const,message:result.metrics.failure ?? result.metrics.completion} : undefined;
          unit = {key:plan.key,suite:plan.suite,caseId:plan.caseId,arm:plan.arm,rep:plan.rep,status:error?"error":"ok",started_at,ended_at:new Date().toISOString(),error,metrics:result.metrics,costs:{provider:session?.cost ?? {estimated_usd:0,metered_usd:0,basis:"no-search arm"},model:result.model_cost},requests:session?.requests ?? [],urls:session?.urls ?? []}; privateData = {...result.private,trace:session?.trace ?? []};
        }
      } catch (e: any) {
        unit = {key:plan.key,suite:plan.suite,caseId:plan.caseId,arm:plan.arm,rep:plan.rep,status:"error",started_at,ended_at:new Date().toISOString(),error:{class:"parse",message:e.message},metrics:plan.c ? {...scoreSearch(plan.c),search_ms:0,read_ms:0,total_ms:performance.now()-start,visible_tokens:0} : {product:plan.task!.product,...(plan.task!.product==="revera"?scoreReview(plan.task!,[]):{all_pass:false,hidden_tests:null,violations:[]}),completion:"error",wall_ms:performance.now()-start},costs:{provider:session?.cost ?? unknownCost("Unit failed"),...(plan.task?{model:unknownCost("Unit failed before model accounting")}: {})},requests:session?.requests ?? [],urls:session?.urls ?? []}; privateData = {error:e.message,trace:session?.trace ?? []};
      }
      await store.complete(unit,privateData); budget.finish(plan.estimate,[unit.costs.provider,...(unit.costs.model?[unit.costs.model]:[])]);
      if (!flags["keep-work"] && plan.task) await rm(work,{recursive:true,force:true});
      log(`${unit.key}\t${unit.status}\t${Math.round(performance.now()-start)} ms`);
    }
  };
  try { await Promise.all(Array.from({length:concurrency},worker)); if (autoJudge && cases.length && !budget.stop_reason) await judge(dir,cases,seed,budget); }
  finally { manifest.end_time=new Date().toISOString(); manifest.stop_reason=budget.stop_reason; manifest.completed_units=store.completed.size; manifest.planned_units=plans.length; manifest.accounted_spend_usd=budget.spent; await writeJSON(join(dir,"manifest.json"),manifest); }
  await report(dir); log(`Saved ${dir}; stop reason: ${budget.stop_reason ?? "matrix completed"}`);
}
export async function doctor(flags: Flags) {
  log("Environment (presence only)"); for (const name of ENV_NAMES) log(`${name}\t${process.env[name]?"present":"missing"}`);
  if (flags["no-network"]) return;
  const dir = runDir(`${new Date().toISOString().replace(/[:.]/g,"-")}-doctor`); await mkdir(join(dir,"private"),{recursive:true,mode:0o700});
  const rows: any[] = []; let failed = false;
  const profiles = flags.profiles || flags.providers ? await selectedProfiles("doctor",flags) : PROFILES.filter(p=>p.baseline || PROFILES.some(other=>other.provider===p.provider && other.baseline && other.blocked_reason));
  const manifest = {command:"doctor",start_time:new Date().toISOString(),end_time:null as string|null,profiles,blocked_profiles:profiles.filter(p=>p.blocked_reason).map(p=>({id:p.id,reason:p.blocked_reason})),limits:LIMITS,provider_limits:PROVIDER_LIMITS,versions:await versions()};
  await writeJSON(join(dir,"manifest.json"),manifest);
  const model = modelEnv("agent");
  if (model.key && model.base && model.model) {
    const response = await modelCall("agent","Call smoke_check once with ok=true.",[{name:"smoke_check",description:"Connectivity/tool smoke check",input_schema:{type:"object",properties:{ok:{type:"boolean"}},required:["ok"],additionalProperties:false}}],[{role:"user",content:"Call smoke_check now."}]);
    await writeJSON(join(dir,"private","llm.json"),response);
    if (response.error) throw Error(`BLOCKED: proxy rejected LLM request shape or failed: ${response.error.class} ${response.error.message}; inspect private doctor artifact`);
    const tool = response.content.find(b=>b.type==="tool_use"&&b.name==="smoke_check"&&b.input?.ok===true); if (!tool) throw Error("BLOCKED: proxy returned no valid tool call");
    rows.push({provider:"agent LLM",status:"ok",results:1,ms:response.http.ms,cost:response.cost,usage:response.usage,model:response.model});
  } else { rows.push({provider:"agent LLM",status:"blocked: missing configuration"}); failed=true; }
  log("Provider\tSearch status / count / ms\tRead status / ms\tCost estimated / metered");
  for (const profile of profiles) {
    if (profile.blocked_reason) { rows.push({provider:profile.provider,profile:profile.id,status:"BLOCKED",reason:profile.blocked_reason,result_count:null,search_ms:null,read_ms:null,cost:unknownCost("profile blocked; not evaluated")}); log(`${profile.id}\tBLOCKED\t${profile.blocked_reason}`); continue; }
    if (!providerKey(profile.provider)) { rows.push({provider:profile.provider,status:"blocked: missing credential"}); failed=true; log(`${profile.provider}\tblocked: missing credential`); continue; }
    const session = new ToolSession(createAdapter(profile));
    const search = await session.web_search({query:"TypeScript official documentation satisfies operator",purpose:"Find TypeScript official satisfies operator documentation"});
    const read = search.results[0] ? await session.web_read({result_id:search.results[0].id}) : undefined;
    const braveRows = profile.id === "brave:web" ? session.trace[0]?.outcome.http?.data?.web?.results : undefined;
    const row = {provider:profile.provider,profile:profile.id,search_status:search.error?.class ?? "ok",result_count:search.results.length,search_ms:session.trace[0]?.outcome.ms ?? 0,read_status:read?.error?.class ?? (read?.available?"ok":"not attempted"),read_ms:session.trace.find(t=>t.kind==="read")?.outcome.ms ?? null,cost:session.cost,...(Array.isArray(braveRows)?{extra_snippets_result_count:braveRows.filter((r:any)=>Array.isArray(r.extra_snippets)&&r.extra_snippets.length).length,extra_snippets_total:braveRows.reduce((n:number,r:any)=>n+(r.extra_snippets?.length??0),0)}:{}),cost_fields:session.trace.map(t=>({kind:t.kind,cost:t.outcome.cost,reported_cost_fields:{costDollars:t.outcome.http?.data?.costDollars,creditsUsed:t.outcome.http?.data?.creditsUsed,usage:t.outcome.http?.data?.usage}})),requests:session.requests};
    rows.push(row); await writeJSON(join(dir,"private",`${profile.id.replace(":","-")}.json`),{trace:session.trace});
    log(`${profile.id}\t${row.search_status} / ${row.result_count} / ${Math.round(row.search_ms)}\t${row.read_status} / ${row.read_ms===null?"unknown":Math.round(row.read_ms)}\t${row.cost.estimated_usd ?? "unknown"} / ${row.cost.metered_usd ?? "unknown"}`);
    if (Array.isArray(braveRows)) log(`brave:web extra_snippets: ${row.extra_snippets_result_count}/${braveRows.length} results; ${row.extra_snippets_total} snippets`);
    if (search.error || read?.error || !read?.available) failed=true;
    if (session.trace.some(t=>t.outcome.http?.attempts.some(a=>a.status===400||a.status===422))) { await writeJSON(join(dir,"doctor.json"),{rows}); throw Error(`BLOCKED: ${profile.provider} rejected specified parameters; inspect private artifact before changing request contract`); }
  }
  manifest.end_time=new Date().toISOString(); await writeJSON(join(dir,"manifest.json"),manifest);
  await writeJSON(join(dir,"doctor.json"),{rows}); await report(dir); log(`Doctor artifacts: ${dir}`); if (failed) process.exitCode=1;
}
export async function main(argv = process.argv.slice(2)) {
  loadEnv(); const {command,flags}=parseArgs(argv);
  if (command==="help"||flags.help) { log("Commands: doctor [--no-network], pilot, eval --suite search|agents|all, report --run results/<id>, judge --run results/<id>, truth:check [--cases file].\nFlags: --providers names/ids --profiles ids --cases file --limit N --reps N --seed 42 --concurrency 3 --max-cost-usd 20 --max-minutes 45 --dry-run --resume id --keep-work --no-judge --yes. Estimates exceeding the cap are refused, including with --yes."); return; }
  if (command==="doctor") return doctor(flags);
  if (command==="pilot"||command==="eval") return runEvaluation(command,flags);
  if (command==="report"||command==="judge") {
    if (!flags.run) throw Error("--run required"); const dir=runDir(String(flags.run));
    if (command==="judge") { const manifest=await json(join(dir,"manifest.json")); const searchFiles=manifest.case_files.filter((f:any)=>!f.path.endsWith("task.json")&&!f.path.includes("agent-holdout")); const cases:SearchCase[]=[]; for(const f of searchFiles) { const bytes=await readFile(f.path); if(sha256(bytes)!==f.sha256) throw Error(`Changed truth file: ${f.path}`); const parsed=JSON.parse(bytes.toString()); if(parsed.cases) cases.push(...parsed.cases); } const units=await readJSONL<Unit>(join(dir,"units.jsonl")), done=new Set((await readJSONL(join(dir,"judgments.jsonl"))).map(j=>j.key)); const estimate=units.filter(u=>u.suite==="search"&&!done.has(u.key)).length*.052, cap=num(flags,"max-cost-usd",20); assertBudget(estimate,cap); if(flags["dry-run"]) { log(`Judge dry run: estimated $${estimate.toFixed(4)}`); return; } await judge(dir,cases,num(flags,"seed",manifest.seed),new Budget(cap,num(flags,"max-minutes",45))); }
    log(await report(dir)); return;
  }
  if(command==="truth:check") { const paths=flags.cases?[String(flags.cases)]:["cases/pilot.json","cases/search-holdout.json"]; if(!await truthCheck(paths)) process.exitCode=1; return; }
  throw Error(`Unknown command ${command}`);
}
if(import.meta.main) main().catch(e=>{ log(`ERROR: ${e.message}`); process.exitCode=1; });
