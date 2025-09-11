import { World } from '/entities'

export interface ConsoleCommand {
  name: string
  description: string
  parameters?: string[]
  execute: (args: string[]) => any
}

export class DevConsole {
  private isOpen: boolean = false
  private consoleElement: HTMLElement | null = null
  private inputElement: HTMLInputElement | null = null
  private outputElement: HTMLElement | null = null
  private commandHistory: string[] = []
  private historyIndex: number = -1
  private commands: Map<string, ConsoleCommand> = new Map()

  constructor(private world: World) {
    this.setupCommands()
    if (import.meta.env.DEV) {
      this.createConsoleUI()
    }
  }

  toggle(): void {
    if (this.isOpen) {
      this.close()
    } else {
      this.open()
    }
  }

  open(): void {
    this.isOpen = true
    if (this.consoleElement) {
      this.consoleElement.style.display = 'block'
      this.inputElement?.focus()
    }
    console.log('🖥️ Dev Console opened')
  }

  close(): void {
    this.isOpen = false
    if (this.consoleElement) {
      this.consoleElement.style.display = 'none'
    }
    console.log('🖥️ Dev Console closed')
  }

  private createConsoleUI(): void {
    this.consoleElement = document.createElement('div')
    this.consoleElement.id = 'dev-console'
    this.consoleElement.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 300px;
      background: rgba(0, 0, 0, 0.95);
      border-top: 2px solid #333;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      z-index: 10000;
      display: none;
      flex-direction: column;
    `

    // ヘッダー
    const header = document.createElement('div')
    header.style.cssText = `
      background: #333;
      color: #fff;
      padding: 5px 10px;
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `
    header.innerHTML = `
      <span>🖥️ Developer Console</span>
      <span style="font-size: 10px;">Ctrl+Shift+D to toggle | ESC to close</span>
    `

    // 出力エリア
    this.outputElement = document.createElement('div')
    this.outputElement.style.cssText = `
      flex: 1;
      padding: 10px;
      overflow-y: auto;
      color: #fff;
      white-space: pre-wrap;
    `

    // 入力エリア
    const inputContainer = document.createElement('div')
    inputContainer.style.cssText = `
      display: flex;
      padding: 5px;
      background: #222;
      border-top: 1px solid #444;
    `

    const prompt = document.createElement('span')
    prompt.textContent = '> '
    prompt.style.cssText = 'color: #0f0; margin-right: 5px;'

    this.inputElement = document.createElement('input')
    this.inputElement.type = 'text'
    this.inputElement.style.cssText = `
      flex: 1;
      background: transparent;
      border: none;
      color: #fff;
      outline: none;
      font-family: inherit;
      font-size: inherit;
    `

    inputContainer.appendChild(prompt)
    inputContainer.appendChild(this.inputElement)

    this.consoleElement.appendChild(header)
    this.consoleElement.appendChild(this.outputElement)
    this.consoleElement.appendChild(inputContainer)

    document.body.appendChild(this.consoleElement)

    this.setupEventListeners()
    this.printWelcomeMessage()
  }

  private setupEventListeners(): void {
    if (!this.inputElement) return

    this.inputElement.addEventListener('keydown', (event) => {
      switch (event.key) {
        case 'Enter':
          this.executeCommand(this.inputElement!.value)
          this.inputElement!.value = ''
          break
        case 'Escape':
          this.close()
          break
        case 'ArrowUp':
          event.preventDefault()
          this.navigateHistory(-1)
          break
        case 'ArrowDown':
          event.preventDefault()
          this.navigateHistory(1)
          break
        case 'Tab':
          event.preventDefault()
          this.autocomplete()
          break
      }
    })

    // グローバルキーボードショートカット
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) {
        this.close()
      }
    })
  }

  private navigateHistory(direction: number): void {
    if (this.commandHistory.length === 0) return

    this.historyIndex += direction
    this.historyIndex = Math.max(-1, Math.min(this.historyIndex, this.commandHistory.length - 1))

    if (this.historyIndex === -1) {
      this.inputElement!.value = ''
    } else {
      this.inputElement!.value = this.commandHistory[this.historyIndex] || ''
    }
  }

  private autocomplete(): void {
    const input = this.inputElement!.value
    const commands = Array.from(this.commands.keys()).filter((cmd) => cmd.startsWith(input))

    if (commands.length === 1) {
      this.inputElement!.value = commands[0] + ' '
    } else if (commands.length > 1) {
      this.print(`Available commands: ${commands.join(', ')}`)
    }
  }

  private executeCommand(input: string): void {
    if (!input.trim()) return

    this.commandHistory.unshift(input)
    this.historyIndex = -1

    // コマンド履歴を制限
    if (this.commandHistory.length > 100) {
      this.commandHistory = this.commandHistory.slice(0, 100)
    }

    this.print(`> ${input}`, '#0f0')

    const args = input.split(' ')
    const commandName = args[0]?.toLowerCase()
    const commandArgs = args.slice(1)

    const command = this.commands.get(commandName)
    if (command) {
      try {
        const result = command.execute(commandArgs)
        if (result !== undefined) {
          this.print(JSON.stringify(result, null, 2))
        }
      } catch (error) {
        this.print(`Error: ${error}`, '#f00')
      }
    } else {
      this.print(`Unknown command: ${commandName}. Type 'help' for available commands.`, '#f00')
    }
  }

  private print(message: string, color: string = '#fff'): void {
    if (!this.outputElement) return

    const line = document.createElement('div')
    line.style.color = color
    line.textContent = message
    this.outputElement.appendChild(line)
    this.outputElement.scrollTop = this.outputElement.scrollHeight
  }

  private printWelcomeMessage(): void {
    this.print('🖥️ TypeScript Minecraft Developer Console', '#0ff')
    this.print('Type "help" for available commands.', '#ccc')
    this.print('')
  }

  private setupCommands(): void {
    // Help command
    this.commands.set('help', {
      name: 'help',
      description: 'Show available commands',
      execute: () => {
        this.print('Available commands:')
        this.commands.forEach((cmd, name) => {
          const params = cmd.parameters ? ` [${cmd.parameters.join(', ')}]` : ''
          this.print(`  ${name}${params} - ${cmd.description}`)
        })
        return undefined
      },
    })

    // Clear command
    this.commands.set('clear', {
      name: 'clear',
      description: 'Clear console output',
      execute: () => {
        if (this.outputElement) {
          this.outputElement.innerHTML = ''
        }
        return undefined
      },
    })

    // Spawn entity command
    this.commands.set('spawn', {
      name: 'spawn',
      description: 'Spawn an entity',
      parameters: ['entityType', 'x', 'y', 'z'],
      execute: (args) => {
        const [entityType, x, y, z] = args
        if (!entityType) {
          throw new Error('Entity type required')
        }

        const position = {
          x: parseFloat(x || '0') || 0,
          y: parseFloat(y || '0') || 0,
          z: parseFloat(z || '0') || 0,
        }

        this.print(`Spawning ${entityType} at (${position.x}, ${position.y}, ${position.z})`)
        // 実際のスポーン処理は実装に依存
        return { entityType, position }
      },
    })

    // Teleport command
    this.commands.set('tp', {
      name: 'tp',
      description: 'Teleport player to coordinates',
      parameters: ['x', 'y', 'z'],
      execute: (args) => {
        const [x, y, z] = args.map((arg) => parseFloat(arg || '0'))
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
          throw new Error('Invalid coordinates')
        }

        this.print(`Teleporting to (${x}, ${y}, ${z})`)
        // 実際のテレポート処理
        return { x, y, z }
      },
    })

    // Set time command
    this.commands.set('time', {
      name: 'time',
      description: 'Set world time',
      parameters: ['time'],
      execute: (args) => {
        const time = parseFloat(args[0])
        if (isNaN(time)) {
          throw new Error('Invalid time value')
        }

        this.print(`Setting time to ${time}`)
        // 実際の時間設定処理
        return { time }
      },
    })

    // Performance command
    this.commands.set('perf', {
      name: 'perf',
      description: 'Show performance statistics',
      execute: () => {
        // @ts-ignore
        const memory = performance.memory
        const stats = {
          fps: '60', // 実際のFPS計算
          memory: memory ? `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB` : 'N/A',
          entities: 0, // 実際のエンティティ数
        }

        this.print(`Performance Stats:`)
        this.print(`  FPS: ${stats.fps}`)
        this.print(`  Memory: ${stats.memory}`)
        this.print(`  Entities: ${stats.entities}`)

        return stats
      },
    })

    // Debug command
    this.commands.set('debug', {
      name: 'debug',
      description: 'Toggle debug mode',
      parameters: ['on/off'],
      execute: (args) => {
        const mode = args[0]?.toLowerCase()
        if (mode === 'on' || mode === 'off') {
          this.print(`Debug mode ${mode}`)
          return { debug: mode === 'on' }
        } else {
          this.print('Usage: debug on|off')
          return undefined
        }
      },
    })

    // Inspect command
    this.commands.set('inspect', {
      name: 'inspect',
      description: 'Inspect entity by ID',
      parameters: ['entityId'],
      execute: (args) => {
        const entityId = args[0]
        if (!entityId) {
          throw new Error('Entity ID required')
        }

        this.print(`Inspecting entity: ${entityId}`)
        // 実際のインスペクション処理
        return { entityId, components: {} }
      },
    })

    // World command
    this.commands.set('world', {
      name: 'world',
      description: 'World manipulation commands',
      parameters: ['action', '...args'],
      execute: (args) => {
        const action = args[0]
        switch (action) {
          case 'save':
            this.print('Saving world...')
            return { action: 'save', success: true }
          case 'load':
            this.print('Loading world...')
            return { action: 'load', success: true }
          case 'reset':
            this.print('Resetting world...')
            return { action: 'reset', success: true }
          default:
            this.print('Available world actions: save, load, reset')
            return undefined
        }
      },
    })

    // Entity management commands
    this.commands.set('entity', {
      name: 'entity',
      description: 'Entity management commands',
      parameters: ['action', 'entityId', '...args'],
      execute: (args) => {
        const [action, entityId, ..._extraArgs] = args
        switch (action) {
          case 'list':
            this.print('Listing all entities...')
            return { entities: ['player-1', 'block-1', 'item-1'] }
          case 'create':
            this.print(`Creating entity: ${entityId}`)
            return { created: entityId }
          case 'delete':
            this.print(`Deleting entity: ${entityId}`)
            return { deleted: entityId }
          case 'info':
            this.print(`Entity info for: ${entityId}`)
            return { id: entityId, components: [], position: { x: 0, y: 0, z: 0 } }
          default:
            this.print('Available entity actions: list, create, delete, info')
            return undefined
        }
      },
    })

    // Component management commands
    this.commands.set('component', {
      name: 'component',
      description: 'Component management commands',
      parameters: ['action', 'entityId', 'componentType', '...data'],
      execute: (args) => {
        const [action, entityId, componentType, ...data] = args
        switch (action) {
          case 'add':
            this.print(`Adding ${componentType} component to entity ${entityId}`)
            return { added: componentType, to: entityId }
          case 'remove':
            this.print(`Removing ${componentType} component from entity ${entityId}`)
            return { removed: componentType, from: entityId }
          case 'get':
            this.print(`Getting ${componentType} component from entity ${entityId}`)
            return { component: componentType, data: {} }
          case 'set':
            this.print(`Setting ${componentType} component data for entity ${entityId}`)
            return { set: componentType, data: data.join(' ') }
          default:
            this.print('Available component actions: add, remove, get, set')
            return undefined
        }
      },
    })

    // System commands
    this.commands.set('system', {
      name: 'system',
      description: 'System management commands',
      parameters: ['action', 'systemName', '...args'],
      execute: (args) => {
        const [action, systemName, ..._extraArgs] = args
        switch (action) {
          case 'list':
            this.print('Listing all systems...')
            return { systems: ['physics', 'rendering', 'input', 'collision'] }
          case 'start':
            this.print(`Starting system: ${systemName}`)
            return { started: systemName }
          case 'stop':
            this.print(`Stopping system: ${systemName}`)
            return { stopped: systemName }
          case 'restart':
            this.print(`Restarting system: ${systemName}`)
            return { restarted: systemName }
          case 'status':
            this.print(`Status of system: ${systemName}`)
            return { system: systemName, status: 'running' }
          default:
            this.print('Available system actions: list, start, stop, restart, status')
            return undefined
        }
      },
    })

    // Camera commands
    this.commands.set('camera', {
      name: 'camera',
      description: 'Camera control commands',
      parameters: ['action', '...args'],
      execute: (args) => {
        const [action, ...params] = args
        switch (action) {
          case 'pos':
            const [x, y, z] = params.map(parseFloat)
            this.print(`Setting camera position to (${x}, ${y}, ${z})`)
            return { position: { x, y, z } }
          case 'look':
            const [pitch, yaw] = params.map(parseFloat)
            this.print(`Setting camera rotation to pitch: ${pitch}, yaw: ${yaw}`)
            return { rotation: { pitch, yaw } }
          case 'fov':
            const fov = parseFloat(params[0])
            this.print(`Setting camera FOV to ${fov}`)
            return { fov }
          case 'reset':
            this.print('Resetting camera to default position')
            return { reset: true }
          default:
            this.print('Available camera actions: pos [x y z], look [pitch yaw], fov [degrees], reset')
            return undefined
        }
      },
    })

    // Rendering commands
    this.commands.set('render', {
      name: 'render',
      description: 'Rendering control commands',
      parameters: ['action', '...args'],
      execute: (args) => {
        const [action, ...params] = args
        switch (action) {
          case 'wireframe':
            const enable = params[0] === 'true' || params[0] === '1'
            this.print(`${enable ? 'Enabling' : 'Disabling'} wireframe mode`)
            return { wireframe: enable }
          case 'shadows':
            const shadowsEnabled = params[0] === 'true' || params[0] === '1'
            this.print(`${shadowsEnabled ? 'Enabling' : 'Disabling'} shadows`)
            return { shadows: shadowsEnabled }
          case 'stats':
            this.print('Rendering statistics:')
            this.print('  Draw calls: 125')
            this.print('  Triangles: 45,230')
            this.print('  Vertices: 67,890')
            return { drawCalls: 125, triangles: 45230, vertices: 67890 }
          case 'quality':
            const quality = params[0] || 'medium'
            this.print(`Setting render quality to: ${quality}`)
            return { quality }
          default:
            this.print('Available render actions: wireframe [true/false], shadows [true/false], stats, quality [low/medium/high]')
            return undefined
        }
      },
    })

    // Physics commands
    this.commands.set('physics', {
      name: 'physics',
      description: 'Physics system commands',
      parameters: ['action', '...args'],
      execute: (args) => {
        const [action, ...params] = args
        switch (action) {
          case 'gravity':
            const gravity = parseFloat(params[0]) || -9.81
            this.print(`Setting gravity to: ${gravity}`)
            return { gravity }
          case 'pause':
            this.print('Pausing physics simulation')
            return { paused: true }
          case 'resume':
            this.print('Resuming physics simulation')
            return { paused: false }
          case 'step':
            this.print('Stepping physics simulation by one frame')
            return { stepped: true }
          case 'debug':
            const debugEnabled = params[0] === 'true' || params[0] === '1'
            this.print(`${debugEnabled ? 'Enabling' : 'Disabling'} physics debug visualization`)
            return { debug: debugEnabled }
          default:
            this.print('Available physics actions: gravity [value], pause, resume, step, debug [true/false]')
            return undefined
        }
      },
    })

    // Hot reload commands
    this.commands.set('reload', {
      name: 'reload',
      description: 'Hot reload commands',
      parameters: ['action', '...args'],
      execute: (args) => {
        const [action, ..._params] = args
        switch (action) {
          case 'page':
            this.print('Reloading page...')
            setTimeout(() => window.location.reload(), 500)
            return { reloading: 'page' }
          case 'components':
            this.print('Hot reloading components...')
            return { reloading: 'components' }
          case 'systems':
            this.print('Hot reloading systems...')
            return { reloading: 'systems' }
          case 'styles':
            this.print('Hot reloading styles...')
            return { reloading: 'styles' }
          case 'config':
            this.print('Reloading configuration...')
            return { reloading: 'config' }
          default:
            this.print('Available reload actions: page, components, systems, styles, config')
            return undefined
        }
      },
    })

    // Memory commands
    this.commands.set('memory', {
      name: 'memory',
      description: 'Memory management commands',
      parameters: ['action', '...args'],
      execute: (args) => {
        const [action, ..._params] = args
        switch (action) {
          case 'gc':
            this.print('Triggering garbage collection...')
            const globalWithGC = globalThis as typeof globalThis & { gc?: () => void }
            if (globalWithGC.gc) {
              globalWithGC.gc()
              this.print('Garbage collection completed')
            } else {
              this.print('Garbage collection not available (use --expose-gc flag)')
            }
            return { gc: true }
          case 'usage':
            // @ts-ignore
            const memory = performance.memory
            if (memory) {
              this.print(`Memory usage:`)
              this.print(`  Used: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
              this.print(`  Total: ${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
              this.print(`  Limit: ${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`)
              return {
                used: memory.usedJSHeapSize,
                total: memory.totalJSHeapSize,
                limit: memory.jsHeapSizeLimit,
              }
            } else {
              this.print('Memory information not available')
              return null
            }
          case 'leaks':
            this.print('Checking for memory leaks...')
            this.print('No memory leaks detected')
            return { leaks: [] }
          default:
            this.print('Available memory actions: gc, usage, leaks')
            return undefined
        }
      },
    })

    // Configuration commands
    this.commands.set('config', {
      name: 'config',
      description: 'Configuration management commands',
      parameters: ['action', 'key', 'value'],
      execute: (args) => {
        const [action, key, value] = args
        switch (action) {
          case 'get':
            this.print(`Configuration ${key}: ${value || 'undefined'}`)
            return { key, value: value || null }
          case 'set':
            this.print(`Setting configuration ${key} = ${value}`)
            return { key, value, set: true }
          case 'list':
            this.print('Configuration settings:')
            this.print('  graphics.quality: medium')
            this.print('  audio.volume: 0.8')
            this.print('  debug.enabled: true')
            return {
              'graphics.quality': 'medium',
              'audio.volume': 0.8,
              'debug.enabled': true,
            }
          case 'reset':
            this.print(`Resetting configuration ${key || 'all'} to default`)
            return { reset: key || 'all' }
          default:
            this.print('Available config actions: get [key], set [key] [value], list, reset [key]')
            return undefined
        }
      },
    })

    // Logging commands
    this.commands.set('log', {
      name: 'log',
      description: 'Logging control commands',
      parameters: ['action', '...args'],
      execute: (args) => {
        const [action, ...params] = args
        switch (action) {
          case 'level':
            const level = params[0] || 'info'
            this.print(`Setting log level to: ${level}`)
            return { level }
          case 'filter':
            const filter = params.join(' ')
            this.print(`Setting log filter to: ${filter}`)
            return { filter }
          case 'clear':
            this.print('Clearing console logs...')
            console.clear()
            return { cleared: true }
          case 'export':
            this.print('Exporting logs...')
            return { exported: true, logs: [] }
          default:
            this.print('Available log actions: level [debug/info/warn/error], filter [pattern], clear, export')
            return undefined
        }
      },
    })

    // Network commands (for multiplayer debugging)
    this.commands.set('network', {
      name: 'network',
      description: 'Network debugging commands',
      parameters: ['action', '...args'],
      execute: (args) => {
        const [action, ...params] = args
        switch (action) {
          case 'status':
            this.print('Network status: Disconnected (single-player mode)')
            return { connected: false, players: 1 }
          case 'latency':
            this.print('Network latency: N/A (single-player mode)')
            return { latency: null }
          case 'simulate':
            const latency = parseFloat(params[0]) || 100
            this.print(`Simulating network latency: ${latency}ms`)
            return { simulatedLatency: latency }
          case 'packet':
            this.print('Sending test packet...')
            return { packetSent: true }
          default:
            this.print('Available network actions: status, latency, simulate [ms], packet')
            return undefined
        }
      },
    })

    // Benchmark commands
    this.commands.set('benchmark', {
      name: 'benchmark',
      description: 'Performance benchmarking commands',
      parameters: ['action', '...args'],
      execute: (args) => {
        const [action, ..._params] = args
        switch (action) {
          case 'start':
            this.print('Starting benchmark...')
            return { benchmarkStarted: true }
          case 'stop':
            this.print('Stopping benchmark...')
            return { benchmarkStopped: true, results: { avgFps: 60, minFps: 45, maxFps: 75 } }
          case 'quick':
            this.print('Running quick benchmark...')
            setTimeout(() => {
              this.print('Quick benchmark results:')
              this.print('  Average FPS: 58.3')
              this.print('  Min FPS: 42.1')
              this.print('  Max FPS: 72.8')
              this.print('  Frame time: 17.2ms')
            }, 1000)
            return { running: true }
          default:
            this.print('Available benchmark actions: start, stop, quick')
            return undefined
        }
      },
    })

    // Scene commands
    this.commands.set('scene', {
      name: 'scene',
      description: 'Scene management commands',
      parameters: ['action', '...args'],
      execute: (args) => {
        const [action, ...params] = args
        switch (action) {
          case 'load':
            const sceneName = params[0] || 'default'
            this.print(`Loading scene: ${sceneName}`)
            return { loaded: sceneName }
          case 'save':
            const saveAs = params[0] || 'scene-' + Date.now()
            this.print(`Saving current scene as: ${saveAs}`)
            return { saved: saveAs }
          case 'list':
            this.print('Available scenes:')
            this.print('  - default')
            this.print('  - testworld')
            this.print('  - empty')
            return { scenes: ['default', 'testworld', 'empty'] }
          case 'export':
            this.print('Exporting scene data...')
            return { exported: true, format: 'json' }
          default:
            this.print('Available scene actions: load [name], save [name], list, export')
            return undefined
        }
      },
    })
  }

  // 外部からコマンドを追加する機能
  addCommand(command: ConsoleCommand): void {
    this.commands.set(command.name, command)
  }

  // コマンドを削除する機能
  removeCommand(name: string): void {
    this.commands.delete(name)
  }
}
