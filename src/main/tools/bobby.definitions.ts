import type Anthropic from '@anthropic-ai/sdk'

/**
 * Bobby tool definitions — memory retrieval + sub-agent delegation
 * Used by the agent to recall facts, past events, or spawn parallel sub-agents.
 */
export const bobbyTools: Anthropic.Tool[] = [
  {
    name: 'bobby_memory',
    description: 'Retrieve memory based on a query. Use this to recall facts, past events, or context about the user.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'The query to search memory for'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'bobby_delegate',
    description: 'Spawn a sub-agent to work on a task in parallel. Use when you need multiple things done simultaneously or a subtask is complex enough to warrant its own reasoning loop. The sub-agent runs with a restricted tool whitelist you control. Results are returned when the sub-agent completes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        goal: {
          type: 'string',
          description: 'What the sub-agent should accomplish. Be specific and self-contained — the sub-agent knows nothing about this conversation.'
        },
        context: {
          type: 'string',
          description: 'Background information the sub-agent needs: file paths, error messages, credentials, constraints. The more specific, the better.'
        },
        tools: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tool names the sub-agent is allowed to use. If omitted, sub-agent gets no tools (text-only reasoning). Common tools: "bash", "computer", "str_replace_editor", "web_search", "telegram_*", "discord_*".'
        },
        maxIterations: {
          type: 'number',
          description: 'Maximum reasoning iterations for the sub-agent (default: 30, max: 100).'
        },
        model: {
          type: 'string',
          description: 'Model to use for the sub-agent. Examples: "claude-sonnet-4", "gpt-4o", "gemini-2.5-flash". If omitted, uses the configured default.'
        }
      },
      required: ['goal']
    }
  }
]
