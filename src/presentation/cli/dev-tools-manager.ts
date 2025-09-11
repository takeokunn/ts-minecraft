import { GameDebugger } from './debugger'
import { PerformanceProfiler } from './performance-profiler'
import { DevConsole } from './dev-console'
import { EntityInspector } from './entity-inspector'
import { WorldEditor } from './world-editor'
import { NetworkInspector } from './network-inspector'
import { World } from '/entities'

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

export class DevToolsManager {
  private gameDebugger: GameDebugger | null = null
  private performanceProfiler: PerformanceProfiler | null = null
  private devConsole: DevConsole | null = null
  private entityInspector: EntityInspector | null = null
  private worldEditor: WorldEditor | null = null
  private networkInspector: NetworkInspector | null = null

  private isEnabled: boolean = false
  private config: DevToolsConfig
  private toolbarElement: HTMLElement | null = null

  constructor(
    private world: World,
    config: Partial<DevToolsConfig> = {},
  ) {
    this.config = {
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

    // 開発環境でのみ有効
    if (import.meta.env.DEV) {
      this.initialize()
    }
  }

  private initialize(): void {
    console.log('🔧 Initializing Development Tools...')

    // 各ツールを初期化
    if (this.config.enableDebugger) {
      this.gameDebugger = new GameDebugger(this.world)
    }

    if (this.config.enablePerformanceProfiler) {
      this.performanceProfiler = new PerformanceProfiler()
    }

    if (this.config.enableDevConsole) {
      this.devConsole = new DevConsole(this.world)
    }

    if (this.config.enableEntityInspector) {
      this.entityInspector = new EntityInspector(this.world)
    }

    if (this.config.enableWorldEditor) {
      this.worldEditor = new WorldEditor(this.world)
    }

    if (this.config.enableNetworkInspector) {
      this.networkInspector = new NetworkInspector()
    }

    this.createToolbar()
    this.setupGlobalKeyboardShortcuts()

    if (this.config.autoStart) {
      this.enable()
    }

    if (this.config.showWelcome) {
      this.showWelcomeMessage()
    }
  }

  private createToolbar(): void {
    this.toolbarElement = document.createElement('div')
    this.toolbarElement.id = 'dev-tools-toolbar'
    this.toolbarElement.style.cssText = `
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
      { icon: '🔧', title: 'Toggle Debugger (F12)', action: () => this.toggleDebugger() },
      { icon: '🖥️', title: 'Toggle Console (Ctrl+Shift+D)', action: () => this.toggleConsole() },
      { icon: '🔍', title: 'Toggle Inspector (Ctrl+Shift+I)', action: () => this.toggleEntityInspector() },
      { icon: '🏗️', title: 'Toggle World Editor (Ctrl+Shift+W)', action: () => this.toggleWorldEditor() },
      { icon: '🌐', title: 'Toggle Network Inspector (Ctrl+Shift+N)', action: () => this.toggleNetworkInspector() },
      { icon: '📊', title: 'Toggle Performance (Ctrl+Shift+P)', action: () => this.togglePerformanceProfiler() },
      { icon: '❌', title: 'Close Dev Tools', action: () => this.disable() },
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

      this.toolbarElement!.appendChild(button)
    })

    document.body.appendChild(this.toolbarElement)
  }

  private setupGlobalKeyboardShortcuts(): void {
    document.addEventListener('keydown', (event) => {
      if (!this.isEnabled) return

      if (event.ctrlKey && event.shiftKey) {
        switch (event.key.toUpperCase()) {
          case 'D':
            event.preventDefault()
            this.toggleConsole()
            break
          case 'I':
            event.preventDefault()
            this.toggleEntityInspector()
            break
          case 'W':
            event.preventDefault()
            this.toggleWorldEditor()
            break
          case 'N':
            event.preventDefault()
            this.toggleNetworkInspector()
            break
          case 'P':
            event.preventDefault()
            this.togglePerformanceProfiler()
            break
        }
      } else if (event.key === 'F12') {
        event.preventDefault()
        this.toggleDebugger()
      }
    })
  }

  private showWelcomeMessage(): void {
    setTimeout(() => {
      console.log(`
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
╚═══════════════════════════════════════════════╝
      `)
    }, 1000)
  }

  // 公開API
  enable(): void {
    this.isEnabled = true
    if (this.gameDebugger) this.gameDebugger.enable()
    if (this.performanceProfiler) this.performanceProfiler.start()
    if (this.toolbarElement) this.toolbarElement.style.display = 'flex'
    console.log('🔧 Development Tools enabled')
  }

  disable(): void {
    this.isEnabled = false
    this.closeAllTools()
    if (this.gameDebugger) this.gameDebugger.disable()
    if (this.performanceProfiler) this.performanceProfiler.stop()
    if (this.toolbarElement) this.toolbarElement.style.display = 'none'
    console.log('🔧 Development Tools disabled')
  }

  toggle(): void {
    if (this.isEnabled) {
      this.disable()
    } else {
      this.enable()
    }
  }

  private closeAllTools(): void {
    if (this.devConsole) this.devConsole.close()
    if (this.entityInspector) this.entityInspector.close()
    if (this.worldEditor) this.worldEditor.close()
    if (this.networkInspector) this.networkInspector.close()
  }

  // 個別ツールの制御メソッド
  toggleDebugger(): void {
    if (this.gameDebugger) {
      this.gameDebugger.toggle()
    }
  }

  toggleConsole(): void {
    if (this.devConsole) {
      this.devConsole.toggle()
    }
  }

  toggleEntityInspector(): void {
    if (this.entityInspector) {
      this.entityInspector.toggle()
    }
  }

  toggleWorldEditor(): void {
    if (this.worldEditor) {
      this.worldEditor.toggle()
    }
  }

  toggleNetworkInspector(): void {
    if (this.networkInspector) {
      this.networkInspector.toggle()
    }
  }

  togglePerformanceProfiler(): void {
    if (this.performanceProfiler) {
      // パフォーマンスプロファイラーのUI表示/非表示を切り替え
      console.log('📊 Performance profiler toggled')
    }
  }

  // ゲームループから呼び出すメソッド
  update(deltaTime: number): void {
    if (!this.isEnabled) return

    if (this.gameDebugger) {
      this.gameDebugger.update(deltaTime)
    }

    if (this.performanceProfiler) {
      this.performanceProfiler.update(deltaTime)
    }
  }

  // 統計情報の取得
  getStats(): any {
    if (!this.isEnabled) return null

    return {
      enabled: this.isEnabled,
      tools: {
        debugger: !!this.gameDebugger,
        console: !!this.devConsole,
        entityInspector: !!this.entityInspector,
        worldEditor: !!this.worldEditor,
        networkInspector: !!this.networkInspector,
        performanceProfiler: !!this.performanceProfiler,
      },
      performance: this.performanceProfiler?.getStats() || null,
      network: this.networkInspector?.getNetworkSummary() || null,
      worldEditor: this.worldEditor?.getStats() || null,
      entityInspector: this.entityInspector?.getEntityStats() || null,
    }
  }

  // 設定の更新
  updateConfig(newConfig: Partial<DevToolsConfig>): void {
    this.config = { ...this.config, ...newConfig }
    console.log('🔧 Dev tools config updated:', this.config)
  }

  // パフォーマンス記録
  startPerformanceRecording(): void {
    if (this.gameDebugger) {
      this.gameDebugger.startPerformanceRecording()
    }
  }

  stopPerformanceRecording(): any {
    if (this.gameDebugger) {
      return this.gameDebugger.stopPerformanceRecording()
    }
    return null
  }

  // エクスポート機能
  exportAllData(): any {
    const timestamp = Date.now()
    return {
      timestamp,
      version: '1.0.0',
      stats: this.getStats(),
      performance: this.performanceProfiler?.exportPerformanceData(),
      network: this.networkInspector?.getNetworkSummary(),
      worldEditor: this.worldEditor?.getStats(),
    }
  }

  // クリーンアップ
  destroy(): void {
    this.disable()
    if (this.toolbarElement) {
      document.body.removeChild(this.toolbarElement)
    }
    if (this.networkInspector) {
      this.networkInspector.restore()
    }
    console.log('🔧 Development Tools destroyed')
  }
}
