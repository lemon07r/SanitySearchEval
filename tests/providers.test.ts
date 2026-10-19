import { test, expect } from "bun:test";
import samples from "./fixtures/providers.json";
import { normalizeBrave } from "../src/providers/brave";
import { normalizeExa, readExa } from "../src/providers/exa";
import { normalizeParallel, readParallel } from "../src/providers/parallel";
import { normalizeFirecrawl, readFirecrawl } from "../src/providers/firecrawl";
import { normalizeTavily, readTavily } from "../src/providers/tavily";
import { createAdapter, providerCost } from "../src/providers";
import { PROFILES } from "../src/config";
import { ToolSession } from "../src/tools";
const url = "https://example.com/docs";
process.env.FIRECRAWL_API_KEY ||= "test-only-key";
test("ten profiles with exact frozen native parameters", () => {
  expect(PROFILES).toHaveLength(10); expect(new Set(PROFILES.map(p=>p.id)).size).toBe(10);
  expect(PROFILES.find(p=>p.id==="parallel:fast")!.read.params.advanced_settings.full_content).toEqual({max_chars_per_result:60000});
  expect(PROFILES.find(p=>p.id==="firecrawl:search")!.read.params.maxAge).toBeUndefined();
  expect(PROFILES.find(p=>p.id==="tavily:basic")!.search.params.auto_parameters).toBe(false);
});
for (const [name, normalize, sample] of [["brave",normalizeBrave,samples.brave],["brave:web",(d:any)=>normalizeBrave(d,"web"),samples.braveWeb],["exa",normalizeExa,samples.exa],["parallel",normalizeParallel,samples.parallel],["firecrawl",normalizeFirecrawl,samples.firecrawl],["tavily",normalizeTavily,samples.tavily]] as const) {
  test(`${name} normalization from recorded shape`,()=>{ const result=normalize(sample)[0]; expect(result.url).toBe(url); expect(result.snippet_or_excerpt).toContain("library.validate()"); expect(result.published_at).toBe(name==="firecrawl"?null:"2026-10-01"); });
}
test("dates are never guessed",()=>{ expect(normalizeBrave({web:{results:[{url,age:"today"}]}},"web")[0].published_at).toBeNull(); expect(normalizeExa({results:[{url}]} )[0].published_at).toBeNull(); });
test("native read failures remain failures",()=>{
  expect(readExa({results:[],statuses:[{id:url,status:"error"}]},url).error?.class).toBe("empty");
  expect(readParallel({results:[],errors:[{url,http_status_code:403,error_type:"blocked"}]},url).error?.class).toBe("http_4xx");
  expect(readTavily({results:[],failed_results:[{url,error:"failed"}]},url).error?.class).toBe("empty");
  expect(readFirecrawl({success:true,data:{markdown:"error page",metadata:{statusCode:404}}}).error?.class).toBe("http_4xx");
});
test("native read text and cache metadata",()=>{ expect(readExa(samples.exa,url).text).toContain("2.0.0"); expect(readParallel(samples.parallel,url).text).toContain("2.0.0"); expect(readTavily(samples.tavily,url).text).toContain("2.0.0"); const r=readFirecrawl({success:true,data:{markdown:"doc",metadata:{statusCode:200,cacheState:"hit",cachedAt:"now"}}}); expect(r.metadata?.cacheState).toBe("hit"); });
test("cost estimates, dollar fields, retry unknowns",()=>{
  const exa=PROFILES.find(p=>p.id==="exa:auto")!;
  expect(providerCost(exa,false,samples.exa).metered_usd).toBe(.007); expect(providerCost(exa,false,samples.exa,2).metered_usd).toBeNull();
  expect(providerCost(PROFILES.find(p=>p.id==="tavily:advanced")!,false,samples.tavily).estimated_usd).toBe(.016);
  expect(providerCost(PROFILES.find(p=>p.id==="tavily:advanced")!,true,{}).estimated_usd).toBe(.008);
  expect(providerCost(PROFILES.find(p=>p.id==="firecrawl:search")!,false,samples.firecrawl).estimated_usd).toBe(.00198);
});
test("bundled Firecrawl read makes no extra call and arbitrary IDs are blocked",async()=>{
  let calls=0; const adapter=createAdapter(PROFILES.find(p=>p.id==="firecrawl:search-md")!, (async()=>{ calls++; return new Response(JSON.stringify(samples.firecrawl)); }) as unknown as typeof fetch);
  const session=new ToolSession(adapter); const search=await session.web_search({query:"library 2.0.0"}); const read=await session.web_read({result_id:search.results[0].id});
  expect(calls).toBe(1); expect(read.provenance).toBe("firecrawl/search-scrape"); expect((await session.web_read({result_id:"https://example.com"})).error?.class).toBe("blocked");
});
test("blocked profiles cannot reach a provider endpoint",async()=>{
  let calls=0; const adapter=createAdapter(PROFILES.find(p=>p.id==="brave:llm-context")!, (async()=>{calls++;throw Error("must not call");}) as unknown as typeof fetch);
  const outcome=await adapter.search("anything");expect(calls).toBe(0);expect(outcome.error?.class).toBe("blocked");expect(outcome.error?.message).toContain("OPTION_NOT_IN_PLAN");
});
