import { Effect, Context, Ref, Layer } from 'effect'

/**
 * Debug Controller
 * デバッグUI機能の制御を担当する薄いコントローラー層
 * デバッグ情報の表示/非表示、デバッグモードの切り替えなど
 */
export interface DebugControllerInterface {
  readonly toggleDebugMode: () => Effect.Effect<void, never, never>
  readonly showPerformanceStats: (visible: boolean) => Effect.Effect<void, never, never>
  readonly showEntityInspector: (visible: boolean) => Effect.Effect<void, never, never>
  readonly showWorldEditor: (visible: boolean) => Effect.Effect<void, never, never>
  readonly executeDebugCommand: (command: string) => Effect.Effect<string, never, never>
  readonly getDebugState: () => Effect.Effect<DebugState, never, never>
}

export interface DebugState {
  readonly debugMode: boolean
  readonly performanceStatsVisible: boolean
  readonly entityInspectorVisible: boolean
  readonly worldEditorVisible: boolean
}

const DebugControllerImpl = Effect.gen(function* ($) {
  const debugStateRef = yield* $(
    Ref.make<DebugState>({
      debugMode: false,
      performanceStatsVisible: false,
      entityInspectorVisible: false,
      worldEditorVisible: false,
    }),
  )

  const toggleDebugMode = () =>
    Effect.gen(function* ($) {
      yield* $(
        Ref.update(debugStateRef, (state) => ({
          ...state,
          debugMode: !state.debugMode,
        })),
      )
      const newState = yield* $(Ref.get(debugStateRef))
      yield* $(Effect.log(`Debug mode: ${newState.debugMode ? 'ON' : 'OFF'}`))
    })

  const showPerformanceStats = (visible: boolean) =>
    Effect.gen(function* ($) {
      yield* $(
        Ref.update(debugStateRef, (state) => ({
          ...state,
          performanceStatsVisible: visible,
        })),
      )
      yield* $(Effect.log(`Performance stats: ${visible ? 'VISIBLE' : 'HIDDEN'}`))
    })

  const showEntityInspector = (visible: boolean) =>
    Effect.gen(function* ($) {
      yield* $(
        Ref.update(debugStateRef, (state) => ({
          ...state,
          entityInspectorVisible: visible,
        })),
      )
      yield* $(Effect.log(`Entity inspector: ${visible ? 'VISIBLE' : 'HIDDEN'}`))
    })

  const showWorldEditor = (visible: boolean) =>
    Effect.gen(function* ($) {
      yield* $(
        Ref.update(debugStateRef, (state) => ({
          ...state,
          worldEditorVisible: visible,
        })),
      )
      yield* $(Effect.log(`World editor: ${visible ? 'VISIBLE' : 'HIDDEN'}`))
    })

  const executeDebugCommand = (command: string) =>
    Effect.gen(function* ($) {
      yield* $(Effect.log(`Executing debug command: ${command}`))

      // 軽量化されたコマンド処理
      const cmd = command.toLowerCase().trim()

      switch (cmd) {
        case 'help':
          return 'Available commands: help, status, clear, toggle'
        case 'status':
          const state = yield* $(Ref.get(debugStateRef))
          return `Debug: ${state.debugMode ? 'ON' : 'OFF'}, Stats: ${state.performanceStatsVisible ? 'ON' : 'OFF'}`
        case 'clear':
          return 'Debug console cleared'
        case 'toggle':
          yield* $(toggleDebugMode())
          return 'Debug mode toggled'
        default:
          return `Unknown command: ${cmd}`
      }
    })

  const getDebugState = () => Ref.get(debugStateRef)

  return {
    toggleDebugMode,
    showPerformanceStats,
    showEntityInspector,
    showWorldEditor,
    executeDebugCommand,
    getDebugState,
  }
})

// Create context tag for dependency injection
export const DebugController = Context.GenericTag<DebugControllerInterface>('DebugController')

export const DebugControllerLive: Layer.Layer<DebugController, never, never> = Layer.effect(DebugController, DebugControllerImpl)

// Factory function for direct usage
export const createDebugController = () => Effect.runSync(DebugControllerLive)
