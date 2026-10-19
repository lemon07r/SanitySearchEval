import {test, expect} from 'bun:test';

test('executes a local command and reports lifecycle', async () => {
  const {runCommand} = await import('../src/runner');
  const events: unknown[] = [];
  const result = await runCommand('node --version', {
    onSpawn: () => events.push('spawn'),
    onExit: code => events.push(code),
  });
  expect(result.stdout).toMatch(/^v\d+\./);
  expect(result.exitCode).toBe(0);
  expect(events).toEqual(['spawn', 0]);
});
