import {test, expect} from 'bun:test';
import {writeFileSync, mkdirSync, rmSync} from 'node:fs';
import {join} from 'node:path';

async function runner() { return (await import('../src/runner')).runCommand; }

test('multiple separator spaces do not create empty arguments', async () => {
  const runCommand = await runner();
  const result = await runCommand('   node    --version   ');
  expect(result.stdout).toMatch(/^v\d+\./);
  expect(result.failed).toBe(false);
  expect(result.stderr).toBe('');
});

test('escaped spaces are preserved inside arguments', async () => {
  const runCommand = await runner();
  const folder = join(process.cwd(), '.command-probe');
  mkdirSync(folder, {recursive: true});
  const script = join(folder, 'print.cjs');
  writeFileSync(script, 'console.log(JSON.stringify(process.argv.slice(2)))');
  try {
    const result = await runCommand(`node ${script.replaceAll(' ', '\\ ')} hello\\ world    tail`);
    expect(JSON.parse(result.stdout)).toEqual(['hello world', 'tail']);
    expect(result.exitCode).toBe(0);
  } finally { rmSync(folder, {recursive: true, force: true}); }
});

test('nonzero status, stderr and callbacks are retained', async () => {
  const runCommand = await runner();
  const folder = join(process.cwd(), '.exit-probe');
  mkdirSync(folder, {recursive: true});
  const script = join(folder, 'exit.cjs');
  writeFileSync(script, 'console.log("partial");console.error("failure detail");process.exitCode=7');
  const events: unknown[] = [];
  try {
    const result = await runCommand(`node ${script.replaceAll(' ', '\\ ')}`, {
      onSpawn: () => events.push('spawn'), onExit: code => events.push(code),
    });
    expect(result).toEqual({stdout:'partial', stderr:'failure detail', exitCode:7, failed:true});
    expect(events).toEqual(['spawn', 7]);
  } finally { rmSync(folder, {recursive: true, force: true}); }
});
