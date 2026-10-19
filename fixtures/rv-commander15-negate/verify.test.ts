import {test, expect} from 'bun:test';
import {renderStatus} from '../src/cli';

test('no flags reproduce the lost default, but explicit flags still work', () => {
  expect(renderStatus([],'ready')).toBe('ready');
  expect(renderStatus(['--color'],'ready')).toBe('\u001b[32mready\u001b[39m');
  expect(renderStatus(['--no-color'],'ready')).toBe('ready');
  expect(renderStatus(['--tag','release-42'],'ready')).toBe('ready (release-42)');
  expect(renderStatus(['--quiet'],'ready')).toBe('');
});
