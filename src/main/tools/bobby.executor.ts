type ToolResult = { success: boolean; data?: unknown; error?: string }

export interface BobbyConfig {
  baseUrl: string
  apiKey: string
  userId: string
  agentId: string
}

/**
 * Get Bobby API config from settings.
 */
async function getBobbyConfig(): Promise<BobbyConfig> {
  const { loadSettings } = await import('../config/settings.config')
  const settings = await loadSettings()

  return {
    baseUrl: settings.memuBaseUrl,
    apiKey: settings.memuApiKey,
    userId: settings.memuUserId,
    agentId: settings.memuAgentId
  }
}

/**
 * Execute bobby_memory: retrieve memory by query from the Bobby API.
 */
export async function executeBobbyMemory(query: string): Promise<ToolResult> {
  try {
    const memuConfig = await getBobbyConfig()
    const response = await fetch(`${memuConfig.baseUrl}/api/v3/memory/retrieve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${memuConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: memuConfig.userId,
        agent_id: memuConfig.agentId,
        query
      })
    })
    const result = await response.json()
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Execute a Bobby tool by name
 */
export async function executeBobbyTool(name: string, input: unknown): Promise<ToolResult> {
  switch (name) {
    case 'bobby_memory': {
      const { query } = input as { query: string }
      return await executeBobbyMemory(query)
    }
    default:
      return { success: false, error: `Unknown Bobby tool: ${name}` }
  }
}
