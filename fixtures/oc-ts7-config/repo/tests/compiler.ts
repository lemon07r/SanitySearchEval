import {spawnSync} from 'node:child_process';
import {join} from 'node:path';

export function tsc(extra: string[] = []) {
  const result = spawnSync('node', [join(process.cwd(),'node_modules/typescript/bin/tsc'),
    '--noEmit','--pretty','false',...extra], {encoding:'utf8',cwd:process.cwd(),timeout:10000});
  return {status:result.status, output:result.stdout + result.stderr, error:result.error};
}
