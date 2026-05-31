import type Anthropic from '@anthropic-ai/sdk'

/**
 * Shared types for all ProviderTransport implementations.
 * The LLMResponse mirrors Anthropic.Message so callers can work with
 * a uniform response shape regardless of which provider was used.
 */
export interface LLMResponse {
  id: string
  type: 'message'
  role: 'assistant'
  content: Anthropic.ContentBlock[]
  model: string
  stop_reason: 'end_turn' | 'tool_use' | 'stop_sequence' | 'max_tokens' | 'pause_turn' | null
  stop_sequence: string | null
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

/**
 * Tool definition in Anthropic format (used across all transports)
 */
export type Tool = Anthropic.Tool

/**
 * Message in Anthropic format
 */
export type Message = Anthropic.MessageParam

/**
 * Supported LLM providers in the transport layer
 */
export type ProviderType = 'anthropic' | 'openai' | 'google'

/**
 * ProviderTransport interface - abstracts all LLM providers behind
 * a single `complete()` method that returns a unified LLMResponse.
 *
 * Existing adapters (openai-adapter, gemini-adapter) already convert
 * provider responses to Anthropic.Message shape, so LLMResponse matches
 * that contract.
 */
export interface ProviderTransport {
  /** Which provider this transport uses */
  provider: ProviderType

  /**
   * Send a completion request to the LLM.
   * @param messages Conversation history (Anthropic.MessageParam format)
   * @param tools Optional tool definitions for function calling
   * @param systemPrompt Optional system instruction. Each transport handles it
   *                    according to its provider's API (system param, systemInstruction, etc.)
   * @returns Unified LLMResponse (Anthropic.Message-compatible)
   */
  complete(messages: Message[], tools?: Tool[], systemPrompt?: string): Promise<LLMResponse>

  /** Human-readable name of this transport */
  name(): string

  /** Whether this transport supports streaming responses */
  supportsStreaming(): boolean
}
