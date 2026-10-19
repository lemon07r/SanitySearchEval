import { cp, mkdir, symlink, realpath, lstat, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, relative, isAbsolute, dirname, join, sep } from "node:path";
import { spawn } from "node:child_process";
import { sha256 } from "./store";
import type { Task, TestCommand } from "./types";
const forbidden = new Set(["node_modules", "hidden", ".git"]);
export function lexicalPath(root: string, input: string) {
  if (typeof input !== "string" || input.includes("\0") || isAbsolute(input) || input.split(/[\\/]/).some(p => p === ".." || forbidden.has(p))) throw Error("Path blocked");
  const path = resolve(root, input || ".");
  const rel = relative(resolve(root), path);
  if (rel.startsWith(".." + sep) || rel === ".." || isAbsolute(rel)) throw Error("Path escape blocked");
  return path;
}
export async function guardedPath(root: string, input: string): Promise<string> {
  const path = lexicalPath(root, input);
  const base = await realpath(root);
  let cursor = path;
  while (true) {
    try {
      const actual = await realpath(cursor);
      const rel = relative(base, actual);
      if (rel.startsWith(".." + sep) || rel === ".." || isAbsolute(rel) || rel.split(sep).some(p => forbidden.has(p))) throw Error("Symlink escape blocked");
      break;
    } catch (e: any) { if (e.code !== "ENOENT") throw e; if (cursor === dirname(cursor)) throw e; cursor = dirname(cursor); }
  }
  return path;
}
export async function listRepoFiles(root: string, start = "."): Promise<string[]> {
  const path = await guardedPath(root, start); const files: string[] = [];
  const walk = async (dir: string) => {
    for (const ent of (await readdir(dir, {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {
      if (forbidden.has(ent.name)) continue;
      const full = join(dir, ent.name); const rel = relative(root, full);
      try { await guardedPath(root, rel); } catch { continue; }
      if (ent.isDirectory()) await walk(full);
      else if (ent.isFile()) files.push(rel);
      // Do not traverse symlinks: no loops, no duplicate dependency files.
    }
  };
  if ((await lstat(path)).isFile()) return [relative(root, path)];
  await walk(path); return files;
}
function matchesPath(file: string, pattern: string) {
  if (file === pattern || file.startsWith(pattern.replace(/\/$/, "") + "/")) return true;
  return new Bun.Glob(pattern).match(file);
}
export function protectedFile(task: Task, file: string) { return file.split("/").at(-1) === "package.json" || /(^|\/)(tests?|__tests__)(\/|$)|\.(test|spec)\.[^.]+$/.test(file) || (task.protected_paths ?? []).some(p => matchesPath(file, p)); }
export async function protectedHashes(root: string, task: Task) { const out: Record<string, string> = {}; for (const file of await listRepoFiles(root)) if (protectedFile(task, file)) out[file] = sha256(await readFile(await guardedPath(root, file))); return out; }
export async function prepareWorkspace(fixture: string, root: string, task: Task) {
  await rm(root, {recursive: true, force: true}); await mkdir(root, {recursive: true}); await cp(join(fixture, "repo"), root, {recursive: true, dereference: false});
  try { await lstat(join(root, "node_modules")); throw Error("Fixture repo must not contain node_modules"); } catch (e: any) { if (e.code !== "ENOENT") throw e; }
  try { const deps = await realpath(join(fixture, ".deps", "node_modules")); await symlink(deps, join(root, "node_modules"), "dir"); } catch (e: any) { if (e.code !== "ENOENT") throw e; }
  return protectedHashes(root, task);
}
export function parseTestCounts(output: string) {
  const last = (regex: RegExp) => [...output.matchAll(regex)].at(-1)?.[1];
  const pass = last(/(?:^|\n)\s*(\d+)\s+pass\b/g) ?? last(/(?:^|\n)#\s*pass\s+(\d+)/g) ?? last(/(?:^|\n)[ℹi]\s+pass\s+(\d+)/g);
  const fail = last(/(?:^|\n)\s*(\d+)\s+fail\b/g) ?? last(/(?:^|\n)#\s*fail\s+(\d+)/g) ?? last(/(?:^|\n)[ℹi]\s+fail\s+(\d+)/g);
  const p = pass === undefined ? null : Number(pass), f = fail === undefined ? null : Number(fail);
  return {pass: p, total: p !== null && f !== null ? p + f : null};
}
export function isolatedArgs(command: TestCommand, loopback = false): string[] {
  if (Array.isArray(command)) {
    if (!command.length || command.some(s => typeof s !== "string" || s.includes("\0"))) throw Error("Invalid test command");
    return loopback ? ["-rn", "--", "sh", "-c", 'ip link set lo up && exec "$@"', "fixture-check", ...command] : ["-rn", "--", ...command];
  }
  return ["-rn", "--", "sh", "-c", (loopback ? "ip link set lo up && " : "") + command];
}
export async function runIsolated(root: string, command: TestCommand | undefined, timeout: number, loopback = false) {
  if (!command || Array.isArray(command) && !command.length) return {exit_code: null, timed_out: false, output: "No test command configured", ms: 0, pass: null, total: null, error: "missing command"};
  const start = performance.now();
  return new Promise<{exit_code: number | null; timed_out: boolean; output: string; ms: number; pass: number | null; total: number | null; error?: string}>(resolveResult => {
    let output = "", timed_out = false, done = false;
    const child = spawn("unshare", isolatedArgs(command, loopback), {cwd: root, detached: true, env: {PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: root, CI: "1", NO_COLOR: "1"}, stdio: ["ignore", "pipe", "pipe"]});
    const collect = (chunk: Buffer) => { output = (output + chunk.toString()).slice(-128000); };
    child.stdout.on("data", collect); child.stderr.on("data", collect);
    const finish = (exit_code: number | null, error?: string) => { if (done) return; done = true; clearTimeout(timer); resolveResult({exit_code, timed_out, output: output.slice(-4000), ms: performance.now() - start, ...parseTestCounts(output), error: error ?? (/unshare:.*(?:not permitted|failed)/i.test(output) ? "network isolation unavailable" : undefined)}); };
    const timer = setTimeout(() => { timed_out = true; try { if (child.pid) process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); } }, timeout);
    child.on("error", e => finish(null, e.message)); child.on("close", code => finish(code));
  });
}
export class WorkspaceTools {
  constructor(readonly root: string, readonly task: Task) {}
  async call(name: string, args: any): Promise<any> {
    if (name === "list_files") { const files = await listRepoFiles(this.root, args.path ?? "."); return {files: files.slice(0, 500), truncated: files.length > 500}; }
    if (name === "run_tests") return runIsolated(this.root, this.task.visible_test_cmd, 60000, this.task.product === "revera");
    if (name === "grep_repo") {
      if (typeof args.pattern !== "string" || args.pattern.length > 500) throw Error("Invalid pattern");
      // Run regex matching in a worker: pathological model-supplied regexes cannot hang the runner.
      const files = await listRepoFiles(this.root, args.path ?? ".");
      const inputs: {file: string; text: string}[] = []; let bytes = 0;
      for (const file of files) { const path = await guardedPath(this.root, file); const stat = await lstat(path); if (stat.size > 1024 * 1024) continue; bytes += stat.size; if (bytes > 5 * 1024 * 1024) break; inputs.push({file, text: await readFile(path, "utf8")}); }
      const code = `self.onmessage=({data})=>{try{const re=new RegExp(data.pattern);const matches=[];outer:for(const f of data.inputs){const lines=f.text.split('\\n');for(let i=0;i<lines.length;i++){if(re.test(lines[i]))matches.push({file:f.file,line:i+1,text:lines[i].slice(0,500)});if(matches.length>=100)break outer}}self.postMessage({matches})}catch(e){self.postMessage({error:String(e.message)})}}`;
      const blob = URL.createObjectURL(new Blob([code], {type: "application/javascript"})); const worker = new Worker(blob);
      try { return await new Promise((res, rej) => { const timer = setTimeout(() => { worker.terminate(); rej(Error("Regex timeout")); }, 1000); worker.onmessage = e => { clearTimeout(timer); res(e.data); }; worker.onerror = e => { clearTimeout(timer); rej(Error(e.message)); }; worker.postMessage({pattern: args.pattern, inputs}); }); } finally { worker.terminate(); URL.revokeObjectURL(blob); }
    }
    const path = await guardedPath(this.root, args.path);
    if (name === "read_file") {
      const start = args.start_line ?? 1, end = args.end_line ?? start + 399;
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) throw Error("Invalid line range");
      if ((await lstat(path)).size > 3 * 1024 * 1024) throw Error("File too large");
      const lines = (await readFile(path, "utf8")).split("\n");
      const chosen: string[] = []; let bytes = 0;
      for (let i = start - 1; i < Math.min(end, start + 399, lines.length); i++) { const line = `${i + 1}: ${lines[i]}`; if (bytes + Buffer.byteLength(line) + 1 > 40000) break; chosen.push(line); bytes += Buffer.byteLength(line) + 1; }
      return {text: chosen.join("\n"), total_lines: lines.length, truncated: start - 1 + chosen.length < Math.min(end, lines.length)};
    }
    if (this.task.product !== "opencode") throw Error("Review workspace is read-only");
    if (protectedFile(this.task, relative(this.root, path))) throw Error("Protected file; tests and package.json cannot be modified");
    if (name === "write_file") { if (typeof args.content !== "string" || args.content.length > 1024 * 1024) throw Error("Invalid content"); await mkdir(dirname(path), {recursive: true}); await writeFile(path, args.content); return {ok: true}; }
    if (name === "edit_file") {
      if (typeof args.old_string !== "string" || !args.old_string || typeof args.new_string !== "string") throw Error("Nonempty old_string and string new_string required");
      const original = await readFile(path, "utf8");
      const first = original.indexOf(args.old_string); if (first < 0 || original.indexOf(args.old_string, first + 1) >= 0) throw Error("old_string must match exactly once");
      await writeFile(path, original.slice(0, first) + args.new_string + original.slice(first + args.old_string.length)); return {ok: true};
    }
    throw Error("Unknown local tool");
  }
}
