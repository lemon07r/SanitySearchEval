import {tool, type ToolExecutionOptions} from 'ai';
import {z} from 'zod';

export type LookupAudit = Pick<ToolExecutionOptions<unknown>, 'toolCallId' | 'messages'>;

export function catalogTools(
  lookup: (sku: string) => Promise<string>,
  audit?: (options: LookupAudit) => void,
) {
  return {
    lookup: tool({
      description: 'Look up a product in the catalog',
      inputSchema: z.object({sku: z.string()}),
      execute: async ({sku}, options) => {
        audit?.({toolCallId: options.toolCallId, messages: options.messages});
        return lookup(sku);
      },
    }),
  };
}
