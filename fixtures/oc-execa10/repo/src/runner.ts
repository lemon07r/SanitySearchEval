import {execaCommand} from 'execa';
import type {CommandCallbacks, CommandResult} from './types';

export async function runCommand(
  command: string,
  callbacks: CommandCallbacks = {},
): Promise<CommandResult> {
  const subprocess = execaCommand(command, {reject: false});
  subprocess.on('spawn', () => callbacks.onSpawn?.());
  subprocess.on('exit', code => callbacks.onExit?.(code));
  const result = await subprocess;
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    failed: result.failed,
  };
}
