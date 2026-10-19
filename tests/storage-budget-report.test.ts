import { test, expect } from "bun:test";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { Store, readJSONL, writeJSON, publicUnit, publicJudgment } from "../src/store";
import { sumCosts, unknownCost } from "../src/config";
import { assertBudget, Budget } from "../src/budget";
import { report } from "../src/report";
import { blind, shuffle } from "../src/judge";
import type { Unit } from "../src/types";
import { agentEntries } from "../src/cli";
const baseUnit=(key:string):Unit=>({key,suite:"search",caseId:"case",arm:"exa:auto",rep:1,status:"error",started_at:"fixed",ended_at:"fixed",error:{class:"timeout",message:"timeout"},metrics:{url:{1:false,3:false,5:false},evidence:{1:false,3:false,5:false},read_ok:false,evidence_in_read:false,search_ms:10,total_ms:10},costs:{provider:unknownCost()},requests:[],urls:[]});
test("unknown costs stay unknown; no calls are separately known zero",()=>{const c=sumCosts([{estimated_usd:1,metered_usd:null,basis:"estimated"},unknownCost()]);expect(c.estimated_usd).toBeNull();expect(c.metered_usd).toBeNull();expect(sumCosts([]).estimated_usd).toBe(0);});
test("budget refuses before calls and finishes in-flight units",()=>{expect(()=>assertBudget(.5,.1)).toThrow("Budget refusal");const b=new Budget(1,1);expect(b.canStart(.6)).toBe(true);b.finish(.6,[{estimated_usd:1.1,metered_usd:null,basis:"actual estimate"}]);expect(b.canStart(.01)).toBe(false);expect(b.stop_reason).toContain("cost cap");});
test("append-only completion, resume, duplicate rejection, deterministic failure-inclusive report",async()=>{
  const base=join(homedir(),".local/tmp/sanity-search-tests");await mkdir(base,{recursive:true});const dir=await mkdtemp(join(base,"store-"));
  try{const store=new Store(dir);await store.init();await store.complete(baseUnit("search|case|exa:auto|rep1"),{page:"private page data"});const next=new Store(dir);await next.init();expect(next.completed.has("search|case|exa:auto|rep1")).toBe(true);await expect(next.complete(baseUnit("search|case|exa:auto|rep1"),{})).rejects.toThrow("already completed");expect((await readJSONL(join(dir,"units.jsonl"))).length).toBe(1);expect(await readFile(join(dir,"units.jsonl"),"utf8")).not.toContain("private page data");await report(dir);const first=await readFile(join(dir,"REPORT.md"),"utf8");expect(first).toContain("0/1 (0.0%)");expect(first).toContain("unknown");expect(first).toContain("ERR");await report(dir);expect(await readFile(join(dir,"REPORT.md"),"utf8")).toBe(first);expect(await readFile(join(dir,"report.html"),"utf8")).toContain("exa:auto");
  }finally{await rm(dir,{recursive:true,force:true});}
});
test("seeded shuffle is stable and judge provider labels are blinded",()=>{expect(shuffle([1,2,3,4,5],42)).toEqual(shuffle([1,2,3,4,5],42));expect(blind("brave:llm-context EXA parallel:advanced firecrawl tavily")).not.toMatch(/brave|exa|parallel|firecrawl|tavily/i);});
test("CLI dry-run refuses excessive budget without network or artifacts",async()=>{
  // Pilot does not need a frozen file and uses only the hand-authored test corpus.
  const child=Bun.spawn([process.execPath,"src/cli.ts","pilot","--cases","tests/fixtures/search-cases.json","--max-cost-usd","0","--dry-run","--no-judge"],{stdout:"pipe",stderr:"pipe"});const text=await new Response(child.stdout).text();expect(await child.exited).toBe(1);expect(text).toContain("Budget refusal");expect(text).not.toContain("Saved results/");
});
test("both agent indexes normalize with private metadata kept separate",()=>{
  expect(agentEntries([{id:"oc-a",product:"opencode",fixture_dir:"fixtures/oc-a"}])).toEqual([{id:"oc-a",product:"opencode",fixture_dir:"fixtures/oc-a"}]);
  expect(agentEntries({version:1,tasks:["rv-a"]})).toEqual([{id:"rv-a",fixture_dir:"fixtures/rv-a"}]);
  expect(()=>agentEntries([{id:"oc-a",fixture_dir:"../escape"}])).toThrow("fixtures/");
});
test("blocked profile dry-run plans no calls and charges no budget",async()=>{
  const child=Bun.spawn([process.execPath,"src/cli.ts","pilot","--cases","tests/fixtures/search-cases.json","--profiles","brave:llm-context","--max-cost-usd","0","--dry-run","--no-judge"],{stdout:"pipe",stderr:"pipe"});
  const text=await new Response(child.stdout).text();expect(await child.exited).toBe(0);expect(text).toContain("BLOCKED (1 units skipped)");expect(text).toContain("no calls");expect(text).toContain("$0.0000");
});
test("blocked profiles appear in reports outside all failure denominators",async()=>{
  const base=join(homedir(),".local/tmp/sanity-search-tests");await mkdir(base,{recursive:true});const dir=await mkdtemp(join(base,"blocked-"));
  try{await writeJSON(join(dir,"manifest.json"),{blocked_profiles:[{id:"brave:llm-context",reason:"OPTION_NOT_IN_PLAN",skipped_units:6}]});await report(dir);const text=await readFile(join(dir,"REPORT.md"),"utf8");expect(text).toContain("## BLOCKED profiles (not evaluated)");expect(text).toContain("excluded from outcome denominators");expect(text).toContain("OPTION_NOT_IN_PLAN");expect(await readJSONL(join(dir,"units.jsonl"))).toEqual([]);}finally{await rm(dir,{recursive:true,force:true});}
});
test("Brave result URLs and Brave-derived text never reach public artifacts",()=>{
  const finding={file:"a.ts",line:1,title:"t",explanation:"quoted page text",citations:["https://r.example/x"],confidence:"low"};
  const u={...baseUnit("k"),arm:"brave:web",urls:["https://r.example/x"],requests:[{kind:"search",url:"https://api.search.brave.com/q"},{kind:"read",url:"https://r.example/x"}],metrics:{results:[{id:"s1r1",url:"https://r.example/x",published_at:"2026"}],reported:[finding],false_positives:[finding]}} as any;
  const out=JSON.stringify(publicUnit(u));
  expect(out).not.toContain("r.example");expect(out).not.toContain("quoted page text");expect(out).toContain("api.search.brave.com");
  expect(JSON.stringify(publicUnit({...u,arm:"exa:auto"}))).toContain("quoted page text");
  expect(publicJudgment({arm:"brave:web",judgment:{reason:"page says X",support:"supported"}}).judgment.reason).not.toContain("page says");
  expect(publicJudgment({arm:"exa:auto",judgment:{reason:"page says X"}}).judgment.reason).toBe("page says X");
});
test("trap slice is withheld when a case file changed after the run",async()=>{
  const dir=await mkdtemp(join(homedir(),".local/tmp/sse-trap-"));
  try{
    const cases=join(dir,"cases.json");await Bun.write(cases,JSON.stringify({cases:[{id:"r-a",trap:true}]}));
    await writeJSON(join(dir,"manifest.json"),{case_files:[{path:cases,sha256:"0".repeat(64)}],profiles:[],blocked_profiles:[]});
    await Bun.write(join(dir,"units.jsonl"),JSON.stringify({...baseUnit("search|r-a|exa:auto|rep1"),caseId:"r-a"})+"\n");
    await report(dir);expect(await readFile(join(dir,"REPORT.md"),"utf8")).toContain("changed since this run");
  }finally{await rm(dir,{recursive:true,force:true});}
});
