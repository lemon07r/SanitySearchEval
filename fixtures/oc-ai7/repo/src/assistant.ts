import {generateText, stepCountIs, type LanguageModel} from 'ai';
import {catalogTools, type LookupAudit} from './tools';

export async function answerQuestion(options: {
  model: LanguageModel;
  question: string;
  lookup: (sku: string) => Promise<string>;
  audit?: (info: LookupAudit) => void;
  maxSteps?: number;
}) {
  const result = await generateText({
    model: options.model,
    prompt: options.question,
    tools: catalogTools(options.lookup, options.audit),
    stopWhen: stepCountIs(options.maxSteps ?? 3),
    experimental_prepareStep: ({stepNumber}: {stepNumber: number}) => ({
      toolChoice: stepNumber === 0 ? {type: 'tool' as const, toolName: 'lookup' as const} : 'auto' as const,
    }),
  });
  return {text: result.text, steps: result.steps.length};
}
