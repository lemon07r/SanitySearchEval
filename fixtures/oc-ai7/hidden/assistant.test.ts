import {test, expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {MockLanguageModelV3} from 'ai/test';
import {answerQuestion} from '../src/assistant';
import {catalogModel, toolResponse, textResponse} from '../tests/model';

test('installed TypeScript accepts the public source types', () => {
  const result = spawnSync('node', [join(process.cwd(),'node_modules/typescript/bin/tsc'),'--noEmit','--pretty','false'],
    {cwd:process.cwd(),encoding:'utf8',timeout:10000});
  expect(result.error).toBeUndefined();
  expect(result.stdout + result.stderr).toBe('');
  expect(result.status).toBe(0);
});

test('first-step policy, prompt and subsequent auto policy reach the SDK model', async () => {
  const model = catalogModel();
  await answerQuestion({model, question:'Check this exact sku-7 question',lookup:async()=>'available'});
  expect(model.doGenerateCalls).toHaveLength(2);
  expect(model.doGenerateCalls[0].toolChoice).toEqual({type:'tool',toolName:'lookup'});
  expect(model.doGenerateCalls[1].toolChoice).toEqual({type:'auto'});
  expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain('Check this exact sku-7 question');
});

test('tool output and execution metadata are forwarded without replacement', async () => {
  const audits: any[] = [];
  const skus: string[] = [];
  let calls = 0;
  const model = new MockLanguageModelV3({doGenerate: async options => {
    calls++;
    if (calls === 1) return toolResponse('audit-42','custom-sku');
    expect(JSON.stringify(options.prompt)).toContain('custom catalog value');
    return textResponse('custom answer');
  }});
  const result = await answerQuestion({model,question:'Custom question',
    lookup:async sku=>{skus.push(sku);return 'custom catalog value';},audit:info=>audits.push(info)});
  expect(result).toEqual({text:'custom answer',steps:2});
  expect(skus).toEqual(['custom-sku']); expect(audits).toHaveLength(1);
  expect(audits[0].toolCallId).toBe('audit-42');
  expect(JSON.stringify(audits[0].messages)).toContain('Custom question');
});

test('caller step limits and the default limit bound repeated tool requests', async () => {
  for (const maxSteps of [1,2,undefined]) {
    let calls = 0; let lookups = 0;
    const model = new MockLanguageModelV3({doGenerate: async () => {
      calls++; if (calls > 5) throw new Error('step limit not enforced');
      return toolResponse(`loop-${calls}`);
    }});
    const result = await answerQuestion({model,question:'Repeated lookup',maxSteps,
      lookup:async()=>{lookups++;return 'yes';}});
    expect(result.steps).toBe(maxSteps ?? 3);
    expect(calls).toBe(maxSteps ?? 3); expect(lookups).toBe(maxSteps ?? 3);
  }
});
