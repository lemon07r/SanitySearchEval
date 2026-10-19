import { modelEnv } from "./env";
import { requestJSON } from "./http";
import { PRICES, unknownCost } from "./config";
import type { Cost, Usage } from "./types";
export const MODEL_SETTINGS = {max_tokens: 16000, thinking: {type: "adaptive"}, output_config: {effort: "medium"}};
export const emptyUsage = (): Usage => ({input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0});
export function addUsage(a: Usage, b: Partial<Usage>): Usage { for (const k of Object.keys(a) as (keyof Usage)[]) a[k] += b[k] ?? 0; return a; }
export function modelCost(usage: Usage): Cost { return {estimated_usd: (usage.input_tokens * PRICES.model.input + usage.output_tokens * PRICES.model.output + usage.cache_read_input_tokens * PRICES.model.cache_read + usage.cache_creation_input_tokens * PRICES.model.cache_write) / 1e6, metered_usd: null, basis: "estimated Anthropic list price, proxy billing unknown"}; }
export async function modelCall(kind: "agent" | "judge", system: string, tools: any[], messages: any[], timeout = 90000) {
  const env = modelEnv(kind);
  if (!env.key || !env.base || !env.model) throw Error(`Missing ${kind} model credentials/base/model`);
  const body = {model: env.model, ...MODEL_SETTINGS, system, tools, messages};
  const http = await requestJSON({url: env.base.replace(/\/+$/, "") + "/messages", params: body, headers: {"x-api-key": env.key, "anthropic-version": "2023-06-01"}, provider: "llm", timeout});
  if (http.error) return {http, error: http.error, content: [] as any[], usage: emptyUsage(), cost: unknownCost("LLM request failed; usage unknown"), model: null};
  const data = http.data;
  if (data.model !== env.model.split("/").at(-1)) throw Error(`Model mismatch: requested ${env.model.split("/").at(-1)}, received ${data.model ?? "missing"}`);
  if (!Array.isArray(data.content) || !data.usage || typeof data.usage.input_tokens !== "number" || typeof data.usage.output_tokens !== "number") throw Error("Invalid Messages API content/usage shape");
  const usage = addUsage(emptyUsage(), data.usage);
  return {http, content: data.content as any[], usage, cost: http.attempts.length > 1 ? unknownCost("LLM retried; first attempt usage unknown") : modelCost(usage), model: data.model, stop_reason: data.stop_reason};
}
