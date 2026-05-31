import OpenAI from 'openai'
import type { ProviderTransport, LLMResponse, Message, Tool } from './base.transport'
import { convertToolsToOpenAI, convertMessagesToOpenAI, convertOpenAIResponseToAnthropic } from '../../agent/openai-adapter'

export interface OpenAITransportConfig {
  apiKey: string
  model: string
  maxTokens: number
  baseUrl?: string
  temperature?: number
}

/**
 * ProviderTransport implementation for OpenAI GPT-4 (and compatible APIs like Ollama, MiniMax).
 * Delegates to the existing openai-adapter for message conversion and response normalization.
 */
export class OpenAITransport implements ProviderTransport {
  readonly provider: 'openai' = 'openai'
  private client: OpenAI
  private model: string
  private maxTokens: number
  private temperature: number

  constructor(config: OpenAITransportConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      ...(config.baseUrl && { baseURL: config.baseUrl }),
    })
    this.model = config.model
    this.maxTokens = config.maxTokens
    this.temperature = config.temperature ?? 0.7
  }

  name(): string {
    return `OpenAI/${this.model}`
  }

  supportsStreaming(): boolean {
    return false
  }

  async complete(messages: Message[], tools?: Tool[]): Promise<LLMResponse> {
    // The openai-adapter expects systemPrompt as first arg and converts messages internally.
    // We extract a placeholder system prompt here; the adapter prepends it to messages.
    // For now we pass an empty system prompt since the agent service handles system prompt
    // injection separately via the messages array.
    const openaiTools = convertToolsToOpenAI(tools ?? [])
    const openaiMessages = convertMessagesToOpenAI('', messages)

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: openaiMessages,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
    })

    return convertOpenAIResponseToAnthropic(completion)
  }
}
