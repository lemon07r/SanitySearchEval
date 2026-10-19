import {MockLanguageModelV3} from 'ai/test';

export const usage = {
  inputTokens: {total:1, noCache:1, cacheRead:0, cacheWrite:0},
  outputTokens: {total:1, text:1, reasoning:0},
};

export function toolResponse(id = 'call-1', sku = 'sku-7') {
  return {content:[{type:'tool-call' as const, toolCallId:id, toolName:'lookup', input:JSON.stringify({sku})}],
    finishReason:{unified:'tool-calls' as const,raw:undefined}, usage, warnings:[]};
}

export function textResponse(text: string) {
  return {content:[{type:'text' as const,text}],
    finishReason:{unified:'stop' as const,raw:undefined}, usage, warnings:[]};
}

export function catalogModel() {
  return new MockLanguageModelV3({doGenerate: async (options) => {
    const hasToolOutput = options.prompt.some(message => message.role === 'tool');
    if (hasToolOutput) return textResponse('Available: sku-7');
    if (options.toolChoice?.type === 'tool' && options.toolChoice.toolName === 'lookup') return toolResponse();
    return textResponse('Unverified answer');
  }});
}
