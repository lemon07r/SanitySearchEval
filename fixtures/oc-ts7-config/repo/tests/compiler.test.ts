import {test, expect} from 'bun:test';
import {tsc} from './compiler';

test('project typechecks with the installed compiler', () => {
  const result = tsc();
  expect(result.error).toBeUndefined();
  expect(result.output).toBe('');
  expect(result.status).toBe(0);
});
