import {execa, parseCommandString} from 'execa';
import type {CommandCallbacks, CommandResult} from './types';

export async function runCommand(
  command: string,
  callbacks: CommandCallbacks = {},
): Promise<CommandResult> {
  const [file, ...args] = parseCommandString(command);
  const subprocess = execa(file, args, {reject: false});
  subprocess.nodeChildProcess.on('spawn', () => callbacks.onSpawn?.());
  subprocess.nodeChildProcess.on('exit', code => callbacks.onExit?.(code));
  const result = await subprocess;
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    failed: result.failed,
  };
}
