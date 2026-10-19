import { readFile, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { modelCall } from "./llm";
import { JUDGE_PROMPT } from "./prompts";
import { PROFILES } from "./config";
import { readJSONL, Store, writeJSON } from "./store";
import { redact } from "./redact";
import type { SearchCase, Unit } from "./types";
import { Budget } from "./budget";
export function shuffle<T>(items: T[], seed: number): T[] { const out = [...items]; let state = seed >>> 0; const random = () => { state += 0x6D2B79F5; let t = Math.imul(state ^ state >>> 15, 1 | state); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i],out[j]] = [out[j],out[i]]; } return out; }
export function blind(text: string) { for (const name of [...PROFILES.map(p => p.id), "brave", "exa", "parallel", "firecrawl", "tavily"].sort((a,b) => b.length-a.length)) text = text.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"gi"),"Source set X"); return text; }
export const JUDGE_TOOL = {name: "record_judgment", description: "Record a blinded evidence assessment", input_schema: {type:"object", properties: {support: {enum:["supported","contradicted","insufficient"]}, version_applicable: {enum:["yes","no","unclear"]}, authority: {enum:["primary","secondary","low"]}, quote: {type:"string"}, confidence: {type:"number",minimum:0,maximum:1}, reason: {type:"string"}}, required:["support","version_applicable","authority","quote","confidence","reason"], additionalProperties:false}};
export function validJudgment(j: any) { return j && ["supported","contradicted","insufficient"].includes(j.support) && ["yes","no","unclear"].includes(j.version_applicable) && ["primary","secondary","low"].includes(j.authority) && typeof j.quote === "string" && typeof j.reason === "string" && typeof j.confidence === "number" && j.confidence >= 0 && j.confidence <= 1; }
export async function judge(dir: string, cases: SearchCase[], seed: number, budget: Budget) {
  const existing = await readJSONL(join(dir,"judgments.jsonl")); const done = new Set(existing.map(j => j.key));
  const units = shuffle((await readJSONL<Unit>(join(dir,"units.jsonl"))).filter(u => u.suite === "search" && !done.has(u.key)),seed);
  const store = new Store(dir);
  for (const u of units) {
    const c = cases.find(c => c.id === u.caseId); if (!c) throw Error(`Judge case missing: ${u.caseId}`);
    const estimate = .052; if (!budget.canStart(estimate)) break;
    let result: any;
    try {
      const saved = JSON.parse(await readFile(store.privatePath(u.key),"utf8"));
      const visible = saved.trace?.map((t: any) => t.visible) ?? [];
      const input = blind(JSON.stringify({question:c.question,gold_facts:c.gold_facts.map(f => f.text),source_set:"Source set X",visible_payload:visible}));
      const response = await modelCall("judge",JUDGE_PROMPT,[JUDGE_TOOL],[{role:"user",content:input}]);
      const judgment = response.content.find(b => b.type === "tool_use" && b.name === "record_judgment")?.input;
      result = {key:u.key,arm:u.arm,caseId:u.caseId,judgment:validJudgment(judgment) ? judgment : null,error:response.error ?? (!validJudgment(judgment) ? {class:"parse",message:"Invalid judge JSON"} : undefined),cost:response.cost,usage:response.usage};
      await writeJSON(join(dir,"private", `judge-${u.key.replace(/[^a-zA-Z0-9_-]/g,"_")}.json`),{input,response});
      budget.finish(estimate,[response.cost]);
    } catch (e: any) { result = {key:u.key,arm:u.arm,caseId:u.caseId,error:{class:"parse",message:e.message},cost:{estimated_usd:null,metered_usd:null,basis:"judge failed"}}; budget.finish(estimate,[result.cost]); }
    // Quotes are page text; publish a hash/length, keep the actual quote private.
    const publicResult = structuredClone(result);
    if (publicResult.judgment) { const {sha256} = await import("./store"); publicResult.judgment.quote_sha256 = sha256(publicResult.judgment.quote); publicResult.judgment.quote_chars = publicResult.judgment.quote.length; delete publicResult.judgment.quote; }
    const {publicJudgment} = await import("./store");
    await appendFile(join(dir,"judgments.jsonl"),redact(JSON.stringify(publicJudgment(publicResult)))+"\n");
  }
}
