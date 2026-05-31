/**
 * Sub-agent delegation pool — bounded async executor like Hermes Agent's ThreadPoolExecutor
 * Runs sub-agents in the same process with a restricted tool whitelist.
 */

import { loadSettings } from '../../config/settings.config'
import { executeTool } from '../../services/agent/tool-executor'
import { createTransport } from '../../services/ai/transports/factory'
import type { MessagePlatform } from '../../services/agent/types'

export interface DelegateOptions {
  goal: string
  context?: string
  tools?: string[]
  maxIterations?: number
  model?: string
}

export interface DelegateResult {
  success: boolean
  data?: unknown
  error?: string
  iterations?: number
}

// Bounded pool — max 3 concurrent sub-agents (like Hermes Agent)
const MAX_CONCURRENT = 3
let activeCount = 0
const waiting: Array<() => void> = []

async function acquireSlot(): Promise<() => void> {
  if (activeCount < MAX_CONCURRENT) {
    activeCount++
    return releaseSlot
  }
  return new Promise<() => void>((resolve) => {
    waiting.push(() => resolve(releaseSlot))
  })
}

function releaseSlot(): void {
  activeCount--
  const next = waiting.shift()
  if (next) {
    activeCount++
    next()
  }
}

async function executeSubAgentTool(
  name: string,
  input: unknown,
  allowedTools: Set<string>
): Promise<{ name: string; result: unknown }> {
  if (allowedTools.size > 0 && !allowedTools.has(name)) {
    return {
      name,
      result: { success: false, error: `Tool "${name}" is not in the allowed tools list` }
    }
  }

  const result = await executeTool(name, input, 'none' as MessagePlatform)
  return { name, result }
}

export async function runDelegate(options: DelegateOptions): Promise<DelegateResult> {
  const release = await acquireSlot()
  try {
    return await runSubAgent(options)
  } finally {
    release()
  }
}

async function runSubAgent(options: DelegateOptions): Promise<DelegateResult> {
  const { goal, context = '', tools: allowedToolNames = [], maxIterations = 30 } = options

  const allowedTools = new Set(allowedToolNames)
  const settings = await loadSettings()
  const maxIters = Math.min(maxIterations, 100)

  const systemPrompt = `You are a focused sub-agent. Your job: ${goal}

${context ? `Context:\n${context}\n` : ''}
${allowedToolNames.length > 0 ? `You have access to these tools: ${allowedToolNames.join(', ')}\n` : 'You have no tools — text reasoning only.\n'}
Rules:
- Be direct and concise
- If a tool fails, report the error and continue
- Return your final answer when done
- Do not ask clarifying questions — make your best attempt`

  let iterations = 0
  let lastText = ''

  try {
    const { transport } = await createTransport(settings)

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: systemPrompt }
    ]

    while (iterations < maxIters) {
      iterations++

      const response = await transport.complete(messages, [])

      const content = response.content

      if (typeof content === 'string') {
        lastText = content
        break
      }

      if (Array.isArray(content)) {
        let hasToolCall = false

        for (const block of content) {
          if (block.type === 'text') {
            lastText = block.text
          } else if (block.type === 'tool_use') {
            hasToolCall = true
            const toolResult = await executeSubAgentTool(block.name, block.input, allowedTools)

            messages.push({
              role: 'assistant',
              content: JSON.stringify(block)
            })
            messages.push({
              role: 'user',
              content: JSON.stringify({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(toolResult.result)
              })
            })
          }
        }

        if (lastText && !hasToolCall) break
        if (hasToolCall) {
          lastText = ''
          continue
        }
      }

      if (!lastText) {
        lastText = typeof content === 'string' ? content : JSON.stringify(content)
      }
      break
    }

    return {
      success: true,
      data: { response: lastText, iterations, goal },
      iterations
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      iterations
    }
  }
}
