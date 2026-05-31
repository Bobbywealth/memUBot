import Anthropic from '@anthropic-ai/sdk'
import type { ProviderTransport, LLMResponse, Message, Tool } from './base.transport'

export interface AnthropicTransportConfig {
  apiKey: string
  model: string
  maxTokens: number
  baseUrl?: string
  temperature?: number
  /** Enable beta context management (automatically clears old tool results near token limit) */
  useContextManagement?: boolean
}

/**
 * ProviderTransport implementation for Anthropic Claude.
 * Uses the official @anthropic-ai/sdk.
 */
export class AnthropicTransport implements ProviderTransport {
  readonly provider: 'anthropic' = 'anthropic'
  private client: Anthropic
  private model: string
  private maxTokens: number
  private temperature: number
  private useContextManagement: boolean

  constructor(config: AnthropicTransportConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      ...(config.baseUrl && { baseURL: config.baseUrl }),
    })
    this.model = config.model
    this.maxTokens = config.maxTokens
    this.temperature = config.temperature ?? 0.7
    this.useContextManagement = config.useContextManagement ?? false
  }

  name(): string {
    return `Anthropic/${this.model}`
  }

  supportsStreaming(): boolean {
    return false
  }

  async complete(messages: Message[], tools?: Tool[], systemPrompt?: string): Promise<LLMResponse> {
    const params: Anthropic.MessageCreateParams = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages,
      ...(systemPrompt && { system: systemPrompt }),
      ...(tools && tools.length > 0 && { tools }),
      ...(this.temperature !== 0.7 && { temperature: this.temperature }),
    }

    // Use beta context management when enabled (supports automatic tool result clearing)
    if (this.useContextManagement) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const betaParams = {
        ...params,
        betas: ['context-management-2025-06-27'],
        context_management: {
          edits: [
            {
              type: 'clear_tool_uses_20250919' as const,
              trigger: { type: 'input_tokens' as const, value: 100000 },
              keep: { type: 'tool_uses' as const, value: 5 },
              clear_at_least: { type: 'input_tokens' as const, value: 10000 },
            },
          ],
        },
      }
      const response = await (this.client as any).beta.messages.create(betaParams)
      return response as unknown as LLMResponse
    }

    const response = await this.client.messages.create(params)
    return response as unknown as LLMResponse
  }
}
