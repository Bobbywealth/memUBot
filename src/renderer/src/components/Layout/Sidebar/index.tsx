/**
 * Sidebar Component
 */
import type { ComponentType } from 'react'
import { BobbySidebar } from './bobby.impl'
import type { BobbyNavItem, BobbySidebarProps } from './types'

// Export the Sidebar component
export const Sidebar = BobbySidebar as ComponentType<{
  activeNav: string
  onNavChange: (nav: string) => void
}>

// Re-export types
export type { BobbyNavItem, BobbySidebarProps }
