// LLM provider interface; Claude first. The key lives only in this browser's IndexedDB.
export type RuleFeedback = { right: string; missing: string; example: string }
export interface Llm { checkRule(patternBullets: string[], learnerText: string): Promise<RuleFeedback> }

const SCHEMA = {
  type: 'object',
  properties: {
    right: { type: 'string', description: 'What the learner got right, one short sentence.' },
    missing: { type: 'string', description: 'What is missing or wrong, one short sentence. Empty if nothing.' },
    example: { type: 'string', description: 'One Czech example taken from the pattern bullets.' },
  },
  required: ['right', 'missing', 'example'],
  additionalProperties: false,
} as const

export function claudeLlm(apiKey: string): Llm {
  return {
    async checkRule(patternBullets, learnerText) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk') // lazy: keeps first load small
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
      const res = await client.beta.messages.create({
        model: 'claude-opus-5-5',
        max_tokens: 1024,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: 'You check a beginner Czech learner\'s own explanation of a grammar pattern against the reference bullets. ' +
          'Be brief and kind: one sentence each, no lecture. Only use Czech that appears in the reference bullets for the example.',
        messages: [{ role: 'user', content: `Reference pattern:\n${patternBullets.join('\n')}\n\nLearner's explanation:\n${learnerText}` }],
      })
      if (res.stop_reason === 'refusal') throw new Error('The model declined this request.')
      const text = res.content.find((b) => b.type === 'text')
      if (!text || text.type !== 'text') throw new Error('No answer from the model.')
      return JSON.parse(text.text) as RuleFeedback
    },
  }
}
