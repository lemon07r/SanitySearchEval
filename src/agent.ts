import { cp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { LIMITS, sumCosts, unknownCost } from "./config";
import { REVIEW_PROMPT, CODE_PROMPT } from "./prompts";
import { modelCall, emptyUsage, addUsage } from "./llm";
import { WEB_TOOLS, ToolSession } from "./tools";
import { WorkspaceTools, protectedHashes, runIsolated } from "./workspace";
import { scoreReview } from "./score";
import type { Task, Finding, Cost } from "./types";
const schema = (name: string, description: string, properties: any, required: string[] = []) => ({name, description, input_schema: {type: "object", properties, required, additionalProperties: false}});
const str = {type: "string"};
export const SUBMIT = schema("submit_review", "Submit final PR review", {summary: str, findings: {type: "array", items: {type: "object", properties: {file: str, line: {type: "integer", minimum: 1}, title: str, explanation: str, confidence: {enum: ["high", "medium", "low"]}, citations: {type: "array", items: str}}, required: ["file", "line", "title", "explanation", "confidence", "citations"], additionalProperties: false}}}, ["summary", "findings"]);
export const FINISH = schema("finish", "Finish the implementation task", {summary: str}, ["summary"]);
export function agentTools(task: Task, web: boolean) {
  return [schema("read_file", "Read up to 400 lines / 40 KB", {path: str, start_line: {type: "integer"}, end_line: {type: "integer"}}, ["path"]), schema("grep_repo", "Regex search repository (at most 100 matches)", {pattern: str, path: str}, ["pattern"]), ...(task.product === "opencode" ? [schema("list_files", "List repository files", {path: str}), schema("edit_file", "Replace one unique exact string", {path: str, old_string: str, new_string: str}, ["path", "old_string", "new_string"]), schema("write_file", "Write an implementation file", {path: str, content: str}, ["path", "content"]), schema("run_tests", "Run the configured visible tests without network", {})] : []), ...(web ? WEB_TOOLS : []), task.product === "revera" ? SUBMIT : FINISH];
}
function validFindings(value: any): value is Finding[] { return Array.isArray(value) && value.every(f => typeof f.file === "string" && Number.isInteger(f.line) && f.line >= 1 && typeof f.title === "string" && typeof f.explanation === "string" && ["high", "medium", "low"].includes(f.confidence) && Array.isArray(f.citations) && f.citations.every((s: any) => typeof s === "string")); }
export async function runAgent(task: Task, fixture: string, root: string, baselineHashes: Record<string, string>, session?: ToolSession, callModel = modelCall) {
  const start = Date.now(), limits = LIMITS[task.product]; const local = new WorkspaceTools(root, task);
  const finalTool = task.product === "revera" ? SUBMIT : FINISH;
  const tools = agentTools(task, !!session); const names = new Set(tools.map(t => t.name));
  const diff = task.product === "revera" ? await readFile(join(fixture, task.diff_file ?? "pr.diff"), "utf8") : "";
  const messages: any[] = [{role: "user", content: task.prompt + (diff ? `\n\nPR diff:\n${diff}` : "")}];
  const transcript: any[] = [], costs: Cost[] = [], usage = emptyUsage(), counts: Record<string, number> = {}, latencies: {tool: string; ms: number}[] = [];
  let calls = 0, completion: "complete" | "budget_forced" | "timeout" | "error" = "error", summary = "", findings: Finding[] = [], failure: string | undefined;
  try {
    while (calls < limits.calls) {
      const remaining = limits.wall_ms - (Date.now() - start);
      if (remaining <= 0) { completion = "timeout"; break; }
      const forced = calls === limits.calls - 1 || remaining < 30000;
      if (forced) messages.push({role: "user", content: "budget reached; submit now"});
      calls++;
      const response = await callModel("agent", task.product === "revera" ? REVIEW_PROMPT : CODE_PROMPT, forced ? [finalTool] : tools, messages, Math.min(90000, remaining));
      transcript.push({call: calls, response}); costs.push(response.cost); addUsage(usage, response.usage);
      if (response.error) { failure = response.error.message; completion = response.error.class === "timeout" ? "timeout" : "error"; break; }
      // Verbatim content echo includes signed thinking and any future content block types.
      messages.push({role: "assistant", content: response.content});
      const toolUses = response.content.filter(b => b.type === "tool_use");
      if (!toolUses.length) { if (forced) { completion = "budget_forced"; break; } messages.push({role: "user", content: `Continue with the tools or call ${finalTool.name} to finish.`}); continue; }
      const results: any[] = []; let submitted = false;
      for (const block of toolUses) {
        const toolStart = performance.now(); counts[block.name] = (counts[block.name] ?? 0) + 1;
        let output: any, is_error = false;
        try {
          if (!names.has(block.name) || forced && block.name !== finalTool.name) throw Error("Tool unavailable");
          if (Date.now() - start >= limits.wall_ms) throw Error("Wall budget reached; submit now");
          if (block.name === finalTool.name) {
            if (typeof block.input?.summary !== "string" || task.product === "revera" && !validFindings(block.input.findings)) throw Error("Invalid final submission schema");
            if (!submitted) { summary = block.input.summary; findings = block.input.findings ?? []; submitted = true; completion = forced ? "budget_forced" : "complete"; }
            output = {accepted: true};
          } else if (submitted) throw Error("Already submitted");
          else if (block.name === "web_search" || block.name === "web_read") {
            if (counts[block.name] > (block.name === "web_search" ? LIMITS.web_search : LIMITS.web_read)) throw Error("Web tool call limit exceeded; submit now");
            output = block.name === "web_search" ? await session!.web_search(block.input) : await session!.web_read(block.input);
          } else output = await local.call(block.name, block.input);
        } catch (e: any) { output = {error: e.message}; is_error = true; }
        latencies.push({tool: block.name, ms: performance.now() - toolStart});
        results.push({type: "tool_result", tool_use_id: block.id, content: JSON.stringify(output), ...(is_error ? {is_error: true} : {})});
      }
      messages.push({role: "user", content: results});
      if (submitted) break;
      if (Date.now() - start >= limits.wall_ms) { completion = "timeout"; break; }
      if (calls === limits.calls) completion = "budget_forced";
    }
  } catch (e: any) { failure = e.message; completion = "error"; }
  const hashes = await protectedHashes(root, task);
  const violations = [...new Set([...Object.keys(baselineHashes), ...Object.keys(hashes)])].filter(p => hashes[p] !== baselineHashes[p]);
  let hidden: Awaited<ReturnType<typeof runIsolated>> | undefined;
  if (task.product === "opencode") {
    try { await cp(join(fixture, "hidden"), join(root, "hidden"), {recursive: true}); hidden = await runIsolated(root, task.hidden_test_cmd, 90000); } catch (e: any) { hidden = {exit_code: null, timed_out: false, output: "", ms: 0, pass: null, total: null, error: e.message}; }
  }
  const score = task.product === "revera" ? scoreReview(task, findings) : {hidden_tests: hidden ? {pass: hidden.pass, total: hidden.total, exit_code: hidden.exit_code, timed_out: hidden.timed_out, error: hidden.error} : null, all_pass: !!hidden && hidden.exit_code === 0 && hidden.total !== null && hidden.total > 0 && hidden.pass === hidden.total && !violations.length, violations};
  return {metrics: {product: task.product, ...score, completion, model_calls: calls, usage, search_count: counts.web_search ?? 0, read_count: counts.web_read ?? 0, tool_counts: counts, tool_latencies: latencies, wall_ms: Date.now() - start, agent_ms: Date.now() - start - (hidden?.ms ?? 0), failure}, model_cost: costs.length ? sumCosts(costs) : unknownCost("No model call completed"), private: {messages, transcript, summary, findings, hidden, baselineHashes, finalHashes: hashes}};
}
