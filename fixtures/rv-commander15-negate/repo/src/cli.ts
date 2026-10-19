import {Command} from 'commander';
import {success} from './format';

export function renderStatus(argv: string[], label: string): string {
  const command = new Command()
    .name('deploy-status')
    .option('--no-color', 'Disable colors')
    .option('--color', 'Enable colors')
    .option('--quiet', 'Suppress the status line')
    .option('--tag <tag>', 'Append the deployment tag');
  command.parse(argv, {from: 'user'});
  const options = command.opts();
  if (options.quiet) return '';
  const text = options.tag ? `${label} (${options.tag})` : label;
  return success(text, Boolean(options.color));
}
