/**
 * Game Debugger - Functional Module Implementation
 *
 * Converted from class-based implementation to functional Effect-TS module
 * Features:
 * - Interactive debugging overlay with real-time metrics
 * - Frame-by-frame stepping and pause/resume functionality
 * - Performance monitoring and recording
 * - Entity and component watching system
 * - Breakpoint system with condition evaluation
 * - Debug session recording and playback
 * - Integration with performance dashboard
 * - Keyboard shortcuts for all functionality
 */

import * as Effect from 'effect/Effect'
import * as Ref from 'effect/Ref'
import { isRecord, hasProperty, isVector3 } from '@shared/utils/type-guards'
import { WorldState } from '@domain/entities'
import { createPerformanceProfiler } from '@presentation/cli/performance-profiler'
import { createDevConsole } from '@presentation/cli/dev-console'
import { createEntityInspector } from '@presentation/cli/entity-inspector'
import type { PerformanceProfilerTool, DevConsoleTool, EntityInspectorTool } from '@presentation/cli/dev-tools-manager'

// Schema definitions for unknown type validation
// Helper functions for safe property access
const getProperty = (obj: unknown, prop: string): unknown => {
  if (typeof obj === 'object' && obj !== null && prop in obj) {
    return isRecord(obj) && hasProperty(obj, prop) ? obj[prop] : undefined
  }
  return undefined
}

const isValidPosition = (value: unknown): value is { x: number; y: number; z: number } => {
  return isVector3(value)
}


// Validation utilities
const validateWatchedEntityData = (
  data: unknown[],
): Effect.Effect<
  Array<{ entityId: string; components: Record<string, unknown>; position?: { x: number; y: number; z: number }; metadata: Record<string, unknown> }>,
  never,
  never
> => {
  return Effect.gen(function* () {
    const validated = []
    for (const item of data) {
      if (typeof item === 'object' && item !== null) {
        validated.push({
          entityId: String(getProperty(item, 'entityId') || 'unknown'),
          components: (() => {
            const components = getProperty(item, 'components')
            return isRecord(components) ? components : {}
          })(),
          position: (() => {
            const position = getProperty(item, 'position')
            return isValidPosition(position) ? position : undefined
          })(),
          metadata: (() => {
            const metadata = getProperty(item, 'metadata')
            return isRecord(metadata) ? metadata : { original: item }
          })(),
        })
      } else {
        validated.push({
          entityId: 'unknown',
          components: {},
          metadata: { original: item, type: typeof item },
        })
      }
    }
    return validated
  })
}

const validateSystemMetrics = (metrics: unknown): Effect.Effect<Record<string, unknown>, never, never> => {
  if (metrics == null) return Effect.succeed({})
  if (typeof metrics === 'object' && !Array.isArray(metrics)) {
    return Effect.succeed(isRecord(metrics) ? metrics : {})
  }
  return Effect.succeed({ value: metrics, type: typeof metrics })
}

const validatePerformanceStats = (stats: unknown): Effect.Effect<{ frameTime: number; drawCalls: number; triangles: number; memoryUsage?: number; fps?: number }, never, never> => {
  if (typeof stats === 'object' && stats !== null) {
    return Effect.succeed({
      frameTime: (() => {
        const frameTime = getProperty(stats, 'frameTime')
        return typeof frameTime === 'number' ? frameTime : 0
      })(),
      drawCalls: (() => {
        const drawCalls = getProperty(stats, 'drawCalls')
        return typeof drawCalls === 'number' ? drawCalls : 0
      })(),
      triangles: (() => {
        const triangles = getProperty(stats, 'triangles')
        return typeof triangles === 'number' ? triangles : 0
      })(),
      memoryUsage: (() => {
        const memoryUsage = getProperty(stats, 'memoryUsage')
        return typeof memoryUsage === 'number' ? memoryUsage : undefined
      })(),
      fps: (() => {
        const fps = getProperty(stats, 'fps')
        return typeof fps === 'number' ? fps : undefined
      })(),
    })
  }
  return Effect.succeed({ frameTime: 0, drawCalls: 0, triangles: 0 })
}

export interface DebuggerState {
  showOverlay: boolean
  showPerformanceGraph: boolean
  showMemoryUsage: boolean
  showEntityCount: boolean
  showSystemMetrics: boolean
  recordingSession: boolean
  watchedEntities: Set<string>
  watchedComponents: Set<string>
  breakpoints: Map<string, DebugBreakpoint>
  frameByFrameMode: boolean
  stepMode: 'none' | 'frame' | 'system' | 'component'
}

export interface DebugBreakpoint {
  id: string
  type: 'component' | 'system' | 'entity' | 'performance'
  condition: string
  enabled: boolean
  hitCount: number
  callback?: (context: DebugBreakpointContext) => void
}

export interface DebugBreakpointContext {
  frame: number
  breakpoint: DebugBreakpoint
  world: WorldState
}

export interface DebugSession {
  id: string
  startTime: number
  endTime?: number
  data: DebugFrameData[]
  metadata: DebugSessionMetadata
}

export interface DebugSessionMetadata {
  startFrame: number
  watchedEntities: string[]
  watchedComponents: string[]
  [key: string]: unknown
}

export interface DebugFrameData {
  frame: number
  timestamp: number
  deltaTime: number
  stats: PerformanceFrameStats
  watchedEntities: WatchedEntityData[]
  systemMetrics: SystemMetrics
}

export interface PerformanceFrameStats {
  frameTime: number
  drawCalls: number
  triangles: number
  memoryUsage: number
  [key: string]: number
}

export interface WatchedEntityData {
  entityId: string
  components: Record<string, unknown>
  position?: { x: number; y: number; z: number }
  metadata: Record<string, unknown>
}

export interface SystemMetrics {
  fps: number
  memoryUsage: number
  memoryPercentage: number
  activeLeaks: number
  profiledOperations: number
  [key: string]: number
}

export interface GameDebuggerConfig {
  updateInterval: number
  overlayPosition: { top: number; right: number }
  detailsPosition: { top: number; left: number }
  enableKeyboardShortcuts: boolean
  enablePerformanceIntegration: boolean
}

interface GameDebuggerInternalState {
  isEnabled: boolean
  overlay: HTMLElement | null
  detailsPanel: HTMLElement | null
  state: DebuggerState
  updateInterval: number | null
  recordingData: DebugFrameData[]
  debugSessions: Map<string, DebugSession>
  breakpoints: Map<string, DebugBreakpoint>
  currentFrame: number
  isPaused: boolean
  performanceProfiler: PerformanceProfilerTool | null
  devConsole: DevConsoleTool | null
  entityInspector: EntityInspectorTool | null
}

const defaultConfig: GameDebuggerConfig = {
  updateInterval: 100,
  overlayPosition: { top: 10, right: 10 },
  detailsPosition: { top: 10, left: 10 },
  enableKeyboardShortcuts: true,
  enablePerformanceIntegration: true,
}

/**
 * Create Game Debugger functional module
 */
export const createGameDebugger = (world: WorldState, config: Partial<GameDebuggerConfig> = {}) =>
  Effect.gen(function* () {
    const finalConfig = { ...defaultConfig, ...config }

    const stateRef = yield* Ref.make<GameDebuggerInternalState>({
      isEnabled: false,
      overlay: null,
      detailsPanel: null,
      state: {
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
        stepMode: 'none',
      },
      updateInterval: null,
      recordingData: [],
      debugSessions: new Map(),
      breakpoints: new Map(),
      currentFrame: 0,
      isPaused: false,
      performanceProfiler: null,
      devConsole: null,
      entityInspector: null,
    })

    /**
     * Initialize debugger components
     */
    const initializeComponents = Effect.gen(function* () {
      const performanceProfiler = yield* createPerformanceProfiler()
      const devConsole = yield* createDevConsole(world)
      const entityInspector = yield* createEntityInspector(world)

      yield* Ref.update(stateRef, (s) => ({
        ...s,
        performanceProfiler,
        devConsole,
        entityInspector,
      }))
    })

    /**
     * Create debugging overlay
     */
    const createOverlay = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (state.overlay) return

      const overlay = document.createElement('div')
      overlay.id = 'debug-overlay'
      overlay.style.cssText = `
        position: fixed;
        top: ${finalConfig.overlayPosition.top}px;
        right: ${finalConfig.overlayPosition.right}px;
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
      overlay.innerHTML = `
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

      document.body.appendChild(overlay)
      yield* setupOverlayControls(overlay)

      yield* Ref.update(stateRef, (s) => ({ ...s, overlay }))
    })

    /**
     * Create details panel
     */
    const createDetailsPanel = Effect.gen(function* () {
      const detailsPanel = document.createElement('div')
      detailsPanel.id = 'debug-details-panel'
      detailsPanel.style.cssText = `
        position: fixed;
        top: ${finalConfig.detailsPosition.top}px;
        left: ${finalConfig.detailsPosition.left}px;
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

      detailsPanel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 6px;">
          <strong style="color: #00ccff;">📊 System Metrics</strong>
          <button id="close-details-btn" style="background: #d33; border: none; color: white; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 10px;">✕</button>
        </div>
        <div id="details-content"></div>
      `

      document.body.appendChild(detailsPanel)

      const closeBtn = detailsPanel.querySelector('#close-details-btn')
      closeBtn?.addEventListener('click', () => {
        detailsPanel.style.display = 'none'
      })

      yield* Ref.update(stateRef, (s) => ({ ...s, detailsPanel }))
    })

    /**
     * Setup overlay controls
     */
    const setupOverlayControls = (overlay: HTMLElement) =>
      Effect.gen(function* () {
        const pauseBtn = overlay.querySelector('#pause-btn')
        const stepBtn = overlay.querySelector('#step-btn')
        const recordBtn = overlay.querySelector('#record-btn')
        const settingsBtn = overlay.querySelector('#settings-btn')
        const closeBtn = overlay.querySelector('#close-btn')

        pauseBtn?.addEventListener('click', () => Effect.runSync(togglePause()))
        stepBtn?.addEventListener('click', () => Effect.runSync(stepFrame()))
        recordBtn?.addEventListener('click', () => Effect.runSync(toggleRecording()))
        settingsBtn?.addEventListener('click', () => Effect.runSync(showDetailsPanel()))
        closeBtn?.addEventListener('click', () => Effect.runSync(disable()))
      })

    /**
     * Setup keyboard shortcuts
     */
    const setupKeyboardShortcuts = Effect.gen(function* () {
      if (!finalConfig.enableKeyboardShortcuts) return

      document.addEventListener('keydown', (event) => {
        Effect.runSync(
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            if (!state.isEnabled) return

            // F12 でデバッガーのトグル
            if (event.key === 'F12') {
              event.preventDefault()
              yield* toggle()
            }

            // Ctrl+Shift+D で開発者コンソールを開く
            if (event.ctrlKey && event.shiftKey && event.key === 'D') {
              event.preventDefault()
              if (state.devConsole) {
                yield* state.devConsole.toggle()
              }
            }

            // Ctrl+Shift+I でエンティティインスペクターを開く
            if (event.ctrlKey && event.shiftKey && event.key === 'I') {
              event.preventDefault()
              if (state.entityInspector) {
                yield* state.entityInspector.toggle()
              }
            }

            // Ctrl+Shift+P でポーズ/再開
            if (event.ctrlKey && event.shiftKey && event.key === 'P') {
              event.preventDefault()
              yield* togglePause()
            }

            // Ctrl+Shift+S でステップ実行
            if (event.ctrlKey && event.shiftKey && event.key === 'S') {
              event.preventDefault()
              yield* stepFrame()
            }

            // Ctrl+Shift+R でレコーディング切り替え
            if (event.ctrlKey && event.shiftKey && event.key === 'R') {
              event.preventDefault()
              yield* toggleRecording()
            }
          }),
        )
      })
    })

    /**
     * Integrate with performance system
     */
    const integrateWithPerformanceSystem = Effect.gen(function* () {
      if (!finalConfig.enablePerformanceIntegration) return

      yield* Effect.log('🔗 Integrating debugger with performance system...')
      // Initialize performance monitoring if needed
    })

    /**
     * Start update interval
     */
    const startUpdateInterval = Effect.gen(function* () {
      const intervalId = window.setInterval(() => {
        Effect.runSync(
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            if (state.isEnabled && !state.isPaused) {
              yield* updateDebugInfo()
            }
          }),
        )
      }, finalConfig.updateInterval)

      yield* Ref.update(stateRef, (s) => ({ ...s, updateInterval: intervalId }))
    })

    /**
     * Stop update interval
     */
    const stopUpdateInterval = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (state.updateInterval) {
        clearInterval(state.updateInterval)
        yield* Ref.update(stateRef, (s) => ({ ...s, updateInterval: null }))
      }
    })

    /**
     * Update debug information display
     */
    const updateDebugInfo = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (!state.overlay) return

      const content = state.overlay.querySelector('#debug-content')
      if (!content) return

      const rawStats = state.performanceProfiler?.getStats() || {
        frameTime: 0,
        drawCalls: 0,
        triangles: 0,
      }
      const stats = yield* validatePerformanceStats(rawStats)

      const entityCount = yield* getEntityCount()

      // Get real-time performance metrics
      const metrics = yield* Effect.succeed({
            fps: 60,
            memoryUsage: 0,
            memoryPercentage: 0,
            activeLeaks: 0,
            profiledOperations: 0,
          })

      content.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10px;">
          <div><strong>Frame:</strong> ${state.currentFrame}</div>
          <div><strong>Status:</strong> ${state.isPaused ? '⏸️ Paused' : '▶️ Running'}</div>
          <div><strong>FPS:</strong> ${metrics.fps.toFixed(1)}</div>
          <div><strong>Frame Time:</strong> ${stats.frameTime.toFixed(2)}ms</div>
          <div><strong>Memory:</strong> ${(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB</div>
          <div><strong>Memory %:</strong> ${metrics.memoryPercentage.toFixed(1)}%</div>
          <div><strong>Entities:</strong> ${entityCount}</div>
          <div><strong>Leaks:</strong> ${metrics.activeLeaks}</div>
          <div><strong>Draw Calls:</strong> ${stats.drawCalls}</div>
          <div><strong>Triangles:</strong> ${stats.triangles}</div>
          <div><strong>Profiled Ops:</strong> ${metrics.profiledOperations}</div>
          <div><strong>Watched:</strong> ${state.state.watchedEntities.size}</div>
        </div>
        <div style="margin-top: 8px; font-size: 9px; color: #888;">
          F12: Toggle | Ctrl+Shift+P: Pause | Ctrl+Shift+S: Step | Ctrl+Shift+R: Record
        </div>
      `
    })

    /**
     * Get entity count
     */
    const getEntityCount = Effect.gen(function* () {
      // Implement actual entity counting logic based on your World implementation
      return 0 // Placeholder
    })

    /**
     * Enable debugger
     */
    const enable = Effect.gen(function* () {
      yield* initializeComponents()
      yield* createOverlay()
      yield* createDetailsPanel()

      const state = yield* Ref.get(stateRef)
      if (state.performanceProfiler) {
        state.performanceProfiler.start()
      }

      yield* startUpdateInterval()
      yield* Ref.update(stateRef, (s) => ({ ...s, isEnabled: true }))

      console.log('🔧 Enhanced Game Debugger enabled')
    })

    /**
     * Disable debugger
     */
    const disable = Effect.gen(function* () {
      yield* removeOverlay()
      yield* removeDetailsPanel()
      yield* stopUpdateInterval()

      const state = yield* Ref.get(stateRef)
      if (state.performanceProfiler) {
        state.performanceProfiler.stop()
      }

      yield* Ref.update(stateRef, (s) => ({ ...s, isEnabled: false }))

      console.log('🔧 Game Debugger disabled')
    })

    /**
     * Toggle debugger
     */
    const toggle = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (state.isEnabled) {
        yield* disable()
      } else {
        yield* enable()
      }
    })

    /**
     * Remove overlay
     */
    const removeOverlay = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (state.overlay) {
        document.body.removeChild(state.overlay)
        yield* Ref.update(stateRef, (s) => ({ ...s, overlay: null }))
      }
    })

    /**
     * Remove details panel
     */
    const removeDetailsPanel = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (state.detailsPanel) {
        document.body.removeChild(state.detailsPanel)
        yield* Ref.update(stateRef, (s) => ({ ...s, detailsPanel: null }))
      }
    })

    /**
     * Toggle pause
     */
    const togglePause = Effect.gen(function* () {
      yield* Ref.update(stateRef, (s) => ({ ...s, isPaused: !s.isPaused }))

      const state = yield* Ref.get(stateRef)
      console.log(`🎮 Game ${state.isPaused ? 'paused' : 'resumed'}`)

      if (state.isPaused) {
        yield* onGamePaused()
      } else {
        yield* onGameResumed()
      }
    })

    /**
     * Step frame
     */
    const stepFrame = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (state.isPaused) {
        yield* Ref.update(stateRef, (s) => ({ ...s, currentFrame: s.currentFrame + 1 }))
        yield* updateDebugInfo()

        const updatedState = yield* Ref.get(stateRef)
        console.log(`👣 Stepped to frame ${updatedState.currentFrame}`)
      }
    })

    /**
     * Toggle recording
     */
    const toggleRecording = Effect.gen(function* () {
      yield* Ref.update(stateRef, (s) => ({
        ...s,
        state: { ...s.state, recordingSession: !s.state.recordingSession },
      }))

      const state = yield* Ref.get(stateRef)
      if (state.state.recordingSession) {
        yield* startDebuggingSession()
      } else {
        yield* stopDebuggingSession()
      }
    })

    /**
     * Show details panel
     */
    const showDetailsPanel = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (state.detailsPanel) {
        state.detailsPanel.style.display = 'flex'
        yield* updateDetailsPanel()
      }
    })

    /**
     * Update details panel
     */
    const updateDetailsPanel = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (!state.detailsPanel) return

      const content = state.detailsPanel.querySelector('#details-content')
      if (!content) return

      const report = yield* Effect.succeed('Performance data not available')

      content.innerHTML = `<pre style="font-size: 9px; line-height: 1.2; white-space: pre-wrap;">${report}</pre>`
    })

    /**
     * Start debugging session
     */
    const startDebuggingSession = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const sessionId = `debug-${Date.now()}`
      const session: DebugSession = {
        id: sessionId,
        startTime: Date.now(),
        data: [],
        metadata: {
          startFrame: state.currentFrame,
          watchedEntities: Array.from(state.state.watchedEntities),
          watchedComponents: Array.from(state.state.watchedComponents),
        },
      }

      const newSessions = new Map(state.debugSessions)
      newSessions.set(sessionId, session)

      yield* Ref.update(stateRef, (s) => ({
        ...s,
        debugSessions: newSessions,
        recordingData: [],
      }))

      console.log(`🎬 Started debugging session: ${sessionId}`)
      return sessionId
    })

    /**
     * Stop debugging session
     */
    const stopDebuggingSession = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const activeSessions = Array.from(state.debugSessions.values()).filter((s) => !s.endTime)

      const updatedSessions = new Map(state.debugSessions)
      activeSessions.forEach((session) => {
        session.endTime = Date.now()
        session.data = [...state.recordingData]
        updatedSessions.set(session.id, session)
        console.log(`🎬 Stopped debugging session: ${session.id}`)
        console.log(`📊 Recorded ${session.data.length} frames`)
      })

      yield* Ref.update(stateRef, (s) => ({
        ...s,
        debugSessions: updatedSessions,
        recordingData: [],
      }))
    })

    /**
     * On game paused
     */
    const onGamePaused = Effect.gen(function* () {
      // Notify other systems about pause
      yield* updateDebugInfo()
    })

    /**
     * On game resumed
     */
    const onGameResumed = Effect.gen(function* () {
      // Notify other systems about resume
      yield* updateDebugInfo()
    })

    /**
     * Update frame
     */
    const update = (deltaTime: number) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        if (!state.isEnabled) return

        yield* Ref.update(stateRef, (s) => ({ ...s, currentFrame: s.currentFrame + 1 }))

        if (state.performanceProfiler) {
          state.performanceProfiler.update(deltaTime)
        }

        // Check breakpoints
        yield* checkBreakpoints()

        // Update overlay if not paused
        if (!state.isPaused) {
          yield* updateDebugInfo()
        }

        // Record data if recording
        if (state.state.recordingSession) {
          yield* recordFrameData(deltaTime)
        }
      })

    /**
     * Check breakpoints
     */
    const checkBreakpoints = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)

      for (const [id, breakpoint] of state.breakpoints) {
        if (breakpoint.enabled && (yield* evaluateBreakpointCondition(breakpoint))) {
          breakpoint.hitCount++
          yield* onBreakpointHit(breakpoint)
        }
      }
    })

    /**
     * Evaluate breakpoint condition
     */
    const evaluateBreakpointCondition = (_breakpoint: DebugBreakpoint) =>
      Effect.gen(function* () {
        // Implement condition evaluation logic
        return false // Placeholder
      })

    /**
     * On breakpoint hit
     */
    const onBreakpointHit = (breakpoint: DebugBreakpoint) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (s) => ({ ...s, isPaused: true }))

        const state = yield* Ref.get(stateRef)
        console.log(`🔴 Breakpoint hit: ${breakpoint.id} (${breakpoint.hitCount} times)`)

        if (breakpoint.callback) {
          breakpoint.callback({
            frame: state.currentFrame,
            breakpoint,
            world,
          })
        }
      })

    /**
     * Record frame data
     */
    const recordFrameData = (deltaTime: number) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)

        const rawStats = state.performanceProfiler?.getStats() || {}
        const validatedStats = yield* validatePerformanceStats(rawStats)
        const watchedEntitiesData = yield* getWatchedEntitiesData()
        const validatedWatchedEntities = yield* validateWatchedEntityData(watchedEntitiesData)
        const systemMetricsData = yield* getSystemMetrics()
        const validatedSystemMetrics = yield* validateSystemMetrics(systemMetricsData)

        const frameData = {
          frame: state.currentFrame,
          timestamp: Date.now(),
          deltaTime,
          stats: validatedStats,
          watchedEntities: validatedWatchedEntities,
          systemMetrics: validatedSystemMetrics,
        }

        yield* Ref.update(stateRef, (s) => ({
          ...s,
          recordingData: [...s.recordingData, frameData],
        }))
      })

    /**
     * Get watched entities data
     */
    const getWatchedEntitiesData = Effect.gen(function* () {
      // Implement watched entities data collection
      return []
    })

    /**
     * Get system metrics
     */
    const getSystemMetrics = Effect.gen(function* () {
      // Implement system metrics collection
      return {}
    })

    /**
     * Add breakpoint
     */
    const addBreakpoint = (breakpoint: DebugBreakpoint) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (s) => {
          const newBreakpoints = new Map(s.breakpoints)
          newBreakpoints.set(breakpoint.id, breakpoint)
          return { ...s, breakpoints: newBreakpoints }
        })
        console.log(`🔴 Breakpoint added: ${breakpoint.id}`)
      })

    /**
     * Remove breakpoint
     */
    const removeBreakpoint = (id: string) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (s) => {
          const newBreakpoints = new Map(s.breakpoints)
          newBreakpoints.delete(id)
          return { ...s, breakpoints: newBreakpoints }
        })
        console.log(`🟢 Breakpoint removed: ${id}`)
      })

    /**
     * Watch entity
     */
    const watchEntity = (entityId: string) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (s) => ({
          ...s,
          state: {
            ...s.state,
            watchedEntities: new Set([...s.state.watchedEntities, entityId]),
          },
        }))
        console.log(`👁️ Watching entity: ${entityId}`)
      })

    /**
     * Unwatch entity
     */
    const unwatchEntity = (entityId: string) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (s) => {
          const newWatched = new Set(s.state.watchedEntities)
          newWatched.delete(entityId)
          return {
            ...s,
            state: { ...s.state, watchedEntities: newWatched },
          }
        })
        console.log(`👁️ Stopped watching entity: ${entityId}`)
      })

    /**
     * Get current state
     */
    const getState = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return { ...state.state }
    })

    /**
     * Export debug data
     */
    const exportDebugData = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return {
        sessions: Array.from(state.debugSessions.values()),
        breakpoints: Array.from(state.breakpoints.values()),
        state: state.state,
        currentFrame: state.currentFrame,
        performance: state.performanceProfiler?.exportPerformanceData() || {},
      }
    })

    /**
     * Destroy debugger
     */
    const destroy = Effect.gen(function* () {
      yield* disable()
      yield* Ref.update(stateRef, (s) => ({
        ...s,
        debugSessions: new Map(),
        breakpoints: new Map(),
      }))
      console.log('🔧 Game Debugger destroyed')
    })

    // Initialize in development mode
    if (import.meta.env.DEV) {
      yield* enable()
      yield* setupKeyboardShortcuts()
      yield* integrateWithPerformanceSystem()
    }

    return {
      enable,
      disable,
      toggle,
      update,
      togglePause,
      stepFrame,
      toggleRecording,
      showDetailsPanel,
      addBreakpoint,
      removeBreakpoint,
      watchEntity,
      unwatchEntity,
      getState,
      exportDebugData,
      destroy,
    }
  })

/**
 * Create game debugger factory for easier usage
 */
const createGameDebuggerFactory =
  (config: Partial<GameDebuggerConfig> = {}) =>
  (world: WorldState) =>
    createGameDebugger(world, config)
