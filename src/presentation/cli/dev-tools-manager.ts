import { createGameDebugger } from '@presentation/cli/debugger'
import { createPerformanceProfiler } from '@presentation/cli/performance-profiler'
import { createDevConsole } from '@presentation/cli/dev-console'
import { createEntityInspector } from '@presentation/cli/entity-inspector'
import { createWorldEditor } from '@presentation/cli/world-editor'
import { createNetworkInspector } from '@presentation/cli/network-inspector'
import { World } from '@domain/entities'
import { Effect, Ref, pipe } from 'effect'

export interface DevToolsConfig {
  enableDebugger: boolean
  enablePerformanceProfiler: boolean
  enableDevConsole: boolean
  enableEntityInspector: boolean
  enableWorldEditor: boolean
  enableNetworkInspector: boolean
  autoStart: boolean
  showWelcome: boolean
}

export interface DevToolsState {
  gameDebugger: any | null
  performanceProfiler: any | null
  devConsole: any | null
  entityInspector: any | null
  worldEditor: any | null
  networkInspector: any | null
  isEnabled: boolean
  config: DevToolsConfig
  toolbarElement: HTMLElement | null
}

export const createDevToolsManager = (world: World, config: Partial<DevToolsConfig> = {}) => Effect.gen(function* () {
  const defaultConfig: DevToolsConfig = {
    enableDebugger: true,
    enablePerformanceProfiler: true,
    enableDevConsole: true,
    enableEntityInspector: true,
    enableWorldEditor: true,
    enableNetworkInspector: true,
    autoStart: true,
    showWelcome: true,
    ...config,
  }

  const stateRef = yield* Ref.make<DevToolsState>({
    gameDebugger: null,
    performanceProfiler: null,
    devConsole: null,
    entityInspector: null,
    worldEditor: null,
    networkInspector: null,
    isEnabled: false,
    config: defaultConfig,
    toolbarElement: null,
  })

  // 開発環境でのみ有効
  if (import.meta.env.DEV) {
    yield* initialize()
  }

  const initialize = () => Effect.gen(function* () {
    yield* Effect.log('🔧 Initializing Development Tools...')

    const state = yield* Ref.get(stateRef)

    // 各ツールを初期化
    if (state.config.enableDebugger) {
      const gameDebugger = yield* createGameDebugger(world)
      yield* Ref.update(stateRef, s => ({ ...s, gameDebugger }))
    }

    if (state.config.enablePerformanceProfiler) {
      const performanceProfiler = yield* createPerformanceProfiler()
      yield* Ref.update(stateRef, s => ({ ...s, performanceProfiler }))
    }

    if (state.config.enableDevConsole) {
      const devConsole = yield* createDevConsole(world)
      yield* Ref.update(stateRef, s => ({ ...s, devConsole }))
    }

    if (state.config.enableEntityInspector) {
      const entityInspector = yield* createEntityInspector(world)
      yield* Ref.update(stateRef, s => ({ ...s, entityInspector }))
    }

    if (state.config.enableWorldEditor) {
      const worldEditor = yield* createWorldEditor(world)
      yield* Ref.update(stateRef, s => ({ ...s, worldEditor }))
    }

    if (state.config.enableNetworkInspector) {
      const networkInspector = yield* createNetworkInspector()
      yield* Ref.update(stateRef, s => ({ ...s, networkInspector }))
    }

    yield* createToolbar()
    yield* setupGlobalKeyboardShortcuts()

    if (state.config.autoStart) {
      yield* enable()
    }

    if (state.config.showWelcome) {
      yield* showWelcomeMessage()
    }
  })

  const createToolbar = () => Effect.gen(function* () {
    const toolbarElement = document.createElement('div')
    toolbarElement.id = 'dev-tools-toolbar'
    toolbarElement.style.cssText = `
      position: fixed;
      top: 50%;
      left: 10px;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      gap: 5px;
      z-index: 9999;
      background: rgba(0, 0, 0, 0.8);
      padding: 8px;
      border-radius: 6px;
      border: 1px solid #333;
    `

    // ツールバーの各ボタンを作成
    const buttons = [
      { icon: '🔧', title: 'Toggle Debugger (F12)', action: () => Effect.runSync(toggleDebugger()) },
      { icon: '🖥️', title: 'Toggle Console (Ctrl+Shift+D)', action: () => Effect.runSync(toggleConsole()) },
      { icon: '🔍', title: 'Toggle Inspector (Ctrl+Shift+I)', action: () => Effect.runSync(toggleEntityInspector()) },
      { icon: '🏗️', title: 'Toggle World Editor (Ctrl+Shift+W)', action: () => Effect.runSync(toggleWorldEditor()) },
      { icon: '🌐', title: 'Toggle Network Inspector (Ctrl+Shift+N)', action: () => Effect.runSync(toggleNetworkInspector()) },
      { icon: '📊', title: 'Toggle Performance (Ctrl+Shift+P)', action: () => Effect.runSync(togglePerformanceProfiler()) },
      { icon: '❌', title: 'Close Dev Tools', action: () => Effect.runSync(disable()) },
    ]

    buttons.forEach(({ icon, title, action }) => {
      const button = document.createElement('button')
      button.textContent = icon
      button.title = title
      button.style.cssText = `
        width: 30px;
        height: 30px;
        background: #333;
        border: 1px solid #555;
        color: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      `

      button.onmouseover = () => {
        button.style.background = '#555'
      }
      button.onmouseout = () => {
        button.style.background = '#333'
      }
      button.onclick = action

      toolbarElement.appendChild(button)
    })

    document.body.appendChild(toolbarElement)
    yield* Ref.update(stateRef, state => ({ ...state, toolbarElement }))
  })

  const setupGlobalKeyboardShortcuts = () => Effect.gen(function* () {
    document.addEventListener('keydown', (event) => {
      Effect.runSync(Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        if (!state.isEnabled) return

        if (event.ctrlKey && event.shiftKey) {
          switch (event.key.toUpperCase()) {
            case 'D':
              event.preventDefault()
              yield* toggleConsole()
              break
            case 'I':
              event.preventDefault()
              yield* toggleEntityInspector()
              break
            case 'W':
              event.preventDefault()
              yield* toggleWorldEditor()
              break
            case 'N':
              event.preventDefault()
              yield* toggleNetworkInspector()
              break
            case 'P':
              event.preventDefault()
              yield* togglePerformanceProfiler()
              break
          }
        } else if (event.key === 'F12') {
          event.preventDefault()
          yield* toggleDebugger()
        }
      }))
    })
  })

  const showWelcomeMessage = () => Effect.gen(function* () {
    yield* Effect.delay(1000)
    yield* Effect.log(`
╔═══════════════════════════════════════════════╗
║          🔧 TypeScript Minecraft             ║
║            Development Tools                 ║
╠═══════════════════════════════════════════════╣
║  F12                - Toggle Debugger        ║
║  Ctrl+Shift+D       - Developer Console      ║
║  Ctrl+Shift+I       - Entity Inspector       ║
║  Ctrl+Shift+W       - World Editor           ║
║  Ctrl+Shift+N       - Network Inspector      ║
║  Ctrl+Shift+P       - Performance Profiler   ║
╚═══════════════════════════════════════════════╝`)
  })

  // 公開API
  const enable = () => Effect.gen(function* () {
    yield* Ref.update(stateRef, state => ({ ...state, isEnabled: true }))
    const state = yield* Ref.get(stateRef)
    
    if (state.gameDebugger && state.gameDebugger.enable) {
      yield* Effect.tryPromise(() => state.gameDebugger.enable())
    }
    if (state.performanceProfiler && state.performanceProfiler.start) {
      yield* Effect.tryPromise(() => state.performanceProfiler.start())
    }
    if (state.toolbarElement) {
      state.toolbarElement.style.display = 'flex'
    }
    yield* Effect.log('🔧 Development Tools enabled')
  })

  const disable = () => Effect.gen(function* () {
    yield* Ref.update(stateRef, state => ({ ...state, isEnabled: false }))
    const state = yield* Ref.get(stateRef)
    
    yield* closeAllTools()
    if (state.gameDebugger && state.gameDebugger.disable) {
      yield* Effect.tryPromise(() => state.gameDebugger.disable())
    }
    if (state.performanceProfiler && state.performanceProfiler.stop) {
      yield* Effect.tryPromise(() => state.performanceProfiler.stop())
    }
    if (state.toolbarElement) {
      state.toolbarElement.style.display = 'none'
    }
    yield* Effect.log('🔧 Development Tools disabled')
  })

  const toggle = () => Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (state.isEnabled) {
      yield* disable()
    } else {
      yield* enable()
    }
  })

  const closeAllTools = () => Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (state.devConsole && state.devConsole.close) {
      yield* Effect.tryPromise(() => state.devConsole.close())
    }
    if (state.entityInspector && state.entityInspector.close) {
      yield* Effect.tryPromise(() => state.entityInspector.close())
    }
    if (state.worldEditor && state.worldEditor.close) {
      yield* Effect.tryPromise(() => state.worldEditor.close())
    }
    if (state.networkInspector && state.networkInspector.close) {
      yield* Effect.tryPromise(() => state.networkInspector.close())
    }
  })

  // 個別ツールの制御メソッド
  const toggleDebugger = () => Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (state.gameDebugger && state.gameDebugger.toggle) {
      yield* Effect.tryPromise(() => state.gameDebugger.toggle())
    }
  })

  const toggleConsole = () => Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (state.devConsole && state.devConsole.toggle) {
      yield* Effect.tryPromise(() => state.devConsole.toggle())
    }
  })

  const toggleEntityInspector = () => Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (state.entityInspector && state.entityInspector.toggle) {
      yield* Effect.tryPromise(() => state.entityInspector.toggle())
    }
  })

  const toggleWorldEditor = () => Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (state.worldEditor && state.worldEditor.toggle) {
      yield* Effect.tryPromise(() => state.worldEditor.toggle())
    }
  })

  const toggleNetworkInspector = () => Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (state.networkInspector && state.networkInspector.toggle) {
      yield* Effect.tryPromise(() => state.networkInspector.toggle())
    }
  })

  const togglePerformanceProfiler = () => Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (state.performanceProfiler) {
      // パフォーマンスプロファイラーのUI表示/非表示を切り替え
      yield* Effect.log('📊 Performance profiler toggled')
    }
  })

  // ゲームループから呼び出すメソッド
  const update = (deltaTime: number) => Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (!state.isEnabled) return

    if (state.gameDebugger && state.gameDebugger.update) {
      yield* Effect.tryPromise(() => state.gameDebugger.update(deltaTime))
    }

    if (state.performanceProfiler && state.performanceProfiler.update) {
      yield* Effect.tryPromise(() => state.performanceProfiler.update(deltaTime))
    }
  })

  // 統計情報の取得
  const getStats = () => Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (!state.isEnabled) return null

    return {
      enabled: state.isEnabled,
      tools: {
        debugger: !!state.gameDebugger,
        console: !!state.devConsole,
        entityInspector: !!state.entityInspector,
        worldEditor: !!state.worldEditor,
        networkInspector: !!state.networkInspector,
        performanceProfiler: !!state.performanceProfiler,
      },
      performance: state.performanceProfiler?.getStats?.() || null,
      network: state.networkInspector?.getNetworkSummary?.() || null,
      worldEditor: state.worldEditor?.getStats?.() || null,
      entityInspector: state.entityInspector?.getEntityStats?.() || null,
    }
  })

  // 設定の更新
  const updateConfig = (newConfig: Partial<DevToolsConfig>) => Effect.gen(function* () {
    yield* Ref.update(stateRef, state => ({
      ...state,
      config: { ...state.config, ...newConfig }
    }))
    const state = yield* Ref.get(stateRef)
    yield* Effect.log('🔧 Dev tools config updated:', state.config)
  })

  // パフォーマンス記録
  const startPerformanceRecording = () => Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (state.gameDebugger && state.gameDebugger.startPerformanceRecording) {
      yield* Effect.tryPromise(() => state.gameDebugger.startPerformanceRecording())
    }
  })

  const stopPerformanceRecording = () => Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (state.gameDebugger && state.gameDebugger.stopPerformanceRecording) {
      return yield* Effect.tryPromise(() => state.gameDebugger.stopPerformanceRecording())
    }
    return null
  })

  // エクスポート機能
  const exportAllData = () => Effect.gen(function* () {
    const timestamp = Date.now()
    const stats = yield* getStats()
    const state = yield* Ref.get(stateRef)
    
    return {
      timestamp,
      version: '1.0.0',
      stats,
      performance: state.performanceProfiler?.exportPerformanceData?.(),
      network: state.networkInspector?.getNetworkSummary?.(),
      worldEditor: state.worldEditor?.getStats?.(),
    }
  })

  // クリーンアップ
  const destroy = () => Effect.gen(function* () {
    yield* disable()
    const state = yield* Ref.get(stateRef)
    if (state.toolbarElement) {
      document.body.removeChild(state.toolbarElement)
    }
    if (state.networkInspector && state.networkInspector.restore) {
      yield* Effect.tryPromise(() => state.networkInspector.restore())
    }
    yield* Effect.log('🔧 Development Tools destroyed')
  })

  return {
    enable,
    disable,
    toggle,
    toggleDebugger,
    toggleConsole,
    toggleEntityInspector,
    toggleWorldEditor,
    toggleNetworkInspector,
    togglePerformanceProfiler,
    update,
    getStats,
    updateConfig,
    startPerformanceRecording,
    stopPerformanceRecording,
    exportAllData,
    destroy
  }
})

// Factory function for easier usage
export const createDevToolsManagerFactory = (world: World, config?: Partial<DevToolsConfig>) => {
  return Effect.runSync(createDevToolsManager(world, config))
}
