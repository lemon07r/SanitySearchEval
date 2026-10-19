import {test, expect} from 'bun:test';
import {writeFileSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tsc} from '../tests/compiler';

function withSource(source: string, check: () => void) {
  const file = join(process.cwd(),'src/holdout-probe.ts');
  writeFileSync(file, source);
  try {check();} finally {rmSync(file,{force:true});}
}

test('clean project has no compiler diagnostics', () => {
  const result = tsc();
  expect(result.error).toBeUndefined(); expect(result.output).toBe(''); expect(result.status).toBe(0);
});

test('effective compiler options retain strict checking', () => {
  const result = tsc(['--showConfig']);
  expect(result.status).toBe(0);
  const config = JSON.parse(result.output);
  expect(config.compilerOptions.strict).toBe(true);
  expect(config.compilerOptions.noCheck ?? false).toBe(false);
  for (const name of ['noImplicitAny','strictNullChecks','strictFunctionTypes','strictBindCallApply',
    'strictPropertyInitialization','strictBuiltinIteratorReturn','noImplicitThis','alwaysStrict','useUnknownInCatchVariables']) {
    expect(config.compilerOptions[name]).not.toBe(false);
  }
});

test('new source files resolve the alias and retain exact exported types', () => {
  withSource("import {available, type Stock} from '@app/model';\nconst stock: Stock = {sku:'x',quantity:2};\nconst ok: boolean = available(stock);\n", () => {
    const result = tsc(); expect(result.output).toBe(''); expect(result.status).toBe(0);
  });
  withSource("import type {Stock} from '@app/model';\nconst stock: Stock = {sku:'x',quantity:'wrong'};\n", () => {
    const result = tsc(); expect(result.status).not.toBe(0);
    expect(result.output).toMatch(/holdout-probe\.ts.*TS2322/);
    expect(result.output).toContain("Type 'string' is not assignable to type 'number'");
    expect(result.output).not.toMatch(/TS2307/);
  });
});

test('implicit any and nullability errors cannot be hidden by an empty project', () => {
  withSource('export function identity(value) {return value;}\nexport const label: string = null;\n', () => {
    const result = tsc(); expect(result.status).not.toBe(0);
    expect(result.output).toMatch(/holdout-probe\.ts.*TS7006/);
    expect(result.output).toMatch(/holdout-probe\.ts.*TS2322/);
  });
});
