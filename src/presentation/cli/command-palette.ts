import { GameDebugger } from '@presentation/cli/debugger'
import { DevConsole } from '@presentation/cli/dev-console'
import { EntityInspector } from '@presentation/cli/entity-inspector'
import { PerformanceProfiler } from '@presentation/cli/performance-profiler'
import { hotReloadManager } from '@presentation/cli/hot-reload'

export interface Command {
  id: string
  name: string
  description: string
  category: string
  keywords: string[]
  shortcut?: string
  icon?: string
  execute: () => void | Promise<void>
  enabled?: () => boolean
}

export interface CommandPaletteConfig {
  maxResults: number
  fuzzySearch: boolean
  showShortcuts: boolean
  showCategories: boolean
  enableHistory: boolean
  maxHistory: number
}

export class CommandPalette {
  private isOpen = false
  private element: HTMLElement | null = null
  private inputElement: HTMLInputElement | null = null
  private resultsElement: HTMLElement | null = null
  private commands: Map<string, Command> = new Map()
  private filteredCommands: Command[] = []
  private selectedIndex = 0
  private searchQuery = ''
  private commandHistory: string[] = []
  private config: CommandPaletteConfig

  constructor(
    private gameDebugger?: GameDebugger,
    private devConsole?: DevConsole,
    private entityInspector?: EntityInspector,
    private performanceProfiler?: PerformanceProfiler,
    config: Partial<CommandPaletteConfig> = {},
  ) {
    this.config = {
      maxResults: 10,
      fuzzySearch: true,
      showShortcuts: true,
      showCategories: true,
      enableHistory: true,
      maxHistory: 50,
      ...config,
    }

    if (import.meta.env.DEV) {
      this.setupCommands()
      this.createPaletteUI()
      this.setupKeyboardShortcuts()
      this.loadHistory()
    }
  }

  private setupCommands(): void {
    // Debug commands
    this.addCommand({
      id: 'debug.toggle',
      name: 'Toggle Debugger',
      description: 'Enable or disable the game debugger',
      category: 'Debug',
      keywords: ['debug', 'toggle', 'enable', 'disable'],
      shortcut: 'F12',
      icon: '🔧',
      execute: () => this.gameDebugger?.toggle(),
      enabled: () => !!this.gameDebugger,
    })

    this.addCommand({
      id: 'debug.pause',
      name: 'Pause Game',
      description: 'Pause game execution for debugging',
      category: 'Debug',
      keywords: ['pause', 'stop', 'freeze'],
      shortcut: 'Ctrl+Shift+P',
      icon: '⏸️',
      execute: () => this.gameDebugger?.togglePause(),
      enabled: () => !!this.gameDebugger,
    })

    this.addCommand({
      id: 'debug.step',
      name: 'Step Frame',
      description: 'Execute one frame step in paused mode',
      category: 'Debug',
      keywords: ['step', 'frame', 'next'],
      shortcut: 'Ctrl+Shift+S',
      icon: '👣',
      execute: () => this.gameDebugger?.stepFrame(),
      enabled: () => !!this.gameDebugger,
    })

    this.addCommand({
      id: 'debug.record',
      name: 'Toggle Recording',
      description: 'Start or stop debug session recording',
      category: 'Debug',
      keywords: ['record', 'capture', 'session'],
      shortcut: 'Ctrl+Shift+R',
      icon: '⏺️',
      execute: () => this.gameDebugger?.toggleRecording(),
      enabled: () => !!this.gameDebugger,
    })

    // Console commands
    this.addCommand({
      id: 'console.toggle',
      name: 'Toggle Developer Console',
      description: 'Open or close the developer console',
      category: 'Console',
      keywords: ['console', 'terminal', 'command'],
      shortcut: 'Ctrl+Shift+D',
      icon: '🖥️',
      execute: () => this.devConsole?.toggle(),
      enabled: () => !!this.devConsole,
    })

    this.addCommand({
      id: 'console.clear',
      name: 'Clear Console',
      description: 'Clear all console output',
      category: 'Console',
      keywords: ['clear', 'clean', 'empty'],
      icon: '🧹',
      execute: () => {
        if (this.devConsole && 'executeCommand' in this.devConsole && typeof this.devConsole.executeCommand === 'function') {
          // Use type assertion with interface check
          ;(this.devConsole as DevConsole & { executeCommand(cmd: string): void }).executeCommand('clear')
        }
      },
      enabled: () => !!this.devConsole,
    })

    // Inspector commands
    this.addCommand({
      id: 'inspector.toggle',
      name: 'Toggle Entity Inspector',
      description: 'Open or close the entity inspector',
      category: 'Inspector',
      keywords: ['inspector', 'entity', 'components'],
      shortcut: 'Ctrl+Shift+I',
      icon: '🔍',
      execute: () => this.entityInspector?.toggle(),
      enabled: () => !!this.entityInspector,
    })

    this.addCommand({
      id: 'inspector.refresh',
      name: 'Refresh Entity List',
      description: 'Refresh the entity inspector list',
      category: 'Inspector',
      keywords: ['refresh', 'reload', 'update'],
      icon: '🔄',
      execute: () => {
        if (this.entityInspector && 'refreshEntityList' in this.entityInspector && typeof this.entityInspector.refreshEntityList === 'function') {
          // Use type assertion with interface check
          ;(this.entityInspector as EntityInspector & { refreshEntityList(): void }).refreshEntityList()
        }
      },
      enabled: () => !!this.entityInspector,
    })

    // Performance commands
    this.addCommand({
      id: 'performance.start',
      name: 'Start Performance Recording',
      description: 'Begin recording performance metrics',
      category: 'Performance',
      keywords: ['performance', 'record', 'metrics', 'fps'],
      icon: '📊',
      execute: () => this.performanceProfiler?.startRecording(),
      enabled: () => !!this.performanceProfiler,
    })

    this.addCommand({
      id: 'performance.stop',
      name: 'Stop Performance Recording',
      description: 'Stop recording and show performance data',
      category: 'Performance',
      keywords: ['performance', 'stop', 'results'],
      icon: '⏹️',
      execute: () => {
        const data = this.performanceProfiler?.stopRecording()
        if (data) {
          console.log('Performance data:', data)
        }
      },
      enabled: () => !!this.performanceProfiler,
    })

    // Hot reload commands
    this.addCommand({
      id: 'reload.page',
      name: 'Reload Page',
      description: 'Reload the entire page',
      category: 'Reload',
      keywords: ['reload', 'refresh', 'page'],
      shortcut: 'F5',
      icon: '🔄',
      execute: () => window.location.reload(),
    })

    this.addCommand({
      id: 'reload.hot',
      name: 'Hot Reload',
      description: 'Trigger hot module replacement',
      category: 'Reload',
      keywords: ['hot', 'reload', 'hmr'],
      shortcut: 'Ctrl+R',
      icon: '🔥',
      execute: () => hotReloadManager.manualReload(),
    })

    this.addCommand({
      id: 'reload.force',
      name: 'Force Reload',
      description: 'Force a complete page reload',
      category: 'Reload',
      keywords: ['force', 'reload', 'hard'],
      shortcut: 'Ctrl+Shift+R',
      icon: '💪',
      execute: () => hotReloadManager.forceReload(),
    })

    // View commands
    this.addCommand({
      id: 'view.fullscreen',
      name: 'Toggle Fullscreen',
      description: 'Enter or exit fullscreen mode',
      category: 'View',
      keywords: ['fullscreen', 'full', 'screen'],
      shortcut: 'F11',
      icon: '🖥️',
      execute: () => {
        if (document.fullscreenElement) {
          document.exitFullscreen()
        } else {
          document.documentElement.requestFullscreen()
        }
      },
    })

    this.addCommand({
      id: 'view.zoom-in',
      name: 'Zoom In',
      description: 'Increase page zoom level',
      category: 'View',
      keywords: ['zoom', 'in', 'magnify'],
      shortcut: 'Ctrl++',
      icon: '🔍',
      execute: () => {
        document.body.style.zoom = `${(parseFloat(document.body.style.zoom || '1') + 0.1).toFixed(1)}`
      },
    })

    this.addCommand({
      id: 'view.zoom-out',
      name: 'Zoom Out',
      description: 'Decrease page zoom level',
      category: 'View',
      keywords: ['zoom', 'out', 'shrink'],
      shortcut: 'Ctrl+-',
      icon: '🔍',
      execute: () => {
        const currentZoom = parseFloat(document.body.style.zoom || '1')
        if (currentZoom > 0.5) {
          document.body.style.zoom = `${(currentZoom - 0.1).toFixed(1)}`
        }
      },
    })

    this.addCommand({
      id: 'view.zoom-reset',
      name: 'Reset Zoom',
      description: 'Reset page zoom to 100%',
      category: 'View',
      keywords: ['zoom', 'reset', 'normal'],
      shortcut: 'Ctrl+0',
      icon: '🔍',
      execute: () => {
        document.body.style.zoom = '1'
      },
    })

    // Memory commands
    this.addCommand({
      id: 'memory.gc',
      name: 'Garbage Collection',
      description: 'Trigger garbage collection (if available)',
      category: 'Memory',
      keywords: ['garbage', 'collection', 'gc', 'memory'],
      icon: '🗑️',
      execute: () => {
        const globalWithGC = globalThis as typeof globalThis & { gc?: () => void }
        if (globalWithGC.gc) {
          globalWithGC.gc()
          console.log('Garbage collection triggered')
        } else {
          console.warn('Garbage collection not available. Use --expose-gc flag.')
        }
      },
    })

    this.addCommand({
      id: 'memory.usage',
      name: 'Show Memory Usage',
      description: 'Display current memory usage information',
      category: 'Memory',
      keywords: ['memory', 'usage', 'heap'],
      icon: '📊',
      execute: () => {
        // @ts-ignore
        const memory = performance.memory
        if (memory) {
          console.log('Memory Usage:')
          console.log(`  Used: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
          console.log(`  Total: ${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
          console.log(`  Limit: ${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`)
        } else {
          console.log('Memory information not available')
        }
      },
    })

    // Settings commands
    this.addCommand({
      id: 'settings.export',
      name: 'Export Settings',
      description: 'Export current development settings',
      category: 'Settings',
      keywords: ['export', 'settings', 'config'],
      icon: '💾',
      execute: () => {
        const settings = {
          debugger: this.gameDebugger?.getState(),
          hotReload: hotReloadManager.getConfig(),
          timestamp: Date.now(),
        }
        const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `dev-settings-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
      },
    })

    this.addCommand({
      id: 'settings.reset',
      name: 'Reset All Settings',
      description: 'Reset all development tools to default settings',
      category: 'Settings',
      keywords: ['reset', 'default', 'settings'],
      icon: '🔄',
      execute: () => {
        if (confirm('Are you sure you want to reset all settings?')) {
          localStorage.removeItem('dev-tools-settings')
          console.log('Settings reset to defaults')
        }
      },
    })

    // Help commands
    this.addCommand({
      id: 'help.shortcuts',
      name: 'Show Keyboard Shortcuts',
      description: 'Display all available keyboard shortcuts',
      category: 'Help',
      keywords: ['help', 'shortcuts', 'keys'],
      icon: '⌨️',
      execute: () => {
        const shortcuts = Array.from(this.commands.values())
          .filter((cmd) => cmd.shortcut)
          .map((cmd) => `${cmd.shortcut}: ${cmd.name}`)
          .join('\n')
        console.log('Keyboard Shortcuts:\n' + shortcuts)
      },
    })

    this.addCommand({
      id: 'help.commands',
      name: 'List All Commands',
      description: 'Show all available commands',
      category: 'Help',
      keywords: ['help', 'commands', 'list'],
      icon: '📋',
      execute: () => {
        const categories = new Map<string, Command[]>()

        this.commands.forEach((cmd) => {
          if (!categories.has(cmd.category)) {
            categories.set(cmd.category, [])
          }
          categories.get(cmd.category)!.push(cmd)
        })

        console.log('Available Commands:')
        categories.forEach((commands, category) => {
          console.log(`\n${category}:`)
          commands.forEach((cmd) => {
            console.log(`  ${cmd.name} - ${cmd.description}`)
          })
        })
      },
    })
  }

  private createPaletteUI(): void {
    this.element = document.createElement('div')
    this.element.id = 'command-palette'
    this.element.style.cssText = `
      position: fixed;
      top: 20%;
      left: 50%;
      transform: translateX(-50%);
      width: 600px;
      max-width: 90vw;
      background: rgba(0, 0, 0, 0.95);
      border: 1px solid #333;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
      z-index: 10001;
      display: none;
      flex-direction: column;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      backdrop-filter: blur(10px);
    `

    // Header
    const header = document.createElement('div')
    header.style.cssText = `
      padding: 16px 20px 12px;
      border-bottom: 1px solid #333;
    `

    this.inputElement = document.createElement('input')
    this.inputElement.type = 'text'
    this.inputElement.placeholder = 'Type a command...'
    this.inputElement.style.cssText = `
      width: 100%;
      background: transparent;
      border: none;
      color: white;
      font-size: 18px;
      outline: none;
      font-family: inherit;
    `

    header.appendChild(this.inputElement)

    // Results
    this.resultsElement = document.createElement('div')
    this.resultsElement.style.cssText = `
      max-height: 400px;
      overflow-y: auto;
    `

    this.element.appendChild(header)
    this.element.appendChild(this.resultsElement)
    document.body.appendChild(this.element)

    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    if (!this.inputElement) return

    this.inputElement.addEventListener('input', () => {
      this.searchQuery = this.inputElement!.value
      this.updateResults()
    })

    this.inputElement.addEventListener('keydown', (event) => {
      switch (event.key) {
        case 'Escape':
          this.close()
          break
        case 'ArrowDown':
          event.preventDefault()
          this.selectNext()
          break
        case 'ArrowUp':
          event.preventDefault()
          this.selectPrevious()
          break
        case 'Enter':
          event.preventDefault()
          this.executeSelected()
          break
      }
    })

    // Click outside to close
    document.addEventListener('click', (event) => {
      if (this.isOpen && !this.element?.contains(event.target as Node)) {
        this.close()
      }
    })
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (event) => {
      // Ctrl+Shift+K to open command palette
      if (event.ctrlKey && event.shiftKey && event.key === 'K') {
        event.preventDefault()
        this.toggle()
      }

      // Handle global shortcuts when palette is closed
      if (!this.isOpen) {
        this.commands.forEach((command) => {
          if (command.shortcut && this.matchesShortcut(event, command.shortcut)) {
            event.preventDefault()
            if (!command.enabled || command.enabled()) {
              command.execute()
            }
          }
        })
      }
    })
  }

  private matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
    const parts = shortcut.toLowerCase().split('+')
    const key = parts[parts.length - 1]
    const modifiers = parts.slice(0, -1)

    // Check key match
    const eventKey = event.key.toLowerCase()
    if (eventKey !== key && event.code.toLowerCase() !== key) {
      return false
    }

    // Check modifiers
    const hasCtrl = modifiers.includes('ctrl') ? event.ctrlKey : !event.ctrlKey
    const hasShift = modifiers.includes('shift') ? event.shiftKey : !event.shiftKey
    const hasAlt = modifiers.includes('alt') ? event.altKey : !event.altKey

    return hasCtrl && hasShift && hasAlt
  }

  private updateResults(): void {
    this.filteredCommands = this.filterCommands(this.searchQuery)
    this.selectedIndex = 0
    this.renderResults()
  }

  private filterCommands(query: string): Command[] {
    if (!query.trim()) {
      return Array.from(this.commands.values()).slice(0, this.config.maxResults)
    }

    const queryLower = query.toLowerCase()
    const scored = Array.from(this.commands.values())
      .map((command) => ({
        command,
        score: this.calculateScore(command, queryLower),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxResults)

    return scored.map((item) => item.command)
  }

  private calculateScore(command: Command, query: string): number {
    let score = 0

    // Exact name match
    if (command.name.toLowerCase() === query) {
      score += 100
    }

    // Name starts with query
    if (command.name.toLowerCase().startsWith(query)) {
      score += 50
    }

    // Name contains query
    if (command.name.toLowerCase().includes(query)) {
      score += 25
    }

    // Description contains query
    if (command.description.toLowerCase().includes(query)) {
      score += 10
    }

    // Keywords match
    const matchingKeywords = command.keywords.filter((keyword) => keyword.toLowerCase().includes(query))
    score += matchingKeywords.length * 15

    // Fuzzy matching for additional flexibility
    if (this.config.fuzzySearch && score === 0) {
      if (this.fuzzyMatch(command.name.toLowerCase(), query)) {
        score += 5
      }
    }

    return score
  }

  private fuzzyMatch(text: string, pattern: string): boolean {
    let patternIndex = 0
    for (let textIndex = 0; textIndex < text.length && patternIndex < pattern.length; textIndex++) {
      if (text[textIndex] === pattern[patternIndex]) {
        patternIndex++
      }
    }
    return patternIndex === pattern.length
  }

  private renderResults(): void {
    if (!this.resultsElement) return

    this.resultsElement.innerHTML = ''

    if (this.filteredCommands.length === 0) {
      const noResults = document.createElement('div')
      noResults.style.cssText = `
        padding: 20px;
        text-align: center;
        color: #888;
        font-style: italic;
      `
      noResults.textContent = 'No commands found'
      this.resultsElement.appendChild(noResults)
      return
    }

    let currentCategory = ''

    this.filteredCommands.forEach((command, index) => {
      // Add category header if needed
      if (this.config.showCategories && command.category !== currentCategory) {
        currentCategory = command.category
        const categoryHeader = document.createElement('div')
        categoryHeader.style.cssText = `
          padding: 8px 20px 4px;
          font-size: 12px;
          font-weight: bold;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        `
        categoryHeader.textContent = currentCategory
        this.resultsElement?.appendChild(categoryHeader)
      }

      // Command item
      const item = document.createElement('div')
      item.style.cssText = `
        padding: 12px 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: white;
        transition: background-color 0.1s;
        ${index === this.selectedIndex ? 'background: rgba(255, 255, 255, 0.1);' : ''}
      `

      const leftSide = document.createElement('div')
      leftSide.style.cssText = 'display: flex; align-items: center; flex: 1;'

      if (command.icon) {
        const icon = document.createElement('span')
        icon.style.cssText = 'margin-right: 12px; font-size: 16px;'
        icon.textContent = command.icon
        leftSide.appendChild(icon)
      }

      const textContainer = document.createElement('div')

      const name = document.createElement('div')
      name.style.cssText = 'font-weight: 500; margin-bottom: 2px;'
      name.textContent = command.name

      const description = document.createElement('div')
      description.style.cssText = 'font-size: 12px; color: #aaa;'
      description.textContent = command.description

      textContainer.appendChild(name)
      textContainer.appendChild(description)
      leftSide.appendChild(textContainer)

      item.appendChild(leftSide)

      if (this.config.showShortcuts && command.shortcut) {
        const shortcut = document.createElement('div')
        shortcut.style.cssText = `
          font-size: 11px;
          color: #666;
          background: rgba(255, 255, 255, 0.1);
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
        `
        shortcut.textContent = command.shortcut
        item.appendChild(shortcut)
      }

      item.addEventListener('click', () => {
        this.selectedIndex = index
        this.executeSelected()
      })

      item.addEventListener('mouseenter', () => {
        this.selectedIndex = index
        this.renderResults()
      })

      this.resultsElement?.appendChild(item)
    })
  }

  private selectNext(): void {
    this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredCommands.length - 1)
    this.renderResults()
  }

  private selectPrevious(): void {
    this.selectedIndex = Math.max(this.selectedIndex - 1, 0)
    this.renderResults()
  }

  private executeSelected(): void {
    const command = this.filteredCommands[this.selectedIndex]
    if (command && (!command.enabled || command.enabled())) {
      this.addToHistory(command.id)
      command.execute()
      this.close()
    }
  }

  private addToHistory(commandId: string): void {
    if (!this.config.enableHistory) return

    const index = this.commandHistory.indexOf(commandId)
    if (index > -1) {
      this.commandHistory.splice(index, 1)
    }

    this.commandHistory.unshift(commandId)

    if (this.commandHistory.length > this.config.maxHistory) {
      this.commandHistory = this.commandHistory.slice(0, this.config.maxHistory)
    }

    this.saveHistory()
  }

  private loadHistory(): void {
    try {
      const stored = localStorage.getItem('command-palette-history')
      if (stored) {
        this.commandHistory = JSON.parse(stored)
      }
    } catch (error) {
      console.warn('Failed to load command history:', error)
    }
  }

  private saveHistory(): void {
    try {
      localStorage.setItem('command-palette-history', JSON.stringify(this.commandHistory))
    } catch (error) {
      console.warn('Failed to save command history:', error)
    }
  }

  // Public API
  public addCommand(command: Command): void {
    this.commands.set(command.id, command)
  }

  public removeCommand(commandId: string): void {
    this.commands.delete(commandId)
  }

  public open(): void {
    this.isOpen = true
    if (this.element) {
      this.element.style.display = 'flex'
      this.inputElement?.focus()
      this.updateResults()
    }
  }

  public close(): void {
    this.isOpen = false
    if (this.element) {
      this.element.style.display = 'none'
      this.searchQuery = ''
      this.selectedIndex = 0
      if (this.inputElement) {
        this.inputElement.value = ''
      }
    }
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close()
    } else {
      this.open()
    }
  }

  public executeCommand(commandId: string): void {
    const command = this.commands.get(commandId)
    if (command && (!command.enabled || command.enabled())) {
      this.addToHistory(commandId)
      command.execute()
    }
  }

  public getCommands(): Command[] {
    return Array.from(this.commands.values())
  }

  public updateConfig(newConfig: Partial<CommandPaletteConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  public destroy(): void {
    this.close()
    if (this.element) {
      document.body.removeChild(this.element)
      this.element = null
    }
    this.saveHistory()
  }
}
