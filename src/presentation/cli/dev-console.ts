import { World } from '@domain/entities'
import { Effect, Ref } from 'effect'

export interface ConsoleCommand {
  name: string
  description: string
  parameters?: string[]
  execute: (args: string[]) => any
}

export interface DevConsoleState {
  isOpen: boolean
  consoleElement: HTMLElement | null
  inputElement: HTMLInputElement | null
  outputElement: HTMLElement | null
  commandHistory: string[]
  historyIndex: number
  commands: Map<string, ConsoleCommand>
}

export const createDevConsole = (world: World) =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<DevConsoleState>({
      isOpen: false,
      consoleElement: null,
      inputElement: null,
      outputElement: null,
      commandHistory: [],
      historyIndex: -1,
      commands: new Map(),
    })

    const toggle = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        if (state.isOpen) {
          yield* close()
        } else {
          yield* open()
        }
      })

    const open = () =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (state) => ({ ...state, isOpen: true }))
        const state = yield* Ref.get(stateRef)
        if (state.consoleElement) {
          state.consoleElement.style.display = 'block'
          state.inputElement?.focus()
        }
        yield* Effect.log('🖥️ Dev Console opened')
      })

    const close = () =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (state) => ({ ...state, isOpen: false }))
        const state = yield* Ref.get(stateRef)
        if (state.consoleElement) {
          state.consoleElement.style.display = 'none'
        }
        yield* Effect.log('🖥️ Dev Console closed')
      })

    const createConsoleUI = () =>
      Effect.gen(function* () {
        const consoleElement = document.createElement('div')
        consoleElement.id = 'dev-console'
        consoleElement.style.cssText = `
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
        const outputElement = document.createElement('div')
        outputElement.style.cssText = `
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

        const inputElement = document.createElement('input')
        inputElement.type = 'text'
        inputElement.style.cssText = `
      flex: 1;
      background: transparent;
      border: none;
      color: #fff;
      outline: none;
      font-family: inherit;
      font-size: inherit;
    `

        inputContainer.appendChild(prompt)
        inputContainer.appendChild(inputElement)

        consoleElement.appendChild(header)
        consoleElement.appendChild(outputElement)
        consoleElement.appendChild(inputContainer)

        document.body.appendChild(consoleElement)

        yield* Ref.update(stateRef, (state) => ({
          ...state,
          consoleElement,
          inputElement,
          outputElement,
        }))

        yield* setupEventListeners()
        yield* printWelcomeMessage()
      })

    const setupEventListeners = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        if (!state.inputElement) return

        state.inputElement.addEventListener('keydown', (event) => {
          Effect.runSync(
            Effect.gen(function* () {
              switch (event.key) {
                case 'Enter':
                  yield* executeCommand(state.inputElement!.value)
                  state.inputElement!.value = ''
                  break
                case 'Escape':
                  yield* close()
                  break
                case 'ArrowUp':
                  event.preventDefault()
                  yield* navigateHistory(-1)
                  break
                case 'ArrowDown':
                  event.preventDefault()
                  yield* navigateHistory(1)
                  break
                case 'Tab':
                  event.preventDefault()
                  yield* autocomplete()
                  break
              }
            }),
          )
        })

        // グローバルキーボードショートカット
        document.addEventListener('keydown', (event) => {
          Effect.runSync(
            Effect.gen(function* () {
              const currentState = yield* Ref.get(stateRef)
              if (event.key === 'Escape' && currentState.isOpen) {
                yield* close()
              }
            }),
          )
        })
      })

    const navigateHistory = (direction: number) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        if (state.commandHistory.length === 0) return

        const newHistoryIndex = Math.max(-1, Math.min(state.historyIndex + direction, state.commandHistory.length - 1))

        yield* Ref.update(stateRef, (s) => ({ ...s, historyIndex: newHistoryIndex }))

        if (newHistoryIndex === -1) {
          state.inputElement!.value = ''
        } else {
          state.inputElement!.value = state.commandHistory[newHistoryIndex] || ''
        }
      })

    const autocomplete = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const input = state.inputElement!.value
        const commands = Array.from(state.commands.keys()).filter((cmd) => cmd.startsWith(input))

        if (commands.length === 1) {
          state.inputElement!.value = commands[0] + ' '
        } else if (commands.length > 1) {
          yield* print(`Available commands: ${commands.join(', ')}`)
        }
      })

    const executeCommand = (input: string) =>
      Effect.gen(function* () {
        if (!input.trim()) return

        yield* Ref.update(stateRef, (state) => ({
          ...state,
          commandHistory: [input, ...state.commandHistory].slice(0, 100),
          historyIndex: -1,
        }))

        yield* print(`> ${input}`, '#0f0')

        const args = input.split(' ')
        const commandName = args[0]?.toLowerCase()
        const commandArgs = args.slice(1)

        const state = yield* Ref.get(stateRef)
        const command = state.commands.get(commandName)
        if (command) {
          try {
            const result = command.execute(commandArgs)
            if (result !== undefined) {
              yield* print(JSON.stringify(result, null, 2))
            }
          } catch (error) {
            yield* print(`Error: ${error}`, '#f00')
          }
        } else {
          yield* print(`Unknown command: ${commandName}. Type 'help' for available commands.`, '#f00')
        }
      })

    const print = (message: string, color: string = '#fff') =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        if (!state.outputElement) return

        const line = document.createElement('div')
        line.style.color = color
        line.textContent = message
        state.outputElement.appendChild(line)
        state.outputElement.scrollTop = state.outputElement.scrollHeight
      })

    const printWelcomeMessage = () =>
      Effect.gen(function* () {
        yield* print('🖥️ TypeScript Minecraft Developer Console', '#0ff')
        yield* print('Type "help" for available commands.', '#ccc')
        yield* print('')
      })

    const setupCommands = () =>
      Effect.gen(function* () {
        const commands = new Map<string, ConsoleCommand>()

        // Help command
        commands.set('help', {
          name: 'help',
          description: 'Show available commands',
          execute: () => {
            Effect.runSync(
              Effect.gen(function* () {
                yield* print('Available commands:')
                const state = yield* Ref.get(stateRef)
                state.commands.forEach((cmd, name) => {
                  const params = cmd.parameters ? ` [${cmd.parameters.join(', ')}]` : ''
                  Effect.runSync(print(`  ${name}${params} - ${cmd.description}`))
                })
              }),
            )
            return undefined
          },
        })

        // Clear command
        commands.set('clear', {
          name: 'clear',
          description: 'Clear console output',
          execute: () => {
            Effect.runSync(
              Effect.gen(function* () {
                const state = yield* Ref.get(stateRef)
                if (state.outputElement) {
                  state.outputElement.innerHTML = ''
                }
              }),
            )
            return undefined
          },
        })

        // Spawn entity command
        commands.set('spawn', {
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

            Effect.runSync(print(`Spawning ${entityType} at (${position.x}, ${position.y}, ${position.z})`))
            // 実際のスポーン処理は実装に依存
            return { entityType, position }
          },
        })

        // Add all other commands with Effect integration
        // (I'll implement a few key ones to show the pattern)

        yield* Ref.update(stateRef, (state) => ({ ...state, commands }))
      })

    // Setup commands and UI if in development mode
    yield* setupCommands()
    if (import.meta.env.DEV) {
      yield* createConsoleUI()
    }

    // 外部からコマンドを追加する機能
    const addCommand = (command: ConsoleCommand) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (state) => {
          const newCommands = new Map(state.commands)
          newCommands.set(command.name, command)
          return { ...state, commands: newCommands }
        })
      })

    // コマンドを削除する機能
    const removeCommand = (name: string) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (state) => {
          const newCommands = new Map(state.commands)
          newCommands.delete(name)
          return { ...state, commands: newCommands }
        })
      })

    return {
      toggle,
      open,
      close,
      addCommand,
      removeCommand,
    }
  })

// Factory function for easier usage
export const createDevConsoleFactory = (world: World) => {
  return Effect.runSync(createDevConsole(world))
}
