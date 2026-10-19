import { readFileSync } from "node:fs";
import { setSecrets } from "./redact";
let loaded = false;
export function secretValues(env: Record<string, string | undefined>): string[] { return Object.entries(env).filter(([name, value]) => /(_API_KEY|_KEY|_TOKEN|_SECRET|PASSWORD)$/i.test(name) && typeof value === "string" && value.length >= 12).map(([, value]) => value!); }
export const ENV_NAMES = ["BRAVE_API_KEY", "EXA_API_KEY", "PARALLEL_API_KEY", "PARRELLEL_API_KEY", "FIRECRAWL_API_KEY", "TAVILY_API_KEY", "AGENT_LLM_API_KEY", "AGENT_LLM_BASE_URL", "AGENT_LLM_MODEL", ...["JUDGE_LLM_MODEL", "RERANKER_MODEL", "EMBEDDING_MODEL"].flatMap(p => [p + "_API_KEY", p + "_BASE_URL", p + "_ID"])];
export function loadEnv(file = ".env") {
  if (loaded) return;
  loaded = true;
  let text = "";
  try { text = readFileSync(file, "utf8"); } catch (e: any) { if (e.code !== "ENOENT") throw e; }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(.*)?$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let value = (m[2] ?? "").trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, "");
    process.env[m[1]] = value;
  }
  setSecrets(secretValues(process.env));
}
export function providerKey(provider: string): string | undefined {
  loadEnv();
  return process.env[provider.toUpperCase() + "_API_KEY"] || (provider === "parallel" ? process.env.PARRELLEL_API_KEY : undefined);
}
export function modelEnv(kind: "agent" | "judge") {
  loadEnv();
  const judge = { key: process.env.JUDGE_LLM_MODEL_API_KEY, base: process.env.JUDGE_LLM_MODEL_BASE_URL, model: process.env.JUDGE_LLM_MODEL_ID };
  return kind === "judge" ? judge : { key: process.env.AGENT_LLM_API_KEY || judge.key, base: process.env.AGENT_LLM_BASE_URL || judge.base, model: process.env.AGENT_LLM_MODEL || judge.model };
}
