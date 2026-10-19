import {cp, mkdir, readFile, readdir, rm, symlink, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {homedir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const fixtures = dirname(fileURLToPath(import.meta.url));
const scratch = join(homedir(), '.local/tmp/sse/fixture-check');
const selected = process.argv.slice(2);
const summary: unknown[] = [];
await mkdir(scratch, {recursive:true});

for (const entry of (await readdir(fixtures, {withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
  if (!entry.isDirectory() || !/^(oc|rv)-/.test(entry.name)) continue;
  if (selected.length && !selected.includes(entry.name)) continue;
  const fixture = join(fixtures,entry.name);
  const task = JSON.parse(await readFile(join(fixture,'task.json'),'utf8'));
  for (const state of task.product === 'opencode' ? ['initial','reference'] : ['post-pr']) {
    const workspace = join(scratch,`${entry.name}-${state}`);
    await rm(workspace,{recursive:true,force:true});
    await cp(join(fixture,'repo'),workspace,{recursive:true});
    await symlink(resolve(fixture,'.deps/node_modules'),join(workspace,'node_modules'),'dir');
    if (task.product === 'opencode') {
      await cp(join(fixture,'hidden'),join(workspace,'hidden'),{recursive:true});
      if (state === 'reference') await cp(join(fixture,'reference'),workspace,{recursive:true});
    } else {
      await mkdir(join(workspace,'validation'),{recursive:true});
      await cp(join(fixture,'verify.test.ts'),join(workspace,'validation/verify.test.ts'));
      const diff = spawnSync('git',['apply','--reverse','--check',join(fixture,'pr.diff')],{cwd:workspace,encoding:'utf8'});
      if (diff.status !== 0) throw new Error(`${entry.name} invalid PR diff: ${diff.stderr}`);
    }
    const protectedBefore = new Map<string,Buffer>();
    for (const path of task.protected_paths ?? []) protectedBefore.set(path,await readFile(join(workspace,path)));
    for (const [kind, command] of task.product === 'opencode'
      ? [['visible',task.visible_test_cmd],['hidden',task.hidden_test_cmd]]
      : [['verification',['bun','test','validation']]]) {
      const start = performance.now();
      // New network namespaces start with loopback down. Revera's local-server
      // probes need only loopback; coding tests have no sockets at all.
      const isolatedCommand = task.product === 'revera'
        ? ['-rn','sh','-c','ip link set lo up && exec "$@"','fixture-check',...command]
        : ['-rn',...command];
      const result = spawnSync('unshare',isolatedCommand,{cwd:workspace,encoding:'utf8',timeout:30000,
        env:{...process.env,TMPDIR:scratch}});
      const elapsedMs = Math.round(performance.now()-start);
      const output = result.stdout + result.stderr;
      await writeFile(join(scratch,`${entry.name}-${state}-${kind}.log`),output);
      const expectedSuccess = state !== 'initial';
      const counts = {pass:Number(output.match(/\n\s*(\d+) pass\b/)?.[1] ?? 0),
        fail:Number(output.match(/\n\s*(\d+) fail\b/)?.[1] ?? 0)};
      const record = {id:entry.name,state,kind,exitCode:result.status,elapsedMs,...counts};
      summary.push(record); console.log(JSON.stringify(record));
      if (result.error || (result.status === 0) !== expectedSuccess || counts.pass + counts.fail === 0) {
        console.error(output); throw new Error(`Unexpected ${entry.name} ${state} ${kind} outcome: ${result.error ?? result.status}`);
      }
    }
    for (const [path, bytes] of protectedBefore) {
      if (!bytes.equals(await readFile(join(workspace,path)))) throw new Error(`Protected path changed: ${entry.name}/${path}`);
    }
  }
}
console.log('All selected fixture checks matched expectations.');
console.log(`Workspaces and logs: ${scratch}`);
await writeFile(join(scratch,'last-summary.json'),JSON.stringify(summary,null,2)+'\n');
