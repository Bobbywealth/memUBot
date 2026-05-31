/**
 * AutoConnect Service
 * Connects configured messaging platforms on app startup
 */
import type { IAutoConnectService } from './types'
import { bobbyAutoConnectService } from './bobby.impl'

// Export the service instance
export const autoConnectService: IAutoConnectService = bobbyAutoConnectService

// Re-export types
export type { IAutoConnectService } from './types'
