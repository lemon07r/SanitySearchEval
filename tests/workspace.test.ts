import { test, expect } from "bun:test";
import { mkdir, mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { guardedPath, WorkspaceTools, parseTestCounts, protectedHashes, isolatedArgs, prepareWorkspace } from "../src/workspace";
import { runAgent } from "../src/agent";
import { modelCost, emptyUsage } from "../src/llm";
import type { Task } from "../src/types";
async function scratch() {const base=join(homedir(),".local/tmp/sanity-search-tests");await mkdir(base,{recursive:true});return mkdtemp(join(base,"workspace-"));}
const task={id:"unit",product:"opencode",prompt:"Fix src/a.ts",protected_paths:["protected.txt"]} as Task;
test("workspace blocks traversal, absolute paths, dependency sources, hidden files, symlink escape",async()=>{
  const root=await scratch();try{await symlink(homedir(),join(root,"escape"));await mkdir(join(root,"node_modules"));await symlink(join(root,"node_modules"),join(root,"alias"));
    for(const path of ["../escape","/etc/passwd","a/../../escape","node_modules/lib/a.ts","hidden/test.ts",".git/config","escape/.env","alias/key","a/../x"])await expect(guardedPath(root,path)).rejects.toThrow();
    expect(await guardedPath(root,"src/new.ts")).toBe(join(root,"src/new.ts"));
  }finally{await rm(root,{recursive:true,force:true});}
});
test("workspace reads bounded lines, grep regex, unique edits, protected writes",async()=>{
  const root=await scratch();try{await mkdir(join(root,"src"));await writeFile(join(root,"src/a.ts"),"const value = 1;\nconst other = 2;\n".repeat(250));await writeFile(join(root,"package.json"),"{}");await writeFile(join(root,"protected.txt"),"safe");const tools=new WorkspaceTools(root,task);
    const read=await tools.call("read_file",{path:"src/a.ts"});expect(read.text.split("\n").length).toBe(400);expect(Buffer.byteLength(read.text)).toBeLessThanOrEqual(40000);
    const grep:any=await tools.call("grep_repo",{pattern:"value"});expect(grep.matches).toHaveLength(100);
    await expect(tools.call("edit_file",{path:"src/a.ts",old_string:"value",new_string:"x"})).rejects.toThrow("exactly once");
    for(const path of ["package.json","protected.txt","tests/hidden.test.ts"])await expect(tools.call("write_file",{path,content:"bad"})).rejects.toThrow("Protected");
    await tools.call("write_file",{path:"src/new.ts",content:"unique"});await tools.call("edit_file",{path:"src/new.ts",old_string:"unique",new_string:"correct"});expect((await tools.call("read_file",{path:"src/new.ts"})).text).toContain("correct");
    // Agent edits are code, not logs: redaction patterns must never rewrite them.
    const code="h.set('authorization', `Bearer ${config.getToken()}`);";await tools.call("write_file",{path:"src/auth.ts",content:code});expect((await tools.call("read_file",{path:"src/auth.ts"})).text).toBe(`1: ${code}`);
    await tools.call("edit_file",{path:"src/auth.ts",old_string:"h.set",new_string:"headers.set"});expect((await tools.call("read_file",{path:"src/auth.ts"})).text).toBe(`1: ${code.replace("h.set","headers.set")}`);
  }finally{await rm(root,{recursive:true,force:true});}
});
test("Bun and node test summary counts",()=>{
  expect(parseTestCounts(" 4 pass\n 1 fail\n")).toEqual({pass:4,total:5});
  expect(parseTestCounts("# tests 3\n# pass 2\n# fail 1\n")).toEqual({pass:2,total:3});
  expect(parseTestCounts("ℹ tests 3\nℹ pass 3\nℹ fail 0\n")).toEqual({pass:3,total:3});
  expect(parseTestCounts("command failed before tests")).toEqual({pass:null,total:null});
});
test("agent sequential tools and verbatim thinking echo, reserves final model call",async()=>{
  const root=await scratch();const t={...task,product:"revera",clean:true,diff_file:"pr.diff",known_bugs:[]} as Task;
  try{await writeFile(join(root,"pr.diff"),"diff --git a/a b/a");await writeFile(join(root,"package.json"),"{}");const hashes=await protectedHashes(root,t);let calls=0;let echoed=false;let finalOnly=false;const thinking={type:"thinking",thinking:"reasoning",signature:"signed"};
    const fake=async(_kind:any,_system:any,tools:any[],messages:any[])=>{calls++;if(calls>1)echoed=JSON.stringify(messages).includes(JSON.stringify(thinking));let content:any[];if(calls===8){finalOnly=tools.length===1&&tools[0].name==="submit_review"&&messages.at(-1).content==="budget reached; submit now";content=[{type:"tool_use",id:"final",name:"submit_review",input:{summary:"No defects",findings:[]}}];}else content=[thinking,{type:"tool_use",id:`read${calls}`,name:"read_file",input:{path:"package.json"}},{type:"tool_use",id:`grep${calls}`,name:"grep_repo",input:{pattern:"missing"}}];return{http:{data:{},attempts:[],ms:1,request:{url:"https://example.com",method:"POST",params:{}}},content,usage:emptyUsage(),cost:modelCost(emptyUsage()),model:"claude-opus-5-5",stop_reason:"tool_use"};};
    const result=await runAgent(t,root,root,hashes,undefined,fake);expect(calls).toBe(8);expect(echoed).toBe(true);expect(finalOnly).toBe(true);expect(result.metrics.completion).toBe("budget_forced");expect(result.metrics.tool_counts.read_file).toBe(7);expect(result.metrics.tool_counts.grep_repo).toBe(7);
  }finally{await rm(root,{recursive:true,force:true});}
});
test("fixture argv commands are not shell-joined; optional loopback stays in namespace",()=>{
  expect(isolatedArgs(["bun","test","hidden"])).toEqual(["-rn","--","bun","test","hidden"]);
  expect(isolatedArgs(["bun","test","validation"],true)).toEqual(["-rn","--","sh","-c",'ip link set lo up && exec "$@"',"fixture-check","bun","test","validation"]);
  expect(isolatedArgs("bun test tests")).toEqual(["-rn","--","sh","-c","bun test tests"]);
});
test("hidden tests execute after submission and protected-byte changes invalidate all-pass",async()=>{
  const base=await scratch(), root=join(base,"work"), fixture=join(base,"fixture");
  try{
    await mkdir(root);await mkdir(join(fixture,"hidden"),{recursive:true});
    await writeFile(join(root,"package.json"),"{}");
    await writeFile(join(fixture,"hidden/check.test.ts"),'import {test,expect} from "bun:test"; test("hidden",()=>expect(1+1).toBe(2));');
    const t={...task,hidden_test_cmd:[process.execPath,"test","hidden"]} as Task;
    const hashes=await protectedHashes(root,t);
    const fake=async()=>{
      await expect(guardedPath(root,"hidden/check.test.ts")).rejects.toThrow("blocked");
      // Simulate a prohibited change bypassing local tools, to exercise evaluator hashing.
      await writeFile(join(root,"package.json"),'{"changed":true}');
      return {http:{data:{},attempts:[],ms:1,request:{url:"https://example.com",method:"POST",params:{}}},content:[{type:"tool_use",id:"final",name:"finish",input:{summary:"done"}}],usage:emptyUsage(),cost:modelCost(emptyUsage()),model:"claude-opus-5-5",stop_reason:"tool_use"};
    };
    const result=await runAgent(t,fixture,root,hashes,undefined,fake);
    expect(result.metrics.completion).toBe("complete");
    if ("hidden_tests" in result.metrics) { expect(result.metrics.hidden_tests?.pass).toBe(1);expect(result.metrics.hidden_tests?.total).toBe(1);expect(result.metrics.hidden_tests?.exit_code).toBe(0);expect(result.metrics.violations).toEqual(["package.json"]);expect(result.metrics.all_pass).toBe(false); }
    else throw Error("Expected coding task metrics");
  }finally{await rm(base,{recursive:true,force:true});}
});
test("missing fixture deps block coding tasks but not reviews",async()=>{
  const base=await scratch(), fixture=join(base,"fixture");
  try{
    await mkdir(join(fixture,"repo"),{recursive:true});
    await writeFile(join(fixture,"repo/package.json"),'{"dependencies":{"ky":"2.2.0"}}');
    await expect(prepareWorkspace(fixture,join(base,"oc"),task)).rejects.toThrow("fixtures:setup");
    await expect(prepareWorkspace(fixture,join(base,"rv"),{...task,product:"revera"} as Task)).resolves.toBeDefined();
    await writeFile(join(fixture,"repo/package.json"),'{}');
    await expect(prepareWorkspace(fixture,join(base,"oc2"),task)).resolves.toBeDefined();
  }finally{await rm(base,{recursive:true,force:true});}
});
