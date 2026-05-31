import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import fetch from 'node-fetch'

/**
 * Skill categories for organization
 */
export type SkillCategory = 
  | 'platform-specific'  // macOS, Windows, Linux specific
  | 'business'           // Business/professional workflows
  | 'utility'            // General utilities
  | 'productivity'       // Productivity tools
  | 'communication'      // Messaging/communication
  | 'development'        // Developer tools
  | 'curated'            // OpenAI curated skills
  | 'experimental'       // Experimental/skills
  | 'system'             // System-level skills
  | 'unknown'            // Uncategorized

/**
 * Skill platform requirement
 */
export type SkillPlatform = 'macos' | 'windows' | 'linux' | 'all'

/**
 * Trigger phrase for skill matching
 */
export interface SkillTrigger {
  keywords: string[]       // Keywords that trigger this skill
  patterns: string[]        // Regex patterns (optional)
  examples: string[]        // Example user phrases
  score: number             // Base relevance score (0-1)
}

/**
 * Parsed skill sections from SKILL.md
 */
export interface SkillSections {
  whenToUse?: string        // ## When to Use content
  contract?: string         // ## Contract content (do's and don'ts)
  helper?: string           // ## Helper content (reference/scripts)
  pitfalls?: string         // ## Pitfalls content (common failures)
}

/**
 * Skill metadata from SKILL.md frontmatter
 */
export interface SkillMetadata {
  name: string
  description: string
  shortDescription?: string
  category?: SkillCategory
  platform?: SkillPlatform
}

/**
 * Full skill contract with structured sections for agent consumption
 */
export interface SkillContract {
  metadata: SkillMetadata
  sections: SkillSections
  triggers: SkillTrigger[]
  rawContent: string
}

/**
 * Local skill information
 */
export interface LocalSkill {
  id: string
  name: string
  description: string
  path: string
  enabled: boolean
  source: 'local' | 'github'
  installedAt?: string
  category?: SkillCategory
  platform?: SkillPlatform
  triggers?: SkillTrigger[]
}

/**
 * Skill manifest entry for fast startup discovery
 */
export interface SkillManifestEntry {
  id: string
  name: string
  description: string
  category: SkillCategory
  platform: SkillPlatform
  triggers: SkillTrigger[]
  path: string
  source: 'local' | 'github' | 'builtin'
  lastModified?: string
}

/**
 * Skill manifest for fast startup discovery
 */
export interface SkillManifest {
  version: string
  generated: string
  skills: SkillManifestEntry[]
}

/**
 * GitHub skill from openai/skills repository
 */
export interface GitHubSkill {
  name: string
  path: string
  description?: string
  readme?: string
  category?: string // e.g., 'curated', 'experimental', 'system'
}

/**
 * Skills configuration
 */
interface SkillsConfig {
  enabledSkills: string[]
  disabledSkills: string[]
  githubToken?: string // Optional GitHub token for higher rate limits
}

/**
 * Cached GitHub skills data
 */
interface GitHubSkillsCache {
  skills: GitHubSkill[]
  timestamp: number
}

// Cache duration: 10 minutes
const CACHE_DURATION_MS = 10 * 60 * 1000

// Common words to exclude from keyword extraction
const STOP_WORDS = new Set([
  'that', 'this', 'with', 'from', 'when', 'have', 'been', 'will',
  'would', 'could', 'should', 'what', 'which', 'your', 'they',
  'them', 'their', 'there', 'where', 'when', 'while', 'about',
  'after', 'before', 'between', 'into', 'through', 'during', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'above',
  'below', 'other', 'some', 'such', 'only', 'same', 'than', 'too',
  'very', 'just', 'also', 'now', 'even', 'still', 'always', 'never'
])

/**
 * Service for managing agent skills
 */
class SkillsService {
  private skillsDir: string
  private configPath: string
  private manifestPath: string
  private config: SkillsConfig = { enabledSkills: [], disabledSkills: [] }
  private initialized = false
  private githubSkillsCache: GitHubSkillsCache | null = null
  private userAgent: string = 'bobby-bot'
  private manifest: SkillManifest | null = null
  private skillContractsCache: Map<string, SkillContract> = new Map()

  constructor() {
    const userDataPath = app.getPath('userData')
    this.skillsDir = path.join(userDataPath, 'skills')
    this.configPath = path.join(userDataPath, 'skills-config.json')
    this.manifestPath = path.join(userDataPath, 'skills-manifest.json')
  }

  /**
   * Initialize the skills service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // Ensure skills directory exists
    await fs.mkdir(this.skillsDir, { recursive: true })

    // Load configuration
    await this.loadConfig()

    // Load manifest for fast startup discovery
    await this.loadManifest()

    this.initialized = true
    console.log('[Skills] Service initialized, skills directory:', this.skillsDir)
  }

  /**
   * Load skills configuration
   */
  private async loadConfig(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8')
      this.config = JSON.parse(data)
    } catch {
      // Config doesn't exist, use defaults
      this.config = { enabledSkills: [], disabledSkills: [] }
    }
  }

  /**
   * Save skills configuration
   */
  private async saveConfig(): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2))
  }

  /**
   * Parse SKILL.md frontmatter
   */
  private parseSkillMd(content: string): SkillMetadata | null {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (!frontmatterMatch) return null

    const frontmatter = frontmatterMatch[1]
    const metadata: Partial<SkillMetadata> = {}

    // Parse YAML-like frontmatter
    const lines = frontmatter.split('\n')
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/)
      if (match) {
        const [, key, value] = match
        if (key === 'name') metadata.name = value.trim()
        if (key === 'description') metadata.description = value.trim()
        if (key === 'short-description') metadata.shortDescription = value.trim()
        if (key === 'category') metadata.category = value.trim() as SkillCategory
        if (key === 'platform') metadata.platform = value.trim() as SkillPlatform
      }
    }

    if (metadata.name && metadata.description) {
      return metadata as SkillMetadata
    }
    return null
  }

  /**
   * Parse skill sections from SKILL.md content
   * Extracts ## When to Use, ## Contract, ## Helper, ## Pitfalls
   */
  parseSkillSections(content: string): SkillSections {
    const sections: SkillSections = {}

    // Extract ## When to Use
    const whenToUseMatch = content.match(/## When to Use\n([\s\S]*?)(?=^## |\n## |\Z)/m)
    if (whenToUseMatch) {
      sections.whenToUse = whenToUseMatch[1].trim()
    }

    // Extract ## Contract
    const contractMatch = content.match(/## Contract\n([\s\S]*?)(?=^## |\n## |\Z)/m)
    if (contractMatch) {
      sections.contract = contractMatch[1].trim()
    }

    // Extract ## Helper
    const helperMatch = content.match(/## Helper\n([\s\S]*?)(?=^## |\n## |\Z)/m)
    if (helperMatch) {
      sections.helper = helperMatch[1].trim()
    }

    // Extract ## Pitfalls
    const pitfallsMatch = content.match(/## Pitfalls\n([\s\S]*?)(?=^## |\n## |\Z)/m)
    if (pitfallsMatch) {
      sections.pitfalls = pitfallsMatch[1].trim()
    }

    return sections
  }

  /**
   * Extract trigger phrases from "When to Use" section
   * Returns structured data for skill matching
   */
  getSkillTriggers(skillId: string, content: string): SkillTrigger[] {
    const triggers: SkillTrigger[] = []
    const whenToUseMatch = content.match(/## When to Use\n([\s\S]*?)(?=^## |\n## |\Z)/m)
    
    if (!whenToUseMatch) return triggers

    const whenToUseContent = whenToUseMatch[1]
    
    // Extract bullet points as trigger examples
    const bulletRegex = /[-*]\s*(.+)/g
    const examples: string[] = []
    let match
    while ((match = bulletRegex.exec(whenToUseContent)) !== null) {
      examples.push(match[1].trim())
    }

    // Extract keywords from content (simple word extraction)
    const words = whenToUseContent
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOP_WORDS.has(w))

    const uniqueKeywords = [...new Set(words)].slice(0, 20)

    triggers.push({
      keywords: uniqueKeywords,
      patterns: [],
      examples: examples.slice(0, 10),
      score: 1.0
    })

    return triggers
  }

  /**
   * Get full skill contract with structured sections
   * Used for lazy loading and agent consumption
   */
  async getSkillContract(skillId: string, skillPath?: string): Promise<SkillContract | null> {
    // Check cache first
    if (this.skillContractsCache.has(skillId)) {
      return this.skillContractsCache.get(skillId)!
    }

    const basePath = skillPath || path.join(this.skillsDir, skillId)
    const skillMdPath = path.join(basePath, 'SKILL.md')

    try {
      const content = await fs.readFile(skillMdPath, 'utf-8')
      const metadata = this.parseSkillMd(content)

      if (!metadata) return null

      const sections = this.parseSkillSections(content)
      const triggers = this.getSkillTriggers(skillId, content)

      const contract: SkillContract = {
        metadata,
        sections,
        triggers,
        rawContent: content
      }

      // Cache the contract
      this.skillContractsCache.set(skillId, contract)

      return contract
    } catch {
      return null
    }
  }

  /**
   * Clear skill contract cache (call when skills change)
   */
  clearContractsCache(): void {
    this.skillContractsCache.clear()
  }

  /**
   * Get all installed skills
   */
  async getInstalledSkills(): Promise<LocalSkill[]> {
    await this.initialize()

    const skills: LocalSkill[] = []

    try {
      const entries = await fs.readdir(this.skillsDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const skillPath = path.join(this.skillsDir, entry.name)
        const skillMdPath = path.join(skillPath, 'SKILL.md')

        try {
          const content = await fs.readFile(skillMdPath, 'utf-8')
          const metadata = this.parseSkillMd(content)

          if (metadata) {
            const isDisabled = this.config.disabledSkills.includes(entry.name)
            skills.push({
              id: entry.name,
              name: metadata.name,
              description: metadata.description,
              path: skillPath,
              enabled: !isDisabled,
              source: 'local'
            })
          }
        } catch {
          // SKILL.md doesn't exist or can't be read
        }
      }
    } catch (error) {
      console.error('[Skills] Failed to read skills directory:', error)
    }

    return skills
  }

  /**
   * Enable or disable a skill
   */
  async setSkillEnabled(skillId: string, enabled: boolean): Promise<boolean> {
    await this.initialize()

    if (enabled) {
      this.config.disabledSkills = this.config.disabledSkills.filter((id) => id !== skillId)
    } else {
      if (!this.config.disabledSkills.includes(skillId)) {
        this.config.disabledSkills.push(skillId)
      }
    }

    await this.saveConfig()
    return true
  }

  /**
   * Delete a skill
   */
  async deleteSkill(skillId: string): Promise<boolean> {
    await this.initialize()

    const skillPath = path.join(this.skillsDir, skillId)

    try {
      await fs.rm(skillPath, { recursive: true, force: true })
      this.config.disabledSkills = this.config.disabledSkills.filter((id) => id !== skillId)
      await this.saveConfig()
      // Clear contracts cache and rebuild manifest
      this.clearContractsCache()
      this.manifest = null
      await this.saveManifest()
      return true
    } catch (error) {
      console.error('[Skills] Failed to delete skill:', error)
      return false
    }
  }

  /**
   * Validate a skill directory
   * Returns skill metadata if valid, null otherwise
   */
  async validateSkillDirectory(dirPath: string): Promise<SkillMetadata | null> {
    const skillMdPath = path.join(dirPath, 'SKILL.md')

    try {
      const content = await fs.readFile(skillMdPath, 'utf-8')
      const metadata = this.parseSkillMd(content)

      if (!metadata || !metadata.name) {
        console.log('[Skills] Invalid SKILL.md: missing name')
        return null
      }

      return metadata
    } catch (error) {
      console.log('[Skills] No SKILL.md found in directory')
      return null
    }
  }

  /**
   * Import a skill from a local directory
   * Validates the skill format and copies to the skills directory
   */
  async importFromDirectory(sourcePath: string): Promise<LocalSkill | null> {
    await this.initialize()

    // Validate the skill directory
    const metadata = await this.validateSkillDirectory(sourcePath)
    if (!metadata) {
      return null
    }

    // Use folder name as skill ID
    const skillId = path.basename(sourcePath).toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const destPath = path.join(this.skillsDir, skillId)

    // Check if skill already exists
    try {
      await fs.access(destPath)
      console.log('[Skills] Skill already exists:', skillId)
      // Could choose to overwrite or return error
      // For now, let's overwrite
      await fs.rm(destPath, { recursive: true, force: true })
    } catch {
      // Directory doesn't exist, that's fine
    }

    try {
      // Copy the entire directory
      await this.copyDirectory(sourcePath, destPath)

      // Clear contracts cache and rebuild manifest
      this.clearContractsCache()
      this.manifest = null
      await this.saveManifest()

      return {
        id: skillId,
        name: metadata.name,
        description: metadata.description || '',
        path: destPath,
        enabled: true,
        source: 'local',
        installedAt: new Date().toISOString()
      }
    } catch (error) {
      console.error('[Skills] Failed to create skill:', error)
      return null
    }
  }

  /**
   * Copy a directory recursively
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true })
    const entries = await fs.readdir(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath)
      } else {
        await fs.copyFile(srcPath, destPath)
      }
    }
  }

  /**
   * Get GitHub API headers with optional token
   */
  private getGitHubHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': this.userAgent
    }
    if (this.config.githubToken) {
      headers['Authorization'] = `Bearer ${this.config.githubToken}`
    }
    return headers
  }

  /**
   * Set GitHub token for higher rate limits
   */
  async setGitHubToken(token: string | undefined): Promise<void> {
    await this.initialize()
    this.config.githubToken = token
    await this.saveConfig()
    // Clear cache when token changes
    this.githubSkillsCache = null
    console.log('[Skills] GitHub token updated')
  }

  /**
   * Get current GitHub token
   */
  async getGitHubToken(): Promise<string | undefined> {
    await this.initialize()
    return this.config.githubToken
  }

  /**
   * Fetch all GitHub skills and cache them
   */
  private async fetchAllGitHubSkills(): Promise<GitHubSkill[]> {
    const skills: GitHubSkill[] = []
    const categories = ['.curated', '.experimental', '.system']

    // Fetch skills from each category
    for (const category of categories) {
      try {
        const response = await fetch(
          `https://api.github.com/repos/openai/skills/contents/skills/${category}`,
          { headers: this.getGitHubHeaders() }
        )

        if (!response.ok) {
          if (response.status === 403) {
            console.log(`[Skills] Rate limited for category ${category}. Consider adding a GitHub token.`)
          } else {
            console.log(`[Skills] Category ${category} not accessible:`, response.status)
          }
          continue
        }

        const contents = (await response.json()) as Array<{
          name: string
          path: string
          type: string
        }>

        // Filter directories (actual skills)
        const skillDirs = contents.filter(
          (item) => item.type === 'dir' && !item.name.startsWith('.')
        )

        // Get skill metadata for each directory
        for (const dir of skillDirs) {
          try {
            const skillMdResponse = await fetch(
              `https://raw.githubusercontent.com/openai/skills/main/${dir.path}/SKILL.md`,
              { headers: { 'User-Agent': this.userAgent } }
            )

            // Extract category name (remove leading dot)
            const categoryName = category.replace(/^\./, '')

            if (skillMdResponse.ok) {
              const content = await skillMdResponse.text()
              const metadata = this.parseSkillMd(content)

              skills.push({
                name: metadata?.name || dir.name,
                path: dir.path,
                description: metadata?.description || `Skill: ${dir.name}`,
                readme: content,
                category: categoryName
              })
            } else {
              // No SKILL.md, add with basic info
              skills.push({
                name: dir.name,
                path: dir.path,
                description: `Skill: ${dir.name}`,
                category: categoryName
              })
            }
          } catch {
            // Skip skills that fail to fetch
          }
        }
      } catch (error) {
        console.error(`[Skills] Failed to fetch category ${category}:`, error)
      }
    }

    return skills
  }

  /**
   * Search skills from openai/skills GitHub repository
   * Repository structure: skills/.system/, skills/.curated/, skills/.experimental/
   * Uses caching to avoid rate limits
   */
  async searchGitHubSkills(query: string): Promise<GitHubSkill[]> {
    await this.initialize()

    // Check if cache is valid
    const now = Date.now()
    if (
      this.githubSkillsCache &&
      now - this.githubSkillsCache.timestamp < CACHE_DURATION_MS
    ) {
      console.log('[Skills] Using cached GitHub skills')
      const cached = this.githubSkillsCache.skills

      // Filter by query
      if (query) {
        return cached
          .filter(
            (skill) =>
              skill.name.toLowerCase().includes(query.toLowerCase()) ||
              skill.description?.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 30)
      }
      return cached.slice(0, 30)
    }

    // Fetch and cache all skills
    console.log('[Skills] Fetching GitHub skills...')
    try {
      const skills = await this.fetchAllGitHubSkills()
      this.githubSkillsCache = { skills, timestamp: now }
      console.log(`[Skills] Cached ${skills.length} GitHub skills`)

      // Filter by query
      if (query) {
        return skills
          .filter(
            (skill) =>
              skill.name.toLowerCase().includes(query.toLowerCase()) ||
              skill.description?.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 30)
      }
      return skills.slice(0, 30)
    } catch (error) {
      console.error('[Skills] Failed to search GitHub skills:', error)
      return []
    }
  }

  /**
   * Install a skill from openai/skills GitHub repository
   */
  async installFromGitHub(skillPath: string): Promise<LocalSkill | null> {
    await this.initialize()

    try {
      // Get all files in the skill directory
      const response = await fetch(
        `https://api.github.com/repos/openai/skills/contents/${skillPath}`,
        { headers: this.getGitHubHeaders() }
      )

      if (!response.ok) {
        console.error('[Skills] Failed to fetch skill contents:', response.status)
        return null
      }

      const contents = (await response.json()) as Array<{
        name: string
        path: string
        type: string
        download_url: string | null
      }>

      // Create local skill directory
      const skillId = path.basename(skillPath)
      const localSkillPath = path.join(this.skillsDir, skillId)
      await fs.mkdir(localSkillPath, { recursive: true })

      // Download all files
      for (const item of contents) {
        if (item.type === 'file' && item.download_url) {
          const fileResponse = await fetch(item.download_url, {
            headers: { 'User-Agent': this.userAgent }
          })
          if (fileResponse.ok) {
            const content = await fileResponse.text()
            await fs.writeFile(path.join(localSkillPath, item.name), content)
          }
        } else if (item.type === 'dir') {
          // Recursively download subdirectories
          await this.downloadGitHubDirectory(item.path, path.join(localSkillPath, item.name))
        }
      }

      // Read SKILL.md to get metadata
      const skillMdPath = path.join(localSkillPath, 'SKILL.md')
      try {
        const content = await fs.readFile(skillMdPath, 'utf-8')
        const metadata = this.parseSkillMd(content)

        if (metadata) {
          return {
            id: skillId,
            name: metadata.name,
            description: metadata.description,
            path: localSkillPath,
            enabled: true,
            source: 'github',
            installedAt: new Date().toISOString()
          }
        }
      } catch {
        // SKILL.md not found
      }

      return {
        id: skillId,
        name: skillId,
        description: `Installed from openai/skills`,
        path: localSkillPath,
        enabled: true,
        source: 'github',
        installedAt: new Date().toISOString()
      }
    } catch (error) {
      console.error('[Skills] Failed to install from GitHub:', error)
      return null
    }
  }

  /**
   * Download a GitHub directory recursively
   */
  private async downloadGitHubDirectory(
    githubPath: string,
    localPath: string
  ): Promise<void> {
    await fs.mkdir(localPath, { recursive: true })

    const response = await fetch(
      `https://api.github.com/repos/openai/skills/contents/${githubPath}`,
      { headers: this.getGitHubHeaders() }
    )

    if (!response.ok) return

    const contents = (await response.json()) as Array<{
      name: string
      path: string
      type: string
      download_url: string | null
    }>

    for (const item of contents) {
      if (item.type === 'file' && item.download_url) {
        const fileResponse = await fetch(item.download_url, {
          headers: { 'User-Agent': this.userAgent }
        })
        if (fileResponse.ok) {
          const content = await fileResponse.text()
          await fs.writeFile(path.join(localPath, item.name), content)
        }
      } else if (item.type === 'dir') {
        await this.downloadGitHubDirectory(item.path, path.join(localPath, item.name))
      }
    }
  }

  /**
   * Get skill content for agent context
   */
  async getSkillContent(skillId: string): Promise<string | null> {
    await this.initialize()

    const skillPath = path.join(this.skillsDir, skillId, 'SKILL.md')
    try {
      return await fs.readFile(skillPath, 'utf-8')
    } catch {
      return null
    }
  }

  /**
   * Get all enabled skills content for agent context
   */
  async getEnabledSkillsContent(): Promise<string> {
    const skills = await this.getInstalledSkills()
    const enabledSkills = skills.filter((s) => s.enabled)

    if (enabledSkills.length === 0) return ''

    const contents: string[] = []
    for (const skill of enabledSkills) {
      const content = await this.getSkillContent(skill.id)
      if (content) {
        const skillDir = path.join(this.skillsDir, skill.id).replace(/\\/g, '/')
        const skillEnv = path.join(this.skillsDir, skill.id, '.env').replace(/\\/g, '/')
        const resolvedContent = content
          .replace(/\{SKILL_DIR\}/g, skillDir)
          .replace(/\{SKILL_ENV\}/g, skillEnv)
        contents.push(`\n--- SKILL: ${skill.name} ---\n${resolvedContent}\n`)
      }
    }

    return contents.length > 0
      ? `\n\n## Available Skills\n\nYou have access to the following skills:\n${contents.join('\n')}`
      : ''
  }

  /**
   * Read environment variables from a skill's .env file
   */
  async readSkillEnv(skillId: string): Promise<Record<string, string>> {
    await this.initialize()
    const envPath = path.join(this.skillsDir, skillId, '.env')
    try {
      const content = await fs.readFile(envPath, 'utf-8')
      const result: Record<string, string> = {}
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIndex = trimmed.indexOf('=')
        if (eqIndex > 0) {
          result[trimmed.slice(0, eqIndex).trim()] = trimmed.slice(eqIndex + 1).trim()
        }
      }
      return result
    } catch {
      return {}
    }
  }

  /**
   * Write environment variables to a skill's .env file
   */
  async writeSkillEnv(skillId: string, envVars: Record<string, string>): Promise<void> {
    await this.initialize()
    const envPath = path.join(this.skillsDir, skillId, '.env')
    const content = Object.entries(envVars)
      .filter(([key]) => key.trim())
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')
    await fs.writeFile(envPath, content, 'utf-8')
    console.log(`[Skills] Wrote .env for skill: ${skillId}`)
  }

  /**
   * Get skills directory path
   */
  getSkillsDir(): string {
    return this.skillsDir
  }

  /**
   * Load skill manifest from disk (fast startup discovery)
   */
  async loadManifest(): Promise<SkillManifest | null> {
    try {
      const data = await fs.readFile(this.manifestPath, 'utf-8')
      this.manifest = JSON.parse(data)
      return this.manifest
    } catch {
      return null
    }
  }

  /**
   * Save skill manifest to disk
   */
  async saveManifest(): Promise<void> {
    const manifest: SkillManifest = {
      version: '1.0',
      generated: new Date().toISOString(),
      skills: []
    }

    // Scan installed skills and build manifest
    const installedSkills = await this.getInstalledSkills()
    for (const skill of installedSkills) {
      const contract = await this.getSkillContract(skill.id, skill.path)
      if (contract) {
        manifest.skills.push({
          id: skill.id,
          name: contract.metadata.name,
          description: contract.metadata.description,
          category: contract.metadata.category || 'unknown',
          platform: contract.metadata.platform || 'all',
          triggers: contract.triggers,
          path: skill.path,
          source: skill.source
        })
      }
    }

    this.manifest = manifest
    await fs.writeFile(this.manifestPath, JSON.stringify(manifest, null, 2))
    console.log(`[Skills] Manifest saved with ${manifest.skills.length} skills`)
  }

  /**
   * Get cached manifest (loads on demand)
   */
  async getManifest(): Promise<SkillManifest | null> {
    if (!this.manifest) {
      this.manifest = await this.loadManifest()
    }
    return this.manifest
  }

  /**
   * Score a skill against a query string for relevance matching
   * Returns a score from 0 to 1 (higher = more relevant)
   */
  scoreSkillAgainstQuery(skill: SkillManifestEntry, query: string): number {
    const queryLower = query.toLowerCase()
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)
    
    let score = 0
    let maxPossibleScore = 0

    // Check triggers (highest weight - 60% max)
    for (const trigger of skill.triggers) {
      maxPossibleScore += 0.6
      
      // Check keywords
      for (const keyword of trigger.keywords) {
        if (queryLower.includes(keyword.toLowerCase())) {
          score += 0.3 / Math.max(trigger.keywords.length, 1)
        }
      }
      
      // Check examples (higher weight)
      for (const example of trigger.examples) {
        const exampleLower = example.toLowerCase()
        if (exampleLower.includes(queryLower) || queryLower.includes(exampleLower)) {
          score += 0.2
        }
        // Partial word match
        for (const word of queryWords) {
          if (exampleLower.includes(word)) {
            score += 0.05
          }
        }
      }
    }

    // Check name and description (40% max)
    maxPossibleScore += 0.4
    const nameMatch = skill.name.toLowerCase().includes(queryLower)
    const descMatch = skill.description.toLowerCase().includes(queryLower)
    
    if (nameMatch) score += 0.3
    if (descMatch) score += 0.1

    // Normalize to 0-1 range
    return maxPossibleScore > 0 ? Math.min(score / maxPossibleScore, 1) : 0
  }

  /**
   * Match skills against a query string using trigger scoring
   * Returns skills sorted by relevance score (lazy loading friendly)
   */
  async matchSkills(query: string, limit: number = 5): Promise<Array<{ skill: SkillManifestEntry; score: number }>> {
    await this.initialize()
    
    const manifest = await this.getManifest()
    if (!manifest || manifest.skills.length === 0) {
      return []
    }

    const results: Array<{ skill: SkillManifestEntry; score: number }> = []

    for (const skill of manifest.skills) {
      const score = this.scoreSkillAgainstQuery(skill, query)
      if (score > 0.1) { // Minimum threshold
        results.push({ skill, score })
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score)

    return results.slice(0, limit)
  }

  /**
   * Get matched skill content for agent context (lazy loading)
   * Only loads skills that match the query above threshold
   */
  async getMatchedSkillsContent(query: string, threshold: number = 0.3): Promise<string> {
    const matched = await this.matchSkills(query, 10)
    
    if (matched.length === 0) return ''

    const contents: string[] = []
    for (const { skill, score } of matched) {
      if (score < threshold) continue
      
      try {
        const content = await this.getSkillContent(skill.id)
        if (content) {
          const skillDir = skill.path.replace(/\\/g, '/')
          const resolvedContent = content.replace(/\{\{SKILL_DIR\}\}/g, skillDir)
          
          // Format with score indicator
          contents.push(`\n--- SKILL: ${skill.name} (relevance: ${(score * 100).toFixed(0)}%) ---\n${resolvedContent}\n`)
        }
      } catch {
        // Skill content unavailable
      }
    }

    return contents.length > 0
      ? `\n\n## Relevant Skills\n\nBased on your request, the following skills are relevant:\n${contents.join('\n')}`
      : ''
  }

  /**
   * Extract pitfalls from a skill's ## Pitfalls section
   * Returns formatted warnings for agent consumption
   */
  async getSkillPitfalls(skillId: string): Promise<string[]> {
    const contract = await this.getSkillContract(skillId)
    if (!contract || !contract.sections.pitfalls) {
      return []
    }

    const pitfalls: string[] = []
    const lines = contract.sections.pitfalls.split('\n')
    
    for (const line of lines) {
      const trimmed = line.trim()
      // Extract bullet points and common mistake patterns
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        pitfalls.push(trimmed.substring(1).trim())
      } else if (trimmed.match(/^\d+\./)) {
        pitfalls.push(trimmed.replace(/^\d+\.\s*/, '').trim())
      } else if (trimmed.length > 10) {
        pitfalls.push(trimmed)
      }
    }

    return pitfalls
  }

  /**
   * Inject skill pitfalls as warnings into the system prompt
   */
  async getPitfallsWarnings(skillIds: string[]): Promise<string> {
    const allPitfalls: string[] = []
    
    for (const skillId of skillIds) {
      const pitfalls = await this.getSkillPitfalls(skillId)
      allPitfalls.push(...pitfalls)
    }

    if (allPitfalls.length === 0) return ''

    const uniquePitfalls = [...new Set(allPitfalls)]
    return `\n\n## ⚠️ Skill Pitfalls to Avoid\n\n${uniquePitfalls.map(p => `- ${p}`).join('\n')}`
  }
}

export const skillsService = new SkillsService()
