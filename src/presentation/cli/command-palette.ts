/**
 * Command Palette - Functional Module Implementation
 * 
 * Converted from class-based implementation to functional Effect-TS module
 * Features:
 * - Comprehensive command management system
 * - Fuzzy search with scoring algorithm
 * - Keyboard navigation and shortcuts
 * - Command history and persistence
 * - Category-based organization
 * - Visual UI with backdrop blur
 * - Integration with all development tools
 */

import * as Effect from 'effect/Effect'
import * as Ref from 'effect/Ref'
import { createGameDebugger } from '@presentation/cli/debugger'
import { createDevConsole } from '@presentation/cli/dev-console'
import { createEntityInspector } from '@presentation/cli/entity-inspector'
import { PerformanceProfiler } from '@presentation/cli/performance-profiler'
import { createHotReloadManager } from '@presentation/cli/hot-reload'

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
  position: { top: string; left: string }
  size: { width: string; maxWidth: string }
}

export interface CommandPaletteState {
  isOpen: boolean
  element: HTMLElement | null
  inputElement: HTMLInputElement | null
  resultsElement: HTMLElement | null
  commands: Map<string, Command>
  filteredCommands: Command[]
  selectedIndex: number
  searchQuery: string
  commandHistory: string[]
  gameDebugger: any
  devConsole: any
  entityInspector: any
  performanceProfiler: any
  hotReloadManager: any
}

const defaultConfig: CommandPaletteConfig = {
  maxResults: 10,
  fuzzySearch: true,
  showShortcuts: true,
  showCategories: true,
  enableHistory: true,
  maxHistory: 50,
  position: { top: '20%', left: '50%' },
  size: { width: '600px', maxWidth: '90vw' }
}

/**
 * Create Command Palette functional module
 */
export const createCommandPalette = (
  gameDebugger?: any,
  devConsole?: any,
  entityInspector?: any,
  performanceProfiler?: PerformanceProfiler,
  config: Partial<CommandPaletteConfig> = {}
) =>
  Effect.gen(function* () {
    const finalConfig = { ...defaultConfig, ...config }
    
    const stateRef = yield* Ref.make<CommandPaletteState>({
      isOpen: false,
      element: null,
      inputElement: null,
      resultsElement: null,
      commands: new Map(),
      filteredCommands: [],
      selectedIndex: 0,
      searchQuery: '',
      commandHistory: [],
      gameDebugger,
      devConsole,
      entityInspector,
      performanceProfiler,
      hotReloadManager: null
    })

    /**
     * Initialize hot reload manager
     */
    const initializeHotReloadManager = Effect.gen(function* () {
      const hotReloadManager = yield* createHotReloadManager()
      yield* Ref.update(stateRef, (s) => ({ ...s, hotReloadManager }))
    })

    /**
     * Setup all available commands
     */
    const setupCommands = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      
      // Debug commands
      yield* addCommand({
        id: 'debug.toggle',
        name: 'Toggle Debugger',
        description: 'Enable or disable the game debugger',
        category: 'Debug',
        keywords: ['debug', 'toggle', 'enable', 'disable'],
        shortcut: 'F12',
        icon: '🔧',
        execute: () => {
          if (state.gameDebugger) {
            Effect.runSync(state.gameDebugger.toggle())
          }
        },
        enabled: () => !!state.gameDebugger,
      })

      yield* addCommand({
        id: 'debug.pause',
        name: 'Pause Game',
        description: 'Pause game execution for debugging',
        category: 'Debug',
        keywords: ['pause', 'stop', 'freeze'],
        shortcut: 'Ctrl+Shift+P',
        icon: '⏸️',
        execute: () => {
          if (state.gameDebugger) {
            Effect.runSync(state.gameDebugger.togglePause())
          }
        },
        enabled: () => !!state.gameDebugger,
      })

      yield* addCommand({
        id: 'debug.step',
        name: 'Step Frame',
        description: 'Execute one frame step in paused mode',
        category: 'Debug',
        keywords: ['step', 'frame', 'next'],
        shortcut: 'Ctrl+Shift+S',
        icon: '👣',
        execute: () => {
          if (state.gameDebugger) {
            Effect.runSync(state.gameDebugger.stepFrame())
          }
        },
        enabled: () => !!state.gameDebugger,
      })

      yield* addCommand({
        id: 'debug.record',
        name: 'Toggle Recording',
        description: 'Start or stop debug session recording',
        category: 'Debug',
        keywords: ['record', 'capture', 'session'],
        shortcut: 'Ctrl+Shift+R',
        icon: '⏺️',
        execute: () => {
          if (state.gameDebugger) {
            Effect.runSync(state.gameDebugger.toggleRecording())
          }
        },
        enabled: () => !!state.gameDebugger,
      })

      // Console commands
      yield* addCommand({
        id: 'console.toggle',
        name: 'Toggle Developer Console',
        description: 'Open or close the developer console',
        category: 'Console',
        keywords: ['console', 'terminal', 'command'],
        shortcut: 'Ctrl+Shift+D',
        icon: '🖥️',
        execute: () => {
          if (state.devConsole) {
            Effect.runSync(state.devConsole.toggle())
          }
        },
        enabled: () => !!state.devConsole,
      })

      // Inspector commands
      yield* addCommand({
        id: 'inspector.toggle',
        name: 'Toggle Entity Inspector',
        description: 'Open or close the entity inspector',
        category: 'Inspector',
        keywords: ['inspector', 'entity', 'components'],
        shortcut: 'Ctrl+Shift+I',
        icon: '🔍',
        execute: () => {
          if (state.entityInspector) {
            Effect.runSync(state.entityInspector.toggle())
          }
        },
        enabled: () => !!state.entityInspector,
      })

      // Performance commands
      yield* addCommand({
        id: 'performance.start',
        name: 'Start Performance Recording',
        description: 'Begin recording performance metrics',
        category: 'Performance',
        keywords: ['performance', 'record', 'metrics', 'fps'],
        icon: '📊',
        execute: () => {
          if (state.performanceProfiler) {
            state.performanceProfiler.startRecording()
          }
        },
        enabled: () => !!state.performanceProfiler,
      })

      yield* addCommand({
        id: 'performance.stop',
        name: 'Stop Performance Recording',
        description: 'Stop recording and show performance data',
        category: 'Performance',
        keywords: ['performance', 'stop', 'results'],
        icon: '⏹️',
        execute: () => {
          if (state.performanceProfiler) {
            const data = state.performanceProfiler.stopRecording()
            if (data) {
              console.log('Performance data:', data)
            }
          }
        },
        enabled: () => !!state.performanceProfiler,
      })

      // Hot reload commands
      yield* addCommand({
        id: 'reload.page',
        name: 'Reload Page',
        description: 'Reload the entire page',
        category: 'Reload',
        keywords: ['reload', 'refresh', 'page'],
        shortcut: 'F5',
        icon: '🔄',
        execute: () => window.location.reload(),
      })

      yield* addCommand({
        id: 'reload.hot',
        name: 'Hot Reload',
        description: 'Trigger hot module replacement',
        category: 'Reload',
        keywords: ['hot', 'reload', 'hmr'],
        shortcut: 'Ctrl+R',
        icon: '🔥',
        execute: () => {
          if (state.hotReloadManager) {
            Effect.runSync(state.hotReloadManager.manualReload())
          }
        },
      })

      yield* addCommand({
        id: 'reload.force',
        name: 'Force Reload',
        description: 'Force a complete page reload',
        category: 'Reload',
        keywords: ['force', 'reload', 'hard'],
        shortcut: 'Ctrl+Shift+R',
        icon: '💪',
        execute: () => {
          if (state.hotReloadManager) {
            Effect.runSync(state.hotReloadManager.forceReload())
          }
        },
      })

      // View commands
      yield* addCommand({
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

      yield* addCommand({
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

      yield* addCommand({
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

      yield* addCommand({
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
      yield* addCommand({
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

      yield* addCommand({
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

      // Help commands
      yield* addCommand({
        id: 'help.shortcuts',
        name: 'Show Keyboard Shortcuts',
        description: 'Display all available keyboard shortcuts',
        category: 'Help',
        keywords: ['help', 'shortcuts', 'keys'],
        icon: '⌨️',
        execute: () => {
          Effect.runSync(
            Effect.gen(function* () {
              const currentState = yield* Ref.get(stateRef)
              const shortcuts = Array.from(currentState.commands.values())
                .filter((cmd) => cmd.shortcut)
                .map((cmd) => `${cmd.shortcut}: ${cmd.name}`)
                .join('\n')
              console.log('Keyboard Shortcuts:\n' + shortcuts)
            })
          )
        },
      })

      yield* addCommand({
        id: 'help.commands',
        name: 'List All Commands',
        description: 'Show all available commands',
        category: 'Help',
        keywords: ['help', 'commands', 'list'],
        icon: '📋',
        execute: () => {
          Effect.runSync(
            Effect.gen(function* () {
              const currentState = yield* Ref.get(stateRef)
              const categories = new Map<string, Command[]>()

              currentState.commands.forEach((cmd) => {
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
            })
          )
        },
      })
    })

    /**
     * Create palette UI
     */
    const createPaletteUI = Effect.gen(function* () {
      const element = document.createElement('div')
      element.id = 'command-palette'
      element.style.cssText = `
        position: fixed;
        top: ${finalConfig.position.top};
        left: ${finalConfig.position.left};
        transform: translateX(-50%);
        width: ${finalConfig.size.width};
        max-width: ${finalConfig.size.maxWidth};
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

      const inputElement = document.createElement('input')
      inputElement.type = 'text'
      inputElement.placeholder = 'Type a command...'
      inputElement.style.cssText = `
        width: 100%;
        background: transparent;
        border: none;
        color: white;
        font-size: 18px;
        outline: none;
        font-family: inherit;
      `

      header.appendChild(inputElement)

      // Results
      const resultsElement = document.createElement('div')
      resultsElement.style.cssText = `
        max-height: 400px;
        overflow-y: auto;
      `

      element.appendChild(header)
      element.appendChild(resultsElement)
      document.body.appendChild(element)

      yield* Ref.update(stateRef, (s) => ({
        ...s,
        element,
        inputElement,
        resultsElement
      }))

      yield* setupEventListeners()
    })

    /**
     * Setup event listeners
     */
    const setupEventListeners = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (!state.inputElement) return

      state.inputElement.addEventListener('input', () => {
        Effect.runSync(
          Effect.gen(function* () {
            const currentState = yield* Ref.get(stateRef)
            yield* Ref.update(stateRef, (s) => ({ 
              ...s, 
              searchQuery: currentState.inputElement?.value || '' 
            }))
            yield* updateResults()
          })
        )
      })

      state.inputElement.addEventListener('keydown', (event) => {
        Effect.runSync(
          Effect.gen(function* () {
            switch (event.key) {
              case 'Escape':
                yield* close()
                break
              case 'ArrowDown':
                event.preventDefault()
                yield* selectNext()
                break
              case 'ArrowUp':
                event.preventDefault()
                yield* selectPrevious()
                break
              case 'Enter':
                event.preventDefault()
                yield* executeSelected()
                break
            }
          })
        )
      })

      // Click outside to close
      document.addEventListener('click', (event) => {
        Effect.runSync(
          Effect.gen(function* () {
            const currentState = yield* Ref.get(stateRef)
            if (currentState.isOpen && !currentState.element?.contains(event.target as Node)) {
              yield* close()
            }
          })
        )
      })
    })

    /**
     * Setup keyboard shortcuts
     */
    const setupKeyboardShortcuts = Effect.gen(function* () {
      document.addEventListener('keydown', (event) => {
        Effect.runSync(
          Effect.gen(function* () {
            // Ctrl+Shift+K to open command palette
            if (event.ctrlKey && event.shiftKey && event.key === 'K') {
              event.preventDefault()
              yield* toggle()
            }

            // Handle global shortcuts when palette is closed
            const state = yield* Ref.get(stateRef)
            if (!state.isOpen) {
              for (const [, command] of state.commands) {
                if (command.shortcut && matchesShortcut(event, command.shortcut)) {
                  event.preventDefault()
                  if (!command.enabled || command.enabled()) {
                    command.execute()
                  }
                  break
                }
              }
            }
          })
        )
      })
    })

    /**
     * Check if event matches shortcut
     */
    const matchesShortcut = (event: KeyboardEvent, shortcut: string): boolean => {
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

    /**
     * Update search results
     */
    const updateResults = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const filteredCommands = yield* filterCommands(state.searchQuery)
      
      yield* Ref.update(stateRef, (s) => ({
        ...s,
        filteredCommands,
        selectedIndex: 0
      }))
      
      yield* renderResults()
    })

    /**
     * Filter commands based on search query
     */
    const filterCommands = (query: string) => Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      
      if (!query.trim()) {
        return Array.from(state.commands.values()).slice(0, finalConfig.maxResults)
      }

      const queryLower = query.toLowerCase()
      const scored = Array.from(state.commands.values())
        .map((command) => ({
          command,
          score: calculateScore(command, queryLower),
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, finalConfig.maxResults)

      return scored.map((item) => item.command)
    })

    /**
     * Calculate search score for command
     */
    const calculateScore = (command: Command, query: string): number => {
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
      const matchingKeywords = command.keywords.filter((keyword) => 
        keyword.toLowerCase().includes(query)
      )
      score += matchingKeywords.length * 15

      // Fuzzy matching for additional flexibility
      if (finalConfig.fuzzySearch && score === 0) {
        if (fuzzyMatch(command.name.toLowerCase(), query)) {
          score += 5
        }
      }

      return score
    }

    /**
     * Fuzzy string matching
     */
    const fuzzyMatch = (text: string, pattern: string): boolean => {
      let patternIndex = 0
      for (let textIndex = 0; textIndex < text.length && patternIndex < pattern.length; textIndex++) {
        if (text[textIndex] === pattern[patternIndex]) {
          patternIndex++
        }
      }
      return patternIndex === pattern.length
    }

    /**
     * Render search results
     */
    const renderResults = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (!state.resultsElement) return

      state.resultsElement.innerHTML = ''

      if (state.filteredCommands.length === 0) {
        const noResults = document.createElement('div')
        noResults.style.cssText = `
          padding: 20px;
          text-align: center;
          color: #888;
          font-style: italic;
        `
        noResults.textContent = 'No commands found'
        state.resultsElement.appendChild(noResults)
        return
      }

      let currentCategory = ''

      state.filteredCommands.forEach((command, index) => {
        // Add category header if needed
        if (finalConfig.showCategories && command.category !== currentCategory) {
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
          state.resultsElement?.appendChild(categoryHeader)
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
          ${index === state.selectedIndex ? 'background: rgba(255, 255, 255, 0.1);' : ''}
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

        if (finalConfig.showShortcuts && command.shortcut) {
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
          Effect.runSync(
            Effect.gen(function* () {
              yield* Ref.update(stateRef, (s) => ({ ...s, selectedIndex: index }))
              yield* executeSelected()
            })
          )
        })

        item.addEventListener('mouseenter', () => {
          Effect.runSync(
            Effect.gen(function* () {
              yield* Ref.update(stateRef, (s) => ({ ...s, selectedIndex: index }))
              yield* renderResults()
            })
          )
        })

        state.resultsElement?.appendChild(item)
      })
    })

    /**
     * Select next command
     */
    const selectNext = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const newIndex = Math.min(state.selectedIndex + 1, state.filteredCommands.length - 1)
      yield* Ref.update(stateRef, (s) => ({ ...s, selectedIndex: newIndex }))
      yield* renderResults()
    })

    /**
     * Select previous command
     */
    const selectPrevious = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const newIndex = Math.max(state.selectedIndex - 1, 0)
      yield* Ref.update(stateRef, (s) => ({ ...s, selectedIndex: newIndex }))
      yield* renderResults()
    })

    /**
     * Execute selected command
     */
    const executeSelected = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const command = state.filteredCommands[state.selectedIndex]
      if (command && (!command.enabled || command.enabled())) {
        yield* addToHistory(command.id)
        command.execute()
        yield* close()
      }
    })

    /**
     * Add command to execution history
     */
    const addToHistory = (commandId: string) => Effect.gen(function* () {
      if (!finalConfig.enableHistory) return

      yield* Ref.update(stateRef, (state) => {
        const newHistory = [...state.commandHistory]
        const index = newHistory.indexOf(commandId)
        if (index > -1) {
          newHistory.splice(index, 1)
        }

        newHistory.unshift(commandId)

        if (newHistory.length > finalConfig.maxHistory) {
          newHistory.splice(finalConfig.maxHistory)
        }

        return { ...state, commandHistory: newHistory }
      })

      yield* saveHistory()
    })

    /**
     * Load command history from storage
     */
    const loadHistory = Effect.gen(function* () {
      try {
        const stored = localStorage.getItem('command-palette-history')
        if (stored) {
          const history = JSON.parse(stored)
          yield* Ref.update(stateRef, (s) => ({ ...s, commandHistory: history }))
        }
      } catch (error) {
        console.warn('Failed to load command history:', error)
      }
    })

    /**
     * Save command history to storage
     */
    const saveHistory = Effect.gen(function* () {
      try {
        const state = yield* Ref.get(stateRef)
        localStorage.setItem('command-palette-history', JSON.stringify(state.commandHistory))
      } catch (error) {
        console.warn('Failed to save command history:', error)
      }
    })

    /**
     * Add command to palette
     */
    const addCommand = (command: Command) => Effect.gen(function* () {
      yield* Ref.update(stateRef, (s) => {
        const newCommands = new Map(s.commands)
        newCommands.set(command.id, command)
        return { ...s, commands: newCommands }
      })
    })

    /**
     * Remove command from palette
     */
    const removeCommand = (commandId: string) => Effect.gen(function* () {
      yield* Ref.update(stateRef, (s) => {
        const newCommands = new Map(s.commands)
        newCommands.delete(commandId)
        return { ...s, commands: newCommands }
      })
    })

    /**
     * Open command palette
     */
    const open = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (state.element) {
        state.element.style.display = 'flex'
        state.inputElement?.focus()
        yield* updateResults()
      }
      yield* Ref.update(stateRef, (s) => ({ ...s, isOpen: true }))
    })

    /**
     * Close command palette
     */
    const close = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (state.element) {
        state.element.style.display = 'none'
        if (state.inputElement) {
          state.inputElement.value = ''
        }
      }
      yield* Ref.update(stateRef, (s) => ({ 
        ...s, 
        isOpen: false,
        searchQuery: '',
        selectedIndex: 0
      }))
    })

    /**
     * Toggle command palette
     */
    const toggle = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (state.isOpen) {
        yield* close()
      } else {
        yield* open()
      }
    })

    /**
     * Execute command by ID
     */
    const executeCommand = (commandId: string) => Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const command = state.commands.get(commandId)
      if (command && (!command.enabled || command.enabled())) {
        yield* addToHistory(commandId)
        command.execute()
      }
    })

    /**
     * Get all commands
     */
    const getCommands = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return Array.from(state.commands.values())
    })

    /**
     * Destroy command palette
     */
    const destroy = Effect.gen(function* () {
      yield* close()
      const state = yield* Ref.get(stateRef)
      if (state.element) {
        document.body.removeChild(state.element)
        yield* Ref.update(stateRef, (s) => ({ ...s, element: null }))
      }
      yield* saveHistory()
    })

    // Initialize in development mode
    if (import.meta.env.DEV) {
      yield* initializeHotReloadManager()
      yield* setupCommands()
      yield* createPaletteUI()
      yield* setupKeyboardShortcuts()
      yield* loadHistory()
    }

    return {
      addCommand,
      removeCommand,
      open,
      close,
      toggle,
      executeCommand,
      getCommands,
      destroy
    }
  })

/**
 * Create command palette factory for easier usage
 */
export const createCommandPaletteFactory = (config: Partial<CommandPaletteConfig> = {}) =>
  (
    gameDebugger?: any,
    devConsole?: any,
    entityInspector?: any,
    performanceProfiler?: PerformanceProfiler
  ) => createCommandPalette(gameDebugger, devConsole, entityInspector, performanceProfiler, config)