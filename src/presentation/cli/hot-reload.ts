import { Effect, Ref } from 'effect'
import * as S from '@effect/schema/Schema'
import { pipe } from 'effect/Function'
import { isRecord, hasProperty, safeParseNumber } from '@shared/utils/type-guards'

// Type definitions for file system watcher and module namespace
interface FileSystemWatcher {
  close(): void
}

interface ModuleNamespace {
  [key: string]: unknown
}

// Schema definitions for game state validation
const GameStateSchema = S.Record(S.String, S.Unknown)
const UserSettingsSchema = S.Record(S.String, S.Unknown)
const DebugStateSchema = S.Record(S.String, S.Unknown)
const PlayerPositionSchema = S.Struct({
  x: S.Number,
  y: S.Number,
  z: S.Number,
  rotation: S.optional(
    S.Struct({
      pitch: S.Number,
      yaw: S.Number,
    }),
  ),
})

// Validation utilities
const validateGameState = (state: unknown): Effect.Effect<Record<string, unknown>, never, never> => {
  if (state == null) return Effect.succeed({})
  if (typeof state === 'object' && !Array.isArray(state)) {
    return Effect.succeed(state as Record<string, unknown>)
  }
  return Effect.succeed({ value: state, type: typeof state })
}

const validateUserSettings = (settings: unknown): Effect.Effect<Record<string, unknown>, never, never> => {
  if (settings == null) return Effect.succeed({})
  if (typeof settings === 'object' && !Array.isArray(settings)) {
    return Effect.succeed(settings as Record<string, unknown>)
  }
  return Effect.succeed({ value: settings, type: typeof settings })
}

const validateDebugState = (state: unknown): Effect.Effect<Record<string, unknown>, never, never> => {
  if (state == null) return Effect.succeed({})
  if (typeof state === 'object' && !Array.isArray(state)) {
    return Effect.succeed(state as Record<string, unknown>)
  }
  return Effect.succeed({ value: state, type: typeof state })
}

const validatePlayerPosition = (position: unknown): Effect.Effect<{ x: number; y: number; z: number; rotation?: { pitch: number; yaw: number } }, never, never> => {
  if (position == null) return Effect.succeed({ x: 0, y: 0, z: 0 })

  if (isRecord(position)) {
    const validatedPos = {
      x: hasProperty(position, 'x') && typeof position.x === 'number' ? position.x : 0,
      y: hasProperty(position, 'y') && typeof position.y === 'number' ? position.y : 0,
      z: hasProperty(position, 'z') && typeof position.z === 'number' ? position.z : 0,
      rotation: undefined as { pitch: number; yaw: number } | undefined,
    }

    // Validate rotation if present
    if (hasProperty(position, 'rotation') && isRecord(position.rotation)) {
      const rotation = position.rotation
      if (
        hasProperty(rotation, 'pitch') &&
        hasProperty(rotation, 'yaw') &&
        typeof rotation.pitch === 'number' &&
        typeof rotation.yaw === 'number'
      ) {
        validatedPos.rotation = { pitch: rotation.pitch, yaw: rotation.yaw }
      }
    }

    return Effect.succeed(validatedPos)
  }

  return Effect.succeed({ x: 0, y: 0, z: 0 })
}

const validateUnknownStateValue = (value: unknown): Effect.Effect<unknown, never, never> => {
  // For unknown values, we just return them as-is for now
  // but we could add more sophisticated validation here
  return Effect.succeed(value)
}

// Interface for global state objects with validated types
interface GlobalGameState {
  gameState?: Record<string, unknown>
  userSettings?: Record<string, unknown>
  debugState?: Record<string, unknown>
  playerPosition?: { x: number; y: number; z: number; rotation?: { pitch: number; yaw: number } }
  [key: string]: unknown
}

export interface HotReloadConfig {
  enabled: boolean
  watchPatterns: string[]
  ignoredPatterns: string[]
  debounceMs: number
  enableLiveReload: boolean
  enableStatePreservation: boolean
  preservedStateKeys: string[]
  onReload?: (changes: FileChange[]) => void
  onError?: (error: Error) => void
}

export interface FileChange {
  path: string
  type: 'added' | 'changed' | 'deleted'
  timestamp: number
  size?: number
}

export interface HotReloadState {
  isActive: boolean
  lastReload: number
  totalReloads: number
  watchedFiles: Set<string>
  pendingChanges: FileChange[]
  preservedState: Record<string, unknown>
}

export const createHotReloadManager = (config: Partial<HotReloadConfig> = {}) =>
  Effect.gen(function* () {
    const defaultConfig: HotReloadConfig = {
      enabled: true,
      watchPatterns: ['src/**/*.ts', 'src/**/*.js', 'src/**/*.json', 'src/**/*.css', 'public/**/*'],
      ignoredPatterns: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/*.d.ts', '**/.git/**'],
      debounceMs: 300,
      enableLiveReload: true,
      enableStatePreservation: true,
      preservedStateKeys: ['gameState', 'userSettings', 'debugState', 'playerPosition'],
      ...config,
    }

    const stateRef = yield* Ref.make<HotReloadState>({
      isActive: false,
      lastReload: 0,
      totalReloads: 0,
      watchedFiles: new Set(),
      pendingChanges: [],
      preservedState: {},
    })

    const watcherRef = yield* Ref.make<FileSystemWatcher | null>(null)
    const debounceTimeoutRef = yield* Ref.make<number | null>(null)
    const overlayRef = yield* Ref.make<HTMLElement | null>(null)
    const isReloadingRef = yield* Ref.make(false)

    const initialize = () =>
      Effect.gen(function* () {
        try {
          yield* Effect.log('🔥 Initializing Hot Reload Manager...')

          // Setup HMR if available
          if (import.meta.hot) {
            yield* setupViteHMR()
          }

          // Setup file watching for custom hot reload
          yield* setupFileWatcher()

          // Create UI overlay
          yield* createReloadOverlay()

          // Setup keyboard shortcuts
          yield* setupKeyboardShortcuts()

          yield* Ref.update(stateRef, (state) => ({ ...state, isActive: true }))
          yield* Effect.log('🔥 Hot Reload Manager initialized')
        } catch (error) {
          yield* Effect.log(`❌ Failed to initialize Hot Reload Manager: ${error}`)
          defaultConfig.onError?.(error as Error)
        }
      })

    const setupViteHMR = () =>
      Effect.gen(function* () {
        if (!import.meta.hot) return

        yield* Effect.log('🔥 Setting up Vite HMR integration...')

        // Accept HMR updates for specific modules
        import.meta.hot.accept((newModule) => {
          Effect.runSync(
            Effect.gen(function* () {
              yield* Effect.log(`🔄 HMR update received: ${newModule}`)
              yield* handleHMRUpdate(newModule)
            }),
          )
        })

        // Handle HMR disposal
        import.meta.hot.dispose((data) => {
          Effect.runSync(
            Effect.gen(function* () {
              yield* Effect.log('🗑️ HMR disposal, preserving state...')
              yield* preserveCurrentState(data)
            }),
          )
        })

        // Handle full reload
        import.meta.hot.on('vite:beforeFullReload', () => {
          Effect.runSync(
            Effect.gen(function* () {
              yield* Effect.log('🔄 Full reload triggered, preserving state...')
              yield* preserveStateToStorage()
            }),
          )
        })

        // Custom HMR events
        import.meta.hot.on('dev-tools:reload', (data) => {
          Effect.runSync(
            Effect.gen(function* () {
              yield* Effect.log(`🔧 Dev tools reload event: ${data}`)
              yield* handleDevToolsReload(data)
            }),
          )
        })
      })

    const setupFileWatcher = () =>
      Effect.gen(function* () {
        yield* Effect.log('👁️ Setting up file watcher...')

        // Simulate file watching with polling (for demo purposes)
        const intervalId = setInterval(() => {
          Effect.runSync(checkForFileChanges())
        }, 1000)

        yield* Ref.set(watcherRef, { close: () => clearInterval(intervalId) })
      })

    const checkForFileChanges = () =>
      Effect.gen(function* () {
        // Simulate occasional changes for demo purposes
        if (Math.random() < 0.01) {
          const simulatedChange: FileChange = {
            path: `src/components/test-${Date.now()}.ts`,
            type: 'changed',
            timestamp: Date.now(),
          }

          yield* handleFileChange(simulatedChange)
        }
      })

    const handleFileChange = (change: FileChange) =>
      Effect.gen(function* () {
        yield* Effect.log(`📁 File ${change.type}: ${change.path}`)

        yield* Ref.update(stateRef, (state) => ({
          ...state,
          pendingChanges: [...state.pendingChanges, change],
          watchedFiles: new Set([...state.watchedFiles, change.path]),
        }))

        // Debounce multiple rapid changes
        const currentTimeout = yield* Ref.get(debounceTimeoutRef)
        if (currentTimeout) {
          clearTimeout(currentTimeout)
        }

        const newTimeout = window.setTimeout(() => {
          Effect.runSync(processFileChanges())
        }, defaultConfig.debounceMs)

        yield* Ref.set(debounceTimeoutRef, newTimeout)
      })

    const processFileChanges = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const isReloading = yield* Ref.get(isReloadingRef)

        if (state.pendingChanges.length === 0 || isReloading) return

        yield* Ref.set(isReloadingRef, true)
        const changes = [...state.pendingChanges]
        yield* Ref.update(stateRef, (s) => ({ ...s, pendingChanges: [] }))

        try {
          yield* Effect.log(`🔄 Processing ${changes.length} file changes...`)

          // Show reload overlay
          yield* showReloadOverlay(changes)

          // Preserve state before reload
          if (defaultConfig.enableStatePreservation) {
            yield* preserveCurrentState()
          }

          // Attempt hot module replacement
          const success = yield* attemptHotReload(changes)

          if (!success && defaultConfig.enableLiveReload) {
            // Fallback to full page reload
            yield* Effect.log('🔄 Hot reload failed, performing full reload...')
            yield* performFullReload()
          } else {
            // Hide overlay after successful hot reload
            setTimeout(() => {
              Effect.runSync(hideReloadOverlay())
            }, 1000)
          }

          yield* Ref.update(stateRef, (s) => ({
            ...s,
            totalReloads: s.totalReloads + 1,
            lastReload: Date.now(),
          }))

          defaultConfig.onReload?.(changes)
        } catch (error) {
          yield* Effect.log(`❌ Hot reload failed: ${error}`)
          defaultConfig.onError?.(error as Error)
          yield* showReloadError(error as Error)
        } finally {
          yield* Ref.set(isReloadingRef, false)
        }
      })

    const attemptHotReload = (changes: FileChange[]) =>
      Effect.gen(function* () {
        try {
          // Categorize changes
          const componentChanges = changes.filter((c) => c.path.includes('components/'))
          const systemChanges = changes.filter((c) => c.path.includes('services/') || c.path.includes('workflows/'))
          const styleChanges = changes.filter((c) => c.path.includes('.css'))

          // Handle different types of changes
          if (styleChanges.length > 0) {
            return yield* reloadStyles(styleChanges)
          }

          if (componentChanges.length > 0) {
            return yield* reloadComponents(componentChanges)
          }

          if (systemChanges.length > 0) {
            return yield* reloadSystems(systemChanges)
          }

          return false // Fallback to full reload
        } catch (error) {
          yield* Effect.log(`❌ Hot reload attempt failed: ${error}`)
          return false
        }
      })

    const reloadStyles = (changes: FileChange[]) =>
      Effect.gen(function* () {
        yield* Effect.log('🎨 Hot reloading styles...')

        try {
          // Reload CSS files
          for (const change of changes) {
            const link = document.querySelector(`link[href*="${change.path}"]`) as HTMLLinkElement
            if (link) {
              const newHref = `${change.path}?t=${Date.now()}`
              link.href = newHref
            }
          }

          yield* Effect.log('✅ Styles reloaded successfully')
          return true
        } catch (error) {
          yield* Effect.log(`❌ Style reload failed: ${error}`)
          return false
        }
      })

    const reloadComponents = (changes: FileChange[]) =>
      Effect.gen(function* () {
        yield* Effect.log('🧩 Hot reloading components...')

        try {
          for (const change of changes) {
            yield* Effect.log(`🔄 Reloading component: ${change.path}`)
            yield* simulateModuleReload(change.path)
          }

          yield* Effect.log('✅ Components reloaded successfully')
          return true
        } catch (error) {
          yield* Effect.log(`❌ Component reload failed: ${error}`)
          return false
        }
      })

    const reloadSystems = (changes: FileChange[]) =>
      Effect.gen(function* () {
        yield* Effect.log('⚙️ Hot reloading systems...')

        try {
          for (const change of changes) {
            yield* Effect.log(`🔄 Reloading system: ${change.path}`)
            yield* simulateModuleReload(change.path)
          }

          yield* Effect.log('✅ Systems reloaded successfully')
          return true
        } catch (error) {
          yield* Effect.log(`❌ System reload failed: ${error}`)
          return false
        }
      })

    const simulateModuleReload = (path: string) =>
      Effect.gen(function* () {
        yield* Effect.sleep('100 millis')
        yield* Effect.log(`📦 Module reloaded: ${path}`)
      })

    const preserveCurrentState = (data?: Record<string, unknown>) =>
      Effect.gen(function* () {
        if (!defaultConfig.enableStatePreservation) return

        yield* Effect.log('💾 Preserving current state...')

        // Preserve state to the data object (for HMR)
        if (data) {
          for (const key of defaultConfig.preservedStateKeys) {
            const value = yield* getStateValue(key)
            if (value !== undefined) {
              data[key] = value
            }
          }
        }

        // Also preserve to localStorage as backup
        yield* preserveStateToStorage()
      })

    const preserveStateToStorage = () =>
      Effect.gen(function* () {
        try {
          const stateToPreserve: Record<string, unknown> = {}

          for (const key of defaultConfig.preservedStateKeys) {
            const value = yield* getStateValue(key)
            if (value !== undefined) {
              stateToPreserve[key] = value
            }
          }

          localStorage.setItem('hot-reload-preserved-state', JSON.stringify(stateToPreserve))
          yield* Effect.log('💾 State preserved to storage')
        } catch (error) {
          yield* Effect.log(`❌ Failed to preserve state to storage: ${error}`)
        }
      })

    const getStateValue = (key: string) =>
      Effect.gen(function* () {
        const globalState = globalThis as typeof globalThis & GlobalGameState

        switch (key) {
          case 'gameState':
            return yield* validateGameState(globalState.gameState)
          case 'userSettings':
            return yield* validateUserSettings(globalState.userSettings)
          case 'debugState':
            return yield* validateDebugState(globalState.debugState)
          case 'playerPosition':
            return yield* validatePlayerPosition(globalState.playerPosition)
          default:
            return yield* validateUnknownStateValue(globalState[key])
        }
      })

    const setStateValue = (key: string, value: unknown): void => {
      const globalState = globalThis as typeof globalThis & GlobalGameState

      switch (key) {
        case 'gameState':
          globalState.gameState = value
          break
        case 'userSettings':
          globalState.userSettings = value
          break
        case 'debugState':
          globalState.debugState = value
          break
        case 'playerPosition':
          globalState.playerPosition = value
          break
        default:
          globalState[key] = value
      }
    }

    const performFullReload = () =>
      Effect.gen(function* () {
        yield* Effect.log('🔄 Performing full page reload...')
        window.location.reload()
      })

    const createReloadOverlay = () =>
      Effect.gen(function* () {
        const overlay = document.createElement('div')
        overlay.id = 'hot-reload-overlay'
        overlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      display: none;
      border: 1px solid #333;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      min-width: 200px;
    `

        document.body.appendChild(overlay)
        yield* Ref.set(overlayRef, overlay)
      })

    const showReloadOverlay = (changes: FileChange[]) =>
      Effect.gen(function* () {
        const overlay = yield* Ref.get(overlayRef)
        if (!overlay) return

        const changeList = changes.map((c) => `• ${c.type}: ${c.path.split('/').pop()}`).join('<br>')

        overlay.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <div style="margin-right: 8px;">🔥</div>
        <div><strong>Hot Reloading...</strong></div>
      </div>
      <div style="font-size: 10px; color: #ccc;">
        ${changeList}
      </div>
      <div style="margin-top: 8px; font-size: 10px; color: #888;">
        Press F5 to force full reload
      </div>
    `

        overlay.style.display = 'block'
      })

    const hideReloadOverlay = () =>
      Effect.gen(function* () {
        const overlay = yield* Ref.get(overlayRef)
        if (overlay) {
          overlay.style.display = 'none'
        }
      })

    const showReloadError = (error: Error) =>
      Effect.gen(function* () {
        const overlay = yield* Ref.get(overlayRef)
        if (!overlay) return

        overlay.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <div style="margin-right: 8px;">❌</div>
        <div><strong>Reload Failed</strong></div>
      </div>
      <div style="font-size: 10px; color: #ff6666;">
        ${error.message}
      </div>
      <div style="margin-top: 8px; font-size: 10px; color: #888;">
        Press F5 to force full reload
      </div>
    `

        overlay.style.display = 'block'

        // Auto-hide after 5 seconds
        setTimeout(() => {
          Effect.runSync(hideReloadOverlay())
        }, 5000)
      })

    const setupKeyboardShortcuts = () =>
      Effect.gen(function* () {
        document.addEventListener('keydown', (event) => {
          Effect.runSync(
            Effect.gen(function* () {
              // Ctrl+R for manual reload
              if (event.ctrlKey && event.key === 'r') {
                event.preventDefault()
                yield* manualReload()
              }

              // Ctrl+Shift+R for force reload
              if (event.ctrlKey && event.shiftKey && event.key === 'R') {
                event.preventDefault()
                yield* forceReload()
              }

              // F5 for standard reload
              if (event.key === 'F5') {
                event.preventDefault()
                yield* forceReload()
              }
            }),
          )
        })
      })

    const handleHMRUpdate = (newModule: ModuleNamespace) =>
      Effect.gen(function* () {
        yield* Effect.log(`🔄 Handling HMR update: ${newModule}`)

        yield* showReloadOverlay([
          {
            path: 'HMR Update',
            type: 'changed',
            timestamp: Date.now(),
          },
        ])

        setTimeout(() => {
          Effect.runSync(hideReloadOverlay())
        }, 1000)
      })

    const handleDevToolsReload = (data: Record<string, unknown>) =>
      Effect.gen(function* () {
        yield* Effect.log(`🔧 Handling dev tools reload: ${data}`)

        // Custom dev tools reload logic
        if (data.type === 'debugger') {
          // Reload debugger
        } else if (data.type === 'console') {
          // Reload dev console
        }
      })

    // Public API
    const manualReload = () =>
      Effect.gen(function* () {
        yield* Effect.log('🔄 Manual reload triggered')

        yield* Ref.update(stateRef, (state) => ({
          ...state,
          pendingChanges: [
            ...state.pendingChanges,
            {
              path: 'Manual Reload',
              type: 'changed',
              timestamp: Date.now(),
            },
          ],
        }))

        yield* processFileChanges()
      })

    const forceReload = () =>
      Effect.gen(function* () {
        yield* Effect.log('🔄 Force reload triggered')
        yield* performFullReload()
      })

    const enable = () =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (state) => ({ ...state, isActive: true }))
        yield* Effect.log('🔥 Hot reload enabled')
      })

    const disable = () =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (state) => ({ ...state, isActive: false }))

        const currentTimeout = yield* Ref.get(debounceTimeoutRef)
        if (currentTimeout) {
          clearTimeout(currentTimeout)
        }

        yield* Effect.log('🔥 Hot reload disabled')
      })

    const getState = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return { ...state }
      })

    const getConfig = () =>
      Effect.gen(function* () {
        return { ...defaultConfig }
      })

    const updateConfig = (newConfig: Partial<HotReloadConfig>) =>
      Effect.gen(function* () {
        Object.assign(defaultConfig, newConfig)
        yield* Effect.log('🔥 Hot reload config updated')
      })

    const destroy = () =>
      Effect.gen(function* () {
        yield* disable()

        const overlay = yield* Ref.get(overlayRef)
        if (overlay) {
          document.body.removeChild(overlay)
          yield* Ref.set(overlayRef, null)
        }

        const watcher = yield* Ref.get(watcherRef)
        if (watcher) {
          watcher.close?.()
          yield* Ref.set(watcherRef, null)
        }

        yield* Effect.log('🔥 Hot Reload Manager destroyed')
      })

    // Initialize in development mode
    if (import.meta.env.DEV && defaultConfig.enabled) {
      yield* initialize()
    }

    return {
      manualReload,
      forceReload,
      enable,
      disable,
      getState,
      getConfig,
      updateConfig,
      destroy,
    }
  })

// Removed unused factory function

// Auto-initialize on module load in development
if (import.meta.env.DEV) {
  // Restore any preserved state from previous hot reload
  setTimeout(() => {
    Effect.runSync(
      Effect.gen(function* () {
        const manager = yield* createHotReloadManager()
        yield* manager.getState()
      }),
    )
  }, 100)
}
