import {test, expect} from 'bun:test';
import {answerQuestion} from '../src/assistant';
import {catalogModel} from './model';

test('looks up catalog data before answering', async () => {
  const lookedUp: string[] = [];
  const result = await answerQuestion({model:catalogModel(), question:'Is sku-7 available?',
    lookup: async sku => {lookedUp.push(sku); return 'in stock';}});
  expect(lookedUp).toEqual(['sku-7']);
  expect(result).toEqual({text:'Available: sku-7',steps:2});
});
