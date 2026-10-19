import {copyFile, mkdir, readdir, stat} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = join(root, 'fixtures');

async function exists(path: string): Promise<boolean> {
  try {return (await stat(path)).isFile();}
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

for (const entry of (await readdir(fixtures, {withFileTypes: true})).sort((a,b)=>a.name.localeCompare(b.name))) {
  if (!entry.isDirectory()) continue;
  const fixture = join(fixtures, entry.name);
  const repo = join(fixture, 'repo');
  if (!await exists(join(repo, 'package.json')) || !await exists(join(repo, 'bun.lock'))) continue;
  const deps = join(fixture, '.deps');
  await mkdir(deps, {recursive:true});
  for (const name of ['package.json','bun.lock']) await copyFile(join(repo,name),join(deps,name));
  console.log(`Installing ${entry.name}`);
  const child = Bun.spawn(['bun','install','--frozen-lockfile'], {cwd:deps,stdout:'inherit',stderr:'inherit'});
  if (await child.exited !== 0) throw new Error(`Dependency installation failed: ${entry.name}`);
}
