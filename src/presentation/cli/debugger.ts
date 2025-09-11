import { World } from '@/domain/entities'
import { Query } from '../domain/queries'
import { PerformanceProfiler } from './performance-profiler'
import { DevConsole } from './dev-console'
import { EntityInspector } from './entity-inspector'
import { Effect } from 'effect'
import { PerformanceDashboard } from '../domain/performance'

export interface DebuggerState {
  showOverlay: boolean
  showPerformanceGraph: boolean
  showMemoryUsage: boolean
  showEntityCount: boolean
  showSystemMetrics: boolean
  recordingSession: boolean
  watchedEntities: Set<string>
  watchedComponents: Set<string>
  breakpoints: Map<string, any>
  frameByFrameMode: boolean
  stepMode: 'none' | 'frame' | 'system' | 'component'
}

export interface DebugBreakpoint {
  id: string
  type: 'component' | 'system' | 'entity' | 'performance'
  condition: string
  enabled: boolean
  hitCount: number
  callback?: (context: any) => void
}

export interface DebugSession {
  id: string
  startTime: number
  endTime?: number
  data: any[]
  metadata: Record<string, any>
}

export class GameDebugger {
  private performanceProfiler: PerformanceProfiler
  private devConsole: DevConsole
  private entityInspector: EntityInspector
  private isEnabled: boolean = false
  private overlay: HTMLElement | null = null
  private detailsPanel: HTMLElement | null = null
  private state: DebuggerState
  private updateInterval: number | null = null
  private recordingData: any[] = []
  private debugSessions: Map<string, DebugSession> = new Map()
  private breakpoints: Map<string, DebugBreakpoint> = new Map()
  private currentFrame = 0
  private isPaused = false

  constructor(private world: World) {
    this.performanceProfiler = new PerformanceProfiler()
    this.devConsole = new DevConsole(world)
    this.entityInspector = new EntityInspector(world)
    
    this.state = {
      showOverlay: true,
      showPerformanceGraph: true,
      showMemoryUsage: true,
      showEntityCount: true,
      showSystemMetrics: true,
      recordingSession: false,
      watchedEntities: new Set(),
      watchedComponents: new Set(),
      breakpoints: new Map(),
      frameByFrameMode: false,
      stepMode: 'none'
    }
    
    // 開発環境でのみ有効化
    if (import.meta.env.DEV) {
      this.enable()
      this.setupKeyboardShortcuts()
      this.integrateWithPerformanceSystem()
    }
  }

  enable(): void {
    this.isEnabled = true
    this.createOverlay()
    this.createDetailsPanel()
    this.performanceProfiler.start()
    this.startUpdateInterval()
    console.log('🔧 Enhanced Game Debugger enabled')
  }

  disable(): void {
    this.isEnabled = false
    this.removeOverlay()
    this.removeDetailsPanel()
    this.stopUpdateInterval()
    this.performanceProfiler.stop()
    console.log('🔧 Game Debugger disabled')
  }

  toggle(): void {
    if (this.isEnabled) {
      this.disable()
    } else {
      this.enable()
    }
  }

  private createOverlay(): void {
    if (this.overlay) return

    this.overlay = document.createElement('div')
    this.overlay.id = 'debug-overlay'
    this.overlay.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 350px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 12px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      border-radius: 8px;
      border: 1px solid #333;
      z-index: 9999;
      pointer-events: auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    `

    // Add controls
    this.overlay.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 6px;">
        <strong style="color: #00ff00;">🔧 Debug Console</strong>
        <div>
          <button id="pause-btn" style="background: #333; border: 1px solid #555; color: white; padding: 2px 6px; margin: 0 2px; border-radius: 3px; cursor: pointer; font-size: 10px;">⏸️</button>
          <button id="step-btn" style="background: #333; border: 1px solid #555; color: white; padding: 2px 6px; margin: 0 2px; border-radius: 3px; cursor: pointer; font-size: 10px;">👣</button>
          <button id="record-btn" style="background: #333; border: 1px solid #555; color: white; padding: 2px 6px; margin: 0 2px; border-radius: 3px; cursor: pointer; font-size: 10px;">⏺️</button>
          <button id="settings-btn" style="background: #333; border: 1px solid #555; color: white; padding: 2px 6px; margin: 0 2px; border-radius: 3px; cursor: pointer; font-size: 10px;">⚙️</button>
          <button id="close-btn" style="background: #d33; border: none; color: white; padding: 2px 6px; margin: 0 2px; border-radius: 3px; cursor: pointer; font-size: 10px;">✕</button>
        </div>
      </div>
      <div id="debug-content"></div>
    `

    document.body.appendChild(this.overlay)
    this.setupOverlayControls()
  }

  private createDetailsPanel(): void {
    this.detailsPanel = document.createElement('div')
    this.detailsPanel.id = 'debug-details-panel'
    this.detailsPanel.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      width: 400px;
      height: 300px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 12px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      border-radius: 8px;
      border: 1px solid #333;
      z-index: 9998;
      display: none;
      flex-direction: column;
      overflow-y: auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    `

    this.detailsPanel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 6px;">
        <strong style="color: #00ccff;">📊 System Metrics</strong>
        <button id="close-details-btn" style="background: #d33; border: none; color: white; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 10px;">✕</button>
      </div>
      <div id="details-content"></div>
    `

    document.body.appendChild(this.detailsPanel)

    const closeBtn = this.detailsPanel.querySelector('#close-details-btn')
    closeBtn?.addEventListener('click', () => {
      this.detailsPanel!.style.display = 'none'
    })
  }

  private setupOverlayControls(): void {
    const pauseBtn = this.overlay?.querySelector('#pause-btn')
    const stepBtn = this.overlay?.querySelector('#step-btn')
    const recordBtn = this.overlay?.querySelector('#record-btn')
    const settingsBtn = this.overlay?.querySelector('#settings-btn')
    const closeBtn = this.overlay?.querySelector('#close-btn')

    pauseBtn?.addEventListener('click', () => this.togglePause())
    stepBtn?.addEventListener('click', () => this.stepFrame())
    recordBtn?.addEventListener('click', () => this.toggleRecording())
    settingsBtn?.addEventListener('click', () => this.showDetailsPanel())
    closeBtn?.addEventListener('click', () => this.disable())
  }

  private removeOverlay(): void {
    if (this.overlay) {
      document.body.removeChild(this.overlay)
      this.overlay = null
    }
  }

  private removeDetailsPanel(): void {
    if (this.detailsPanel) {
      document.body.removeChild(this.detailsPanel)
      this.detailsPanel = null
    }
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (event) => {
      if (!this.isEnabled) return

      // F12 でデバッガーのトグル
      if (event.key === 'F12') {
        event.preventDefault()
        this.toggle()
      }
      
      // Ctrl+Shift+D で開発者コンソールを開く
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault()
        this.devConsole.toggle()
      }
      
      // Ctrl+Shift+I でエンティティインスペクターを開く
      if (event.ctrlKey && event.shiftKey && event.key === 'I') {
        event.preventDefault()
        this.entityInspector.toggle()
      }

      // Ctrl+Shift+P でポーズ/再開
      if (event.ctrlKey && event.shiftKey && event.key === 'P') {
        event.preventDefault()
        this.togglePause()
      }

      // Ctrl+Shift+S でステップ実行
      if (event.ctrlKey && event.shiftKey && event.key === 'S') {
        event.preventDefault()
        this.stepFrame()
      }

      // Ctrl+Shift+R でレコーディング切り替え
      if (event.ctrlKey && event.shiftKey && event.key === 'R') {
        event.preventDefault()
        this.toggleRecording()
      }
    })
  }

  private integrateWithPerformanceSystem(): void {
    // Performance system integration
    Effect.runSync(
      Effect.gen(function* () {
        yield* Effect.log('🔗 Integrating debugger with performance system...')
        // Initialize performance monitoring if needed
      })
    )
  }

  private startUpdateInterval(): void {
    this.updateInterval = window.setInterval(() => {
      if (this.isEnabled && !this.isPaused) {
        this.updateDebugInfo()
      }
    }, 100) // 100ms update interval
  }

  private stopUpdateInterval(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
  }

  update(deltaTime: number): void {
    if (!this.isEnabled) return

    this.currentFrame++
    this.performanceProfiler.update(deltaTime)
    
    // Check breakpoints
    this.checkBreakpoints()
    
    // Update overlay if not paused
    if (!this.isPaused) {
      this.updateDebugInfo()
    }

    // Record data if recording
    if (this.state.recordingSession) {
      this.recordFrameData(deltaTime)
    }
  }

  private updateDebugInfo(): void {
    if (!this.overlay) return

    const content = this.overlay.querySelector('#debug-content')
    if (!content) return

    const stats = this.performanceProfiler.getStats()
    const entityCount = this.getEntityCount()
    
    // Get real-time performance metrics
    const metrics = Effect.runSync(
      Effect.gen(function* () {
        return yield* PerformanceDashboard.getRealTimeMetrics()
      })
    ) as { fps: number; memoryUsage: number; memoryPercentage: number; activeLeaks: number; profiledOperations: number }
    
    content.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10px;">
          <div><strong>Frame:</strong> ${this.currentFrame}</div>
          <div><strong>Status:</strong> ${this.isPaused ? '⏸️ Paused' : '▶️ Running'}</div>
          <div><strong>FPS:</strong> ${metrics.fps.toFixed(1)}</div>
          <div><strong>Frame Time:</strong> ${stats.frameTime.toFixed(2)}ms</div>
          <div><strong>Memory:</strong> ${(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB</div>
          <div><strong>Memory %:</strong> ${metrics.memoryPercentage.toFixed(1)}%</div>
          <div><strong>Entities:</strong> ${entityCount}</div>
          <div><strong>Leaks:</strong> ${metrics.activeLeaks}</div>
          <div><strong>Draw Calls:</strong> ${stats.drawCalls}</div>
          <div><strong>Triangles:</strong> ${stats.triangles}</div>
          <div><strong>Profiled Ops:</strong> ${metrics.profiledOperations}</div>
          <div><strong>Watched:</strong> ${this.state.watchedEntities.size}</div>
        </div>
        <div style="margin-top: 8px; font-size: 9px; color: #888;">
          F12: Toggle | Ctrl+Shift+P: Pause | Ctrl+Shift+S: Step | Ctrl+Shift+R: Record
        </div>
      `
  }

  private getEntityCount(): number {
    // Implement actual entity counting logic based on your World implementation
    return 0 // Placeholder
  }

  // Enhanced debugging features
  togglePause(): void {
    this.isPaused = !this.isPaused
    console.log(`🎮 Game ${this.isPaused ? 'paused' : 'resumed'}`)
    
    if (this.isPaused) {
      this.onGamePaused()
    } else {
      this.onGameResumed()
    }
  }

  stepFrame(): void {
    if (this.isPaused) {
      this.currentFrame++
      this.updateDebugInfo()
      console.log(`👣 Stepped to frame ${this.currentFrame}`)
    }
  }

  toggleRecording(): void {
    this.state.recordingSession = !this.state.recordingSession
    
    if (this.state.recordingSession) {
      this.startDebuggingSession()
    } else {
      this.stopDebuggingSession()
    }
  }

  showDetailsPanel(): void {
    if (this.detailsPanel) {
      this.detailsPanel.style.display = 'flex'
      this.updateDetailsPanel()
    }
  }

  private updateDetailsPanel(): void {
    if (!this.detailsPanel) return

    const content = this.detailsPanel.querySelector('#details-content')
    if (!content) return

    const report = Effect.runSync(
      Effect.gen(function* () {
        return yield* PerformanceDashboard.generateReport()
      })
    ) as string
    
    content.innerHTML = `<pre style="font-size: 9px; line-height: 1.2; white-space: pre-wrap;">${report}</pre>`
  }

  // Breakpoint system
  addBreakpoint(breakpoint: DebugBreakpoint): void {
    this.breakpoints.set(breakpoint.id, breakpoint)
    console.log(`🔴 Breakpoint added: ${breakpoint.id}`)
  }

  removeBreakpoint(id: string): void {
    this.breakpoints.delete(id)
    console.log(`🟢 Breakpoint removed: ${id}`)
  }

  private checkBreakpoints(): void {
    this.breakpoints.forEach((breakpoint) => {
      if (breakpoint.enabled && this.evaluateBreakpointCondition(breakpoint)) {
        breakpoint.hitCount++
        this.onBreakpointHit(breakpoint)
      }
    })
  }

  private evaluateBreakpointCondition(_breakpoint: DebugBreakpoint): boolean {
    // Implement condition evaluation logic
    return false // Placeholder
  }

  private onBreakpointHit(breakpoint: DebugBreakpoint): void {
    this.isPaused = true
    console.log(`🔴 Breakpoint hit: ${breakpoint.id} (${breakpoint.hitCount} times)`)
    
    if (breakpoint.callback) {
      breakpoint.callback({
        frame: this.currentFrame,
        breakpoint,
        world: this.world
      })
    }
  }

  // Entity watching system
  watchEntity(entityId: string): void {
    this.state.watchedEntities.add(entityId)
    console.log(`👁️ Watching entity: ${entityId}`)
  }

  unwatchEntity(entityId: string): void {
    this.state.watchedEntities.delete(entityId)
    console.log(`👁️ Stopped watching entity: ${entityId}`)
  }

  watchComponent(componentType: string): void {
    this.state.watchedComponents.add(componentType)
    console.log(`👁️ Watching component type: ${componentType}`)
  }

  unwatchComponent(componentType: string): void {
    this.state.watchedComponents.delete(componentType)
    console.log(`👁️ Stopped watching component type: ${componentType}`)
  }

  // Session management
  private startDebuggingSession(): string {
    const sessionId = `debug-${Date.now()}`
    const session: DebugSession = {
      id: sessionId,
      startTime: Date.now(),
      data: [],
      metadata: {
        startFrame: this.currentFrame,
        watchedEntities: Array.from(this.state.watchedEntities),
        watchedComponents: Array.from(this.state.watchedComponents)
      }
    }
    
    this.debugSessions.set(sessionId, session)
    this.recordingData = []
    console.log(`🎬 Started debugging session: ${sessionId}`)
    return sessionId
  }

  private stopDebuggingSession(): void {
    const activeSessions = Array.from(this.debugSessions.values()).filter(s => !s.endTime)
    
    activeSessions.forEach(session => {
      session.endTime = Date.now()
      session.data = [...this.recordingData]
      console.log(`🎬 Stopped debugging session: ${session.id}`)
      console.log(`📊 Recorded ${session.data.length} frames`)
    })
    
    this.recordingData = []
  }

  private recordFrameData(deltaTime: number): void {
    const frameData = {
      frame: this.currentFrame,
      timestamp: Date.now(),
      deltaTime,
      stats: this.performanceProfiler.getStats(),
      watchedEntities: this.getWatchedEntitiesData(),
      systemMetrics: this.getSystemMetrics()
    }
    
    this.recordingData.push(frameData)
  }

  private getWatchedEntitiesData(): any[] {
    // Implement watched entities data collection
    return []
  }

  private getSystemMetrics(): any {
    // Implement system metrics collection
    return {}
  }

  private onGamePaused(): void {
    // Notify other systems about pause
    this.updateDebugInfo()
  }

  private onGameResumed(): void {
    // Notify other systems about resume
    this.updateDebugInfo()
  }

  // Enhanced query debugging
  debugQuery(query: Query, context?: any): void {
    if (!this.isEnabled) return
    
    console.group(`🔍 Query Debug: ${query.constructor.name}`)
    console.log('Query components:', query)
    console.log('Context:', context)
    console.log('Frame:', this.currentFrame)
    console.log('Timestamp:', new Date().toISOString())
    
    // Add query to watch list if requested
    if (context?.watch) {
      console.log('Added to watch list')
    }
    
    console.groupEnd()
  }

  // Enhanced component editing
  editComponent(entityId: string, componentType: string, newData: any): void {
    if (!this.isEnabled) return
    
    console.log(`✏️ Editing component ${componentType} for entity ${entityId}`, newData)
    
    // Record the edit
    if (this.state.recordingSession) {
      this.recordingData.push({
        type: 'component_edit',
        frame: this.currentFrame,
        timestamp: Date.now(),
        entityId,
        componentType,
        oldData: null, // Get current data
        newData
      })
    }
  }

  // Performance recording
  startPerformanceRecording(): void {
    this.performanceProfiler.startRecording()
    console.log('📊 Performance recording started')
  }

  stopPerformanceRecording(): any {
    const data = this.performanceProfiler.stopRecording()
    console.log('📊 Performance recording stopped', data)
    return data
  }

  // Export debug data
  exportDebugData(): any {
    return {
      sessions: Array.from(this.debugSessions.values()),
      breakpoints: Array.from(this.breakpoints.values()),
      state: this.state,
      currentFrame: this.currentFrame,
      performance: this.performanceProfiler.exportPerformanceData()
    }
  }

  // Import debug configuration
  importDebugConfig(config: any): void {
    if (config.breakpoints) {
      config.breakpoints.forEach((bp: DebugBreakpoint) => {
        this.addBreakpoint(bp)
      })
    }
    
    if (config.watchedEntities) {
      config.watchedEntities.forEach((id: string) => {
        this.watchEntity(id)
      })
    }
    
    if (config.watchedComponents) {
      config.watchedComponents.forEach((type: string) => {
        this.watchComponent(type)
      })
    }
    
    console.log('🔧 Debug configuration imported')
  }

  // Get current debugger state
  getState(): DebuggerState {
    return { ...this.state }
  }

  // Cleanup
  destroy(): void {
    this.disable()
    this.debugSessions.clear()
    this.breakpoints.clear()
    console.log('🔧 Game Debugger destroyed')
  }
}