import type Anthropic from '@anthropic-ai/sdk'
import { computerUseTools, computerTool } from '../../tools/computer.definitions'
import { browserTool, webFetchTool, siteCrawlerTool } from '../../tools/browser.definitions'
import { telegramTools } from '../../tools/telegram.definitions'
import { discordTools } from '../../tools/discord.definitions'
import { whatsappTools } from '../../tools/whatsapp.definitions'
import { slackTools } from '../../tools/slack.definitions'
import { lineTools } from '../../tools/line.definitions'
import { feishuTools } from '../../tools/feishu.definitions'
import { serviceTools } from '../../tools/service.definitions'
import { bobbyTools } from '../../tools/bobby.definitions'
import { getMacOSTools } from '../../tools/macos/definitions'
import { getVisualTools } from '../../tools/macos/visual.definitions'
import { mcpService } from '../mcp.service'
import type { MessagePlatform } from './types'

/**
 * Experimental feature flags for tool injection
 */
export interface ExperimentalToolOptions {
  visualModeEnabled?: boolean
  computerUseEnabled?: boolean
}

/**
 * Get tools for a specific platform
 * @param platform The messaging platform
 * @param options Experimental feature options
 */
export function getToolsForPlatform(platform: MessagePlatform, options: ExperimentalToolOptions = {}): Anthropic.Tool[] {
  const { visualModeEnabled = false, computerUseEnabled = false } = options
  
  // Base tools: bash, text editor, download, web search, browser automation
  // Computer tool (mouse/keyboard/screenshot) only when experimentalComputerUse is enabled
  const browserTools = [browserTool, webFetchTool, siteCrawlerTool]
  const baseTools = computerUseEnabled 
    ? [computerTool, ...computerUseTools]
    : [...computerUseTools]
  
  // Add platform-specific tools (macOS mail, calendar, etc.)
  const platformTools = getMacOSTools() // Returns empty array on non-macOS
  
  // Add MCP tools to all platforms
  const mcpTools = mcpService.getTools()
  
  // Service tools and bobby (memory) tools are available on all platforms
  const bobbySvcTools = [...serviceTools, ...bobbyTools]
  
  // Visual tools - only injected when experimentalVisualMode is enabled
  // This keeps the code clean: when disabled, Agent doesn't know visual tools exist
  const visualTools = visualModeEnabled ? getVisualTools() : []
  
  switch (platform) {
    case 'telegram':
      return [...baseTools, ...platformTools, ...visualTools, ...telegramTools, ...bobbySvcTools, ...mcpTools]
    case 'discord':
      return [...baseTools, ...platformTools, ...visualTools, ...discordTools, ...bobbySvcTools, ...mcpTools]
    case 'whatsapp':
      return [...baseTools, ...platformTools, ...visualTools, ...whatsappTools, ...bobbySvcTools, ...mcpTools]
    case 'slack':
      return [...baseTools, ...platformTools, ...visualTools, ...slackTools, ...bobbySvcTools, ...mcpTools]
    case 'line':
      return [...baseTools, ...platformTools, ...visualTools, ...lineTools, ...bobbySvcTools, ...mcpTools]
    case 'feishu':
      return [...baseTools, ...platformTools, ...visualTools, ...feishuTools, ...bobbySvcTools, ...mcpTools]
    case 'local':
    case 'none':
    default:
      return [...baseTools, ...browserTools, ...platformTools, ...visualTools, ...bobbySvcTools, ...mcpTools]
  }
}
