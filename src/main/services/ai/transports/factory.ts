import type { ProviderTransport } from './base.transport'
import { AnthropicTransport } from './anthropic.transport'
import { OpenAITransport } from './openai.transport'
import { GoogleTransport } from './google.transport'
import { loadSettings, type AppSettings, type LLMProvider } from '../../../config/settings.config'
import { compactToolResults } from '../../agent/context'

export interface TransportFactoryResult {
  transport: ProviderTransport
  provider: LLMProvider
  model: string
  maxTokens: number
  systemPrompt: string
  /**
   * Compact old tool results in conversation history before calling the transport.
   * The agent service passes conversation history to this function.
   */
  compactContext?: (messages: unknown[]) => Promise<number>
}

/**
 * Build a ProviderTransport from current app settings.
 * Returns the transport plus metadata needed by the caller.
 */
export async function createTransport(settings?: AppSettings): Promise<TransportFactoryResult> {
  const s = settings ?? await loadSettings()

  switch (s.llmProvider) {
    case 'claude':
    case 'minimax':
    case 'zenmux':
    case 'custom': {
      // For custom provider, detect protocol from baseUrl/model
      if (s.llmProvider === 'custom') {
        const detected = detectProtocol(s.customBaseUrl, s.customModel)
        if (detected === 'openai') return createOpenAITransport(s)
        if (detected === 'google') return createGoogleTransport(s)
      }

      return {
        transport: new AnthropicTransport({
          apiKey: getApiKeyForProvider(s.llmProvider, s),
          model: getModelForProvider(s),
          maxTokens: s.maxTokens,
          temperature: s.temperature,
          baseUrl: getAnthropicBaseUrl(s) || undefined,
          useContextManagement: s.llmProvider === 'claude',
        }),
        provider: s.llmProvider,
        model: getModelForProvider(s),
        maxTokens: s.maxTokens,
        systemPrompt: s.systemPrompt,
        compactContext: async () => 0, // No-op for Claude (uses context management beta)
      }
    }

    case 'ollama':
    case 'openai': {
      return createOpenAITransport(s)
    }

    case 'gemini': {
      return createGoogleTransport(s)
    }

    default: {
      return {
        transport: new AnthropicTransport({
          apiKey: s.claudeApiKey,
          model: s.claudeModel || 'claude-opus-4-5',
          maxTokens: s.maxTokens,
          temperature: s.temperature,
        }),
        provider: s.llmProvider,
        model: s.claudeModel || 'claude-opus-4-5',
        maxTokens: s.maxTokens,
        systemPrompt: s.systemPrompt,
        compactContext: async () => 0,
      }
    }
  }
}

function createOpenAITransport(s: AppSettings): TransportFactoryResult {
  const transport = new OpenAITransport({
    apiKey: s.openaiApiKey,
    model: s.openaiModel || 'gpt-4o',
    maxTokens: s.maxTokens,
    temperature: s.temperature,
    baseUrl: s.openaiBaseUrl || undefined,
  })
  return {
    transport,
    provider: s.llmProvider,
    model: s.openaiModel || 'gpt-4o',
    maxTokens: s.maxTokens,
    systemPrompt: s.systemPrompt,
    compactContext: async (messages) => compactToolResults(messages as any),
  }
}

function createGoogleTransport(s: AppSettings): TransportFactoryResult {
  const transport = new GoogleTransport({
    apiKey: s.geminiApiKey,
    model: s.geminiModel || 'gemini-2.5-pro',
    maxTokens: s.maxTokens,
    temperature: s.temperature,
    systemInstruction: s.systemPrompt || undefined,
  })
  return {
    transport,
    provider: s.llmProvider,
    model: s.geminiModel || 'gemini-2.5-pro',
    maxTokens: s.maxTokens,
    systemPrompt: s.systemPrompt,
    compactContext: async (messages) => compactToolResults(messages as any),
  }
}

function getModelForProvider(s: AppSettings): string {
  switch (s.llmProvider) {
    case 'claude': return s.claudeModel || 'claude-opus-4-5'
    case 'minimax': return s.minimaxModel || 'MiniMax-M2.1'
    case 'zenmux': return s.zenmuxModel || ''
    case 'ollama': return s.ollamaModel || 'llama3'
    case 'openai': return s.openaiModel || 'gpt-4o'
    case 'gemini': return s.geminiModel || 'gemini-2.5-pro'
    case 'custom': return s.customModel || ''
    default: return 'claude-opus-4-5'
  }
}

function getApiKeyForProvider(provider: LLMProvider, s: AppSettings): string {
  switch (provider) {
    case 'claude': return s.claudeApiKey
    case 'minimax': return s.minimaxApiKey
    case 'zenmux': return s.zenmuxApiKey
    case 'custom': return s.customApiKey
    default: return ''
  }
}

function getAnthropicBaseUrl(s: AppSettings): string | undefined {
  switch (s.llmProvider) {
    case 'claude': return undefined
    case 'minimax': return 'https://api.minimaxi.com/anthropic'
    case 'zenmux': return 'https://zenmux.ai/api/anthropic'
    case 'ollama': return s.ollamaBaseUrl || 'http://localhost:11434/v1'
    case 'custom': return s.customBaseUrl || undefined
    default: return undefined
  }
}

function detectProtocol(baseUrl: string | undefined, model: string): 'anthropic' | 'openai' | 'google' {
  if (baseUrl && /anthropic/i.test(baseUrl)) return 'anthropic'
  if (!baseUrl && /^gemini/i.test(model)) return 'google'
  return 'openai'
}
