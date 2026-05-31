/**
 * Sidebar component types
 */

// Bobby navigation items (all platforms)
export type BobbyNavItem = 'local' | 'telegram' | 'discord' | 'whatsapp' | 'slack' | 'line' | 'feishu' | 'qq' | 'settings'

// Union type for all possible nav items
export type NavItem = BobbyNavItem

// Sidebar props
export interface BobbySidebarProps {
  activeNav: BobbyNavItem
  onNavChange: (nav: BobbyNavItem) => void
}

// Generic props for the exported Sidebar
export interface SidebarProps {
  activeNav: string
  onNavChange: (nav: string) => void
}
