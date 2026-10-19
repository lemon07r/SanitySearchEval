export type Provider = "brave" | "exa" | "parallel" | "firecrawl" | "tavily";
export type ErrorClass = "timeout" | "http_4xx" | "http_429" | "http_5xx" | "parse" | "empty" | "blocked" | "network";
export interface ToolError { class: ErrorClass; message: string }
export interface Cost { estimated_usd: number | null; metered_usd: number | null; basis: string }
export interface Attempt { status: number | null; ms: number; error?: string; request_id?: string; cache: Record<string, string> }
export interface HttpResult { data: any; attempts: Attempt[]; ms: number; pacing_ms?: number; error?: ToolError; request: {url: string; method: string; params: any} }
export interface RawResult { title: string; url: string; published_at: string | null; snippet_or_excerpt: string; source: string; markdown?: string; metadata?: any }
export interface SearchResult extends RawResult { id: string; raw_chars: number; visible_chars: number }
export interface SearchPayload { search_request_id: string; results: SearchResult[]; error?: ToolError }
export interface ReadPayload { id: string; url: string; title?: string; text: string; available: boolean; error?: ToolError; provenance: string; raw_chars: number; visible_chars: number; metadata?: any }
export interface Outcome<T> { value: T; cost: Cost; http?: HttpResult; raw?: any; ms: number; error?: ToolError }
export interface Profile { id: string; provider: Provider; mode: string; baseline: boolean; blocked_reason?: string; search: {url: string; method: string; params: any}; read: {url: string; method: string; params: any} }
export interface Adapter {
  profile: Profile;
  search(query: string, purpose?: string): Promise<Outcome<RawResult[]>>;
  read(result: RawResult, purpose?: string): Promise<Outcome<{text: string; title?: string; metadata?: any; provenance: string}>>;
}
export interface GoldFact { id: string; text: string; load_bearing: boolean; patterns: string[][] }
export interface SearchCase { id: string; product: "revera" | "opencode"; category: string; trap: boolean; difficulty: string; question: string; query: string; gold_facts: GoldFact[]; acceptable_sources: {url: string; prefix?: boolean}[]; excerpts: {url: string; quote: string}[]; negative_conditions: string; checked_at: string }
export interface Finding { file: string; line: number; title: string; explanation: string; confidence: "high" | "medium" | "low"; citations: string[] }
export type TestCommand = string | string[];
export interface Task { id: string; product: "revera" | "opencode"; title: string; prompt: string; package_versions: Record<string, string>; diff_file?: string; clean?: boolean; known_bugs?: {id: string; file: string; description: string; patterns: string[][]}[]; visible_test_cmd?: TestCommand; hidden_test_cmd?: TestCommand; protected_paths?: string[]; expected_edit_paths?: string[]; sources: unknown; notes_private: unknown }
export interface Usage { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }
export interface Unit { key: string; suite: "search" | "agents"; caseId: string; arm: string; rep: number; status: "ok" | "error"; started_at: string; ended_at: string; error?: ToolError; metrics: any; costs: {provider: Cost; model?: Cost}; requests: any[]; urls: string[]; [key: string]: any }
