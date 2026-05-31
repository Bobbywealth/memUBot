import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ProviderTransport, LLMResponse, Message, Tool } from './base.transport'
import { convertToolsToGemini, convertMessagesToGemini, convertGeminiResponseToAnthropic, createToolUseIdMap } from '../../agent/gemini-adapter'

export interface GoogleTransportConfig {
  apiKey: string
  model: string
  maxTokens: number
  temperature?: number
  /** System instruction passed to Gemini */
  systemInstruction?: string
}

/**
 * ProviderTransport implementation for Google Gemini.
 * Delegates to the existing gemini-adapter for message conversion and response normalization.
 */
export class GoogleTransport implements ProviderTransport {
  readonly provider: 'google' = 'google'
  private config: GoogleTransportConfig
  private genAI: GoogleGenerativeAI

  constructor(config: GoogleTransportConfig) {
    this.config = config
    this.genAI = new GoogleGenerativeAI(config.apiKey)
  }

  name(): string {
    return `Google/${this.config.model}`
  }

  supportsStreaming(): boolean {
    return false
  }

  async complete(messages: Message[], tools?: Tool[]): Promise<LLMResponse> {
    const toolUseIdToName = createToolUseIdMap()
    const geminiTools = convertToolsToGemini(tools ?? [])
    const contents = convertMessagesToGemini(messages, toolUseIdToName)

    const genModel = this.genAI.getGenerativeModel({
      model: this.config.model,
      tools: geminiTools.length > 0 ? geminiTools : undefined,
      generationConfig: {
        maxOutputTokens: this.config.maxTokens,
        temperature: this.config.temperature ?? 0.7,
      },
      ...(this.config.systemInstruction && { systemInstruction: this.config.systemInstruction }),
    })

    const result = await genModel.generateContent({ contents })
    return convertGeminiResponseToAnthropic(result, this.config.model, toolUseIdToName) as LLMResponse
  }
}
