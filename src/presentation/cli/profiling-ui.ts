import { PerformanceProfiler } from '@presentation/cli/performance-profiler'
import { Effect, Ref } from 'effect'
import { PerformanceDashboard } from '@infrastructure/performance'

export interface ProfilingUIConfig {
  updateInterval: number
  maxDataPoints: number
  showFPSGraph: boolean
  showMemoryGraph: boolean
  showFrameTimeGraph: boolean
  showSystemMetrics: boolean
  showHeatmap: boolean
  enableExport: boolean
  graphHeight: number
  graphColors: {
    fps: string
    memory: string
    frameTime: string
    background: string
    grid: string
    text: string
  }
}

export interface ChartData {
  timestamps: number[]
  fps: number[]
  memory: number[]
  frameTime: number[]
  drawCalls: number[]
  triangles: number[]
}

export interface SystemMetrics {
  cpuUsage: number
  memoryUsage: number
  gpuUsage: number
  networkLatency: number
  diskIO: number
  batteryLevel?: number
  thermalState?: string
}

export const createProfilingUI = (performanceProfiler?: PerformanceProfiler, config: Partial<ProfilingUIConfig> = {}) =>
  Effect.gen(function* () {
    const defaultConfig: ProfilingUIConfig = {
      updateInterval: 100,
      maxDataPoints: 300, // 30 seconds at 100ms intervals
      showFPSGraph: true,
      showMemoryGraph: true,
      showFrameTimeGraph: true,
      showSystemMetrics: true,
      showHeatmap: false,
      enableExport: true,
      graphHeight: 120,
      graphColors: {
        fps: '#00ff00',
        memory: '#ff6600',
        frameTime: '#0099ff',
        background: '#111111',
        grid: '#333333',
        text: '#cccccc',
      },
      ...config,
    }

    const isOpenRef = yield* Ref.make(false)
    const elementRef = yield* Ref.make<HTMLElement | null>(null)
    const canvasesRef = yield* Ref.make<Map<string, HTMLCanvasElement>>(new Map())
    const contextsRef = yield* Ref.make<Map<string, CanvasRenderingContext2D>>(new Map())
    const updateIntervalRef = yield* Ref.make<number | null>(null)
    const startTimeRef = yield* Ref.make(Date.now())

    const chartDataRef = yield* Ref.make<ChartData>({
      timestamps: [],
      fps: [],
      memory: [],
      frameTime: [],
      drawCalls: [],
      triangles: [],
    })

    const createProfilingUIElement = () =>
      Effect.gen(function* () {
        const element = document.createElement('div')
        element.id = 'profiling-ui'
        element.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      width: 500px;
      max-height: 80vh;
      background: rgba(0, 0, 0, 0.95);
      border: 1px solid #333;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
      z-index: 10002;
      display: none;
      flex-direction: column;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: white;
      backdrop-filter: blur(10px);
    `

        yield* createHeader(element)
        yield* createGraphsContainer(element)
        yield* createMetricsPanel(element)
        yield* createControlsPanel(element)

        document.body.appendChild(element)
        yield* Ref.set(elementRef, element)
      })

    const createHeader = (parentElement: HTMLElement) =>
      Effect.gen(function* () {
        const header = document.createElement('div')
        header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #333;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px 8px 0 0;
    `

        const title = document.createElement('div')
        title.style.cssText = 'font-weight: bold; color: #00ccff;'
        title.innerHTML = '📊 Performance Profiler'

        const controls = document.createElement('div')
        controls.style.cssText = 'display: flex; gap: 8px; align-items: center;'

        // Recording indicator
        const recordingIndicator = document.createElement('div')
        recordingIndicator.id = 'recording-indicator'
        recordingIndicator.style.cssText = `
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #333;
      transition: background 0.3s;
    `

        // Session timer
        const timer = document.createElement('div')
        timer.id = 'session-timer'
        timer.style.cssText = 'font-size: 10px; color: #888; margin-right: 8px;'
        timer.textContent = '00:00'

        const exportBtn = document.createElement('button')
        exportBtn.textContent = '💾'
        exportBtn.title = 'Export Data'
        exportBtn.style.cssText = getButtonStyle()
        exportBtn.onclick = () => Effect.runSync(exportData())

        const settingsBtn = document.createElement('button')
        settingsBtn.textContent = '⚙️'
        settingsBtn.title = 'Settings'
        settingsBtn.style.cssText = getButtonStyle()
        settingsBtn.onclick = () => Effect.runSync(toggleSettings())

        const closeBtn = document.createElement('button')
        closeBtn.textContent = '✕'
        closeBtn.title = 'Close'
        closeBtn.style.cssText = getButtonStyle('#d33')
        closeBtn.onclick = () => Effect.runSync(close())

        controls.appendChild(recordingIndicator)
        controls.appendChild(timer)
        controls.appendChild(exportBtn)
        controls.appendChild(settingsBtn)
        controls.appendChild(closeBtn)

        header.appendChild(title)
        header.appendChild(controls)

        parentElement.appendChild(header)
      })

    const createGraphsContainer = (parentElement: HTMLElement) =>
      Effect.gen(function* () {
        const container = document.createElement('div')
        container.id = 'graphs-container'
        container.style.cssText = `
      padding: 16px;
      max-height: 400px;
      overflow-y: auto;
    `

        if (defaultConfig.showFPSGraph) {
          yield* createGraph(container, 'fps', 'FPS Graph', defaultConfig.graphColors.fps)
        }

        if (defaultConfig.showFrameTimeGraph) {
          yield* createGraph(container, 'frameTime', 'Frame Time (ms)', defaultConfig.graphColors.frameTime)
        }

        if (defaultConfig.showMemoryGraph) {
          yield* createGraph(container, 'memory', 'Memory Usage (MB)', defaultConfig.graphColors.memory)
        }

        parentElement.appendChild(container)
      })

    const createGraph = (container: HTMLElement, id: string, title: string, color: string) =>
      Effect.gen(function* () {
        const graphContainer = document.createElement('div')
        graphContainer.style.cssText = 'margin-bottom: 16px;'

        const titleElement = document.createElement('div')
        titleElement.style.cssText = `
      font-size: 11px;
      color: ${color};
      margin-bottom: 6px;
      font-weight: bold;
    `
        titleElement.textContent = title

        const canvasContainer = document.createElement('div')
        canvasContainer.style.cssText = `
      position: relative;
      background: ${defaultConfig.graphColors.background};
      border: 1px solid #333;
      border-radius: 4px;
    `

        const canvas = document.createElement('canvas')
        canvas.width = 468 // Container width minus padding
        canvas.height = defaultConfig.graphHeight
        canvas.style.cssText = `
      display: block;
      width: 100%;
      height: ${defaultConfig.graphHeight}px;
    `

        const ctx = canvas.getContext('2d')!
        ctx.imageSmoothingEnabled = false

        const canvases = yield* Ref.get(canvasesRef)
        const contexts = yield* Ref.get(contextsRef)
        canvases.set(id, canvas)
        contexts.set(id, ctx)
        yield* Ref.set(canvasesRef, canvases)
        yield* Ref.set(contextsRef, contexts)

        // Add value overlay
        const valueOverlay = document.createElement('div')
        valueOverlay.id = `${id}-value`
        valueOverlay.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0, 0, 0, 0.7);
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 10px;
      color: ${color};
      font-weight: bold;
    `
        valueOverlay.textContent = '0'

        canvasContainer.appendChild(canvas)
        canvasContainer.appendChild(valueOverlay)
        graphContainer.appendChild(titleElement)
        graphContainer.appendChild(canvasContainer)
        container.appendChild(graphContainer)
      })

    const createMetricsPanel = (parentElement: HTMLElement) =>
      Effect.gen(function* () {
        if (!defaultConfig.showSystemMetrics) return

        const panel = document.createElement('div')
        panel.id = 'metrics-panel'
        panel.style.cssText = `
      padding: 16px;
      border-top: 1px solid #333;
      background: rgba(255, 255, 255, 0.02);
    `

        const title = document.createElement('div')
        title.style.cssText = `
      font-size: 11px;
      color: #00ccff;
      margin-bottom: 8px;
      font-weight: bold;
    `
        title.textContent = 'System Metrics'

        const metricsGrid = document.createElement('div')
        metricsGrid.id = 'metrics-grid'
        metricsGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 8px;
      font-size: 10px;
    `

        panel.appendChild(title)
        panel.appendChild(metricsGrid)
        parentElement.appendChild(panel)
      })

    const createControlsPanel = (parentElement: HTMLElement) =>
      Effect.gen(function* () {
        const panel = document.createElement('div')
        panel.id = 'controls-panel'
        panel.style.cssText = `
      padding: 12px 16px;
      border-top: 1px solid #333;
      background: rgba(255, 255, 255, 0.02);
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 0 0 8px 8px;
    `

        const leftControls = document.createElement('div')
        leftControls.style.cssText = 'display: flex; gap: 8px; align-items: center;'

        const startBtn = document.createElement('button')
        startBtn.id = 'start-btn'
        startBtn.textContent = '▶️ Start'
        startBtn.style.cssText = getButtonStyle('#28a745')
        startBtn.onclick = () => Effect.runSync(startProfiling())

        const pauseBtn = document.createElement('button')
        pauseBtn.id = 'pause-btn'
        pauseBtn.textContent = '⏸️ Pause'
        pauseBtn.style.cssText = getButtonStyle('#ffc107')
        pauseBtn.onclick = () => Effect.runSync(pauseProfiling())
        pauseBtn.disabled = true

        const stopBtn = document.createElement('button')
        stopBtn.id = 'stop-btn'
        stopBtn.textContent = '⏹️ Stop'
        stopBtn.style.cssText = getButtonStyle('#dc3545')
        stopBtn.onclick = () => Effect.runSync(stopProfiling())
        stopBtn.disabled = true

        const clearBtn = document.createElement('button')
        clearBtn.textContent = '🧹 Clear'
        clearBtn.style.cssText = getButtonStyle()
        clearBtn.onclick = () => Effect.runSync(clearData())

        leftControls.appendChild(startBtn)
        leftControls.appendChild(pauseBtn)
        leftControls.appendChild(stopBtn)
        leftControls.appendChild(clearBtn)

        const rightControls = document.createElement('div')
        rightControls.style.cssText = 'display: flex; gap: 8px; align-items: center; font-size: 10px;'

        const statsDisplay = document.createElement('div')
        statsDisplay.id = 'stats-display'
        statsDisplay.style.cssText = 'color: #888;'
        statsDisplay.textContent = 'Ready'

        rightControls.appendChild(statsDisplay)

        panel.appendChild(leftControls)
        panel.appendChild(rightControls)
        parentElement.appendChild(panel)
      })

    const getButtonStyle = (bgColor = '#333') => {
      return `
      background: ${bgColor};
      border: 1px solid #555;
      color: white;
      padding: 4px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 10px;
      font-family: inherit;
      transition: all 0.2s;
      opacity: 1;
    `
    }

    const setupKeyboardShortcuts = () =>
      Effect.gen(function* () {
        document.addEventListener('keydown', (event) => {
          Effect.runSync(
            Effect.gen(function* () {
              // Ctrl+Shift+M to toggle profiling UI
              if (event.ctrlKey && event.shiftKey && event.key === 'M') {
                event.preventDefault()
                yield* toggle()
              }

              const isOpen = yield* Ref.get(isOpenRef)
              if (isOpen) {
                // Space to start/pause
                if (event.code === 'Space' && event.target === document.body) {
                  event.preventDefault()
                  const updateInterval = yield* Ref.get(updateIntervalRef)
                  if (updateInterval) {
                    yield* pauseProfiling()
                  } else {
                    yield* startProfiling()
                  }
                }

                // Escape to stop
                if (event.key === 'Escape') {
                  yield* stopProfiling()
                }
              }
            }),
          )
        })
      })

    const startProfiling = () =>
      Effect.gen(function* () {
        const updateInterval = yield* Ref.get(updateIntervalRef)
        if (updateInterval) return

        yield* Effect.log('📊 Starting performance profiling...')
        yield* Ref.set(startTimeRef, Date.now())

        // Update button states
        yield* updateButtonState('start', true)
        yield* updateButtonState('pause', false)
        yield* updateButtonState('stop', false)

        // Update recording indicator
        const indicator = document.getElementById('recording-indicator')
        if (indicator) {
          indicator.style.background = '#ff0000'
        }

        // Start performance profiler if available
        performanceProfiler?.startRecording()

        // Start update loop
        const intervalId = window.setInterval(() => {
          Effect.runSync(
            Effect.gen(function* () {
              yield* updateData()
              yield* updateGraphs()
              yield* updateMetrics()
              yield* updateTimer()
            }),
          )
        }, defaultConfig.updateInterval)

        yield* Ref.set(updateIntervalRef, intervalId)
        yield* updateStats('Recording...')
      })

    const pauseProfiling = () =>
      Effect.gen(function* () {
        const updateInterval = yield* Ref.get(updateIntervalRef)
        if (!updateInterval) return

        clearInterval(updateInterval)
        yield* Ref.set(updateIntervalRef, null)

        // Update button states
        yield* updateButtonState('start', false)
        yield* updateButtonState('pause', true)
        yield* updateButtonState('stop', false)

        // Update recording indicator
        const indicator = document.getElementById('recording-indicator')
        if (indicator) {
          indicator.style.background = '#ffaa00'
        }

        yield* updateStats('Paused')
        yield* Effect.log('⏸️ Performance profiling paused')
      })

    const stopProfiling = () =>
      Effect.gen(function* () {
        const updateInterval = yield* Ref.get(updateIntervalRef)
        if (updateInterval) {
          clearInterval(updateInterval)
          yield* Ref.set(updateIntervalRef, null)
        }

        // Update button states
        yield* updateButtonState('start', false)
        yield* updateButtonState('pause', true)
        yield* updateButtonState('stop', true)

        // Update recording indicator
        const indicator = document.getElementById('recording-indicator')
        if (indicator) {
          indicator.style.background = '#333'
        }

        // Stop performance profiler
        const data = performanceProfiler?.stopRecording()
        if (data) {
          yield* Effect.log(`📊 Performance profiling stopped. Data points: ${data.length}`)
        }

        const chartData = yield* Ref.get(chartDataRef)
        yield* updateStats(`Stopped (${chartData.timestamps.length} samples)`)
        yield* Effect.log('⏹️ Performance profiling stopped')
      })

    const clearData = () =>
      Effect.gen(function* () {
        yield* Ref.set(chartDataRef, {
          timestamps: [],
          fps: [],
          memory: [],
          frameTime: [],
          drawCalls: [],
          triangles: [],
        })

        yield* updateGraphs()
        yield* updateStats('Cleared')
        yield* Effect.log('🧹 Performance data cleared')
      })

    const updateButtonState = (buttonId: string, disabled: boolean) =>
      Effect.gen(function* () {
        const button = document.getElementById(`${buttonId}-btn`) as HTMLButtonElement
        if (button) {
          button.disabled = disabled
          button.style.opacity = disabled ? '0.5' : '1'
        }
      })

    const updateStats = (status: string) =>
      Effect.gen(function* () {
        const display = document.getElementById('stats-display')
        if (display) {
          display.textContent = status
        }
      })

    const updateTimer = () =>
      Effect.gen(function* () {
        const timer = document.getElementById('session-timer')
        if (timer) {
          const startTime = yield* Ref.get(startTimeRef)
          const elapsed = Date.now() - startTime
          const minutes = Math.floor(elapsed / 60000)
          const seconds = Math.floor((elapsed % 60000) / 1000)
          timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        }
      })

    const updateData = () =>
      Effect.gen(function* () {
        const now = Date.now()

        // Get current performance metrics
        let fps = 60 // Default fallback
        let memory = 0
        let frameTime = 16.67

        if (performanceProfiler) {
          const stats = performanceProfiler.getStats()
          fps = stats.fps
          memory = stats.memoryUsage
          frameTime = stats.frameTime
        }

        // Try to get real-time metrics from performance system
        try {
          const metrics = yield* Effect.tryPromise(() => Effect.runSync(Effect.gen(() => PerformanceDashboard.getRealTimeMetrics())))
          fps = metrics.fps
          memory = metrics.memoryUsage / 1024 / 1024 // Convert to MB
        } catch {
          // Use fallback values
        }

        // Add data points
        const chartData = yield* Ref.get(chartDataRef)
        const newChartData = {
          timestamps: [...chartData.timestamps, now],
          fps: [...chartData.fps, fps],
          memory: [...chartData.memory, memory],
          frameTime: [...chartData.frameTime, frameTime],
          drawCalls: [...chartData.drawCalls, Math.floor(Math.random() * 200)], // Placeholder
          triangles: [...chartData.triangles, Math.floor(Math.random() * 50000)], // Placeholder
        }

        // Limit data points
        const maxPoints = defaultConfig.maxDataPoints
        if (newChartData.timestamps.length > maxPoints) {
          Object.keys(newChartData).forEach((key) => {
            newChartData[key as keyof ChartData] = newChartData[key as keyof ChartData].slice(-maxPoints)
          })
        }

        yield* Ref.set(chartDataRef, newChartData)
      })

    const updateGraphs = () =>
      Effect.gen(function* () {
        const chartData = yield* Ref.get(chartDataRef)
        yield* updateGraph('fps', chartData.fps, 0, 120, defaultConfig.graphColors.fps)
        yield* updateGraph('frameTime', chartData.frameTime, 0, 50, defaultConfig.graphColors.frameTime)
        yield* updateGraph('memory', chartData.memory, 0, Math.max(100, Math.max(...chartData.memory) * 1.2), defaultConfig.graphColors.memory)
      })

    const updateGraph = (id: string, data: number[], min: number, max: number, color: string) =>
      Effect.gen(function* () {
        const contexts = yield* Ref.get(contextsRef)
        const canvases = yield* Ref.get(canvasesRef)
        const ctx = contexts.get(id)
        const canvas = canvases.get(id)
        if (!ctx || !canvas) return

        const width = canvas.width
        const height = canvas.height

        // Clear canvas
        ctx.fillStyle = defaultConfig.graphColors.background
        ctx.fillRect(0, 0, width, height)

        // Draw grid
        ctx.strokeStyle = defaultConfig.graphColors.grid
        ctx.lineWidth = 1

        // Horizontal grid lines
        for (let i = 0; i <= 4; i++) {
          const y = (height / 4) * i
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(width, y)
          ctx.stroke()
        }

        // Vertical grid lines
        for (let i = 0; i <= 10; i++) {
          const x = (width / 10) * i
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, height)
          ctx.stroke()
        }

        // Draw data line
        if (data.length > 1) {
          ctx.strokeStyle = color
          ctx.lineWidth = 2
          ctx.beginPath()

          for (let i = 0; i < data.length; i++) {
            const x = (i / (data.length - 1)) * width
            const y = height - ((data[i] - min) / (max - min)) * height

            if (i === 0) {
              ctx.moveTo(x, y)
            } else {
              ctx.lineTo(x, y)
            }
          }

          ctx.stroke()

          // Draw fill area
          ctx.globalAlpha = 0.1
          ctx.fillStyle = color
          ctx.lineTo(width, height)
          ctx.lineTo(0, height)
          ctx.closePath()
          ctx.fill()
          ctx.globalAlpha = 1
        }

        // Update value overlay
        const valueOverlay = document.getElementById(`${id}-value`)
        if (valueOverlay && data.length > 0) {
          const currentValue = data[data.length - 1]
          valueOverlay.textContent = currentValue.toFixed(1)
        }
      })

    const updateMetrics = () =>
      Effect.gen(function* () {
        const grid = document.getElementById('metrics-grid')
        if (!grid) return

        // Get system metrics (simulated for demo)
        const metrics: SystemMetrics = {
          cpuUsage: Math.random() * 100,
          memoryUsage: Math.random() * 100,
          gpuUsage: Math.random() * 100,
          networkLatency: Math.random() * 100,
          diskIO: Math.random() * 100,
          batteryLevel: Math.random() * 100,
          thermalState: 'Normal',
        }

        const metricItems = [
          { label: 'CPU Usage', value: `${metrics.cpuUsage.toFixed(1)}%` },
          { label: 'Memory', value: `${metrics.memoryUsage.toFixed(1)}%` },
          { label: 'GPU Usage', value: `${metrics.gpuUsage.toFixed(1)}%` },
          { label: 'Network', value: `${metrics.networkLatency.toFixed(0)}ms` },
          { label: 'Disk I/O', value: `${metrics.diskIO.toFixed(1)}MB/s` },
          { label: 'Battery', value: `${metrics.batteryLevel?.toFixed(0)}%` },
        ]

        grid.innerHTML = ''

        metricItems.forEach((item) => {
          const metricElement = document.createElement('div')
          metricElement.style.cssText = `
        background: rgba(255, 255, 255, 0.05);
        padding: 6px 8px;
        border-radius: 3px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `

          metricElement.innerHTML = `
        <span style="color: #888;">${item.label}:</span>
        <span style="color: white; font-weight: bold;">${item.value}</span>
      `

          grid.appendChild(metricElement)
        })
      })

    const exportData = () =>
      Effect.gen(function* () {
        const chartData = yield* Ref.get(chartDataRef)
        const startTime = yield* Ref.get(startTimeRef)

        const exportData = {
          timestamp: Date.now(),
          startTime,
          duration: Date.now() - startTime,
          config: defaultConfig,
          chartData,
          summary: {
            avgFPS: chartData.fps.length > 0 ? chartData.fps.reduce((a, b) => a + b, 0) / chartData.fps.length : 0,
            minFPS: chartData.fps.length > 0 ? Math.min(...chartData.fps) : 0,
            maxFPS: chartData.fps.length > 0 ? Math.max(...chartData.fps) : 0,
            avgMemory: chartData.memory.length > 0 ? chartData.memory.reduce((a, b) => a + b, 0) / chartData.memory.length : 0,
            maxMemory: chartData.memory.length > 0 ? Math.max(...chartData.memory) : 0,
            samples: chartData.timestamps.length,
          },
        }

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `performance-profile-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)

        yield* Effect.log(`📊 Performance data exported: ${JSON.stringify(exportData.summary)}`)
      })

    const toggleSettings = () =>
      Effect.gen(function* () {
        // Settings panel implementation would go here
        yield* Effect.log('⚙️ Settings panel (not implemented)')
      })

    // Public API
    const open = () =>
      Effect.gen(function* () {
        yield* Ref.set(isOpenRef, true)
        const element = yield* Ref.get(elementRef)
        if (element) {
          element.style.display = 'flex'
        }
      })

    const close = () =>
      Effect.gen(function* () {
        yield* Ref.set(isOpenRef, false)
        yield* stopProfiling()
        const element = yield* Ref.get(elementRef)
        if (element) {
          element.style.display = 'none'
        }
      })

    const toggle = () =>
      Effect.gen(function* () {
        const isOpen = yield* Ref.get(isOpenRef)
        if (isOpen) {
          yield* close()
        } else {
          yield* open()
        }
      })

    const updateConfig = (newConfig: Partial<ProfilingUIConfig>) =>
      Effect.gen(function* () {
        Object.assign(defaultConfig, newConfig)
      })

    const getChartData = () =>
      Effect.gen(function* () {
        const chartData = yield* Ref.get(chartDataRef)
        return { ...chartData }
      })

    const destroy = () =>
      Effect.gen(function* () {
        yield* close()
        const element = yield* Ref.get(elementRef)
        if (element) {
          document.body.removeChild(element)
          yield* Ref.set(elementRef, null)
        }
        yield* Ref.set(canvasesRef, new Map())
        yield* Ref.set(contextsRef, new Map())
      })

    // Initialize UI and shortcuts
    if (import.meta.env.DEV) {
      yield* createProfilingUIElement()
      yield* setupKeyboardShortcuts()
    }

    return {
      open,
      close,
      toggle,
      updateConfig,
      getChartData,
      destroy,
    }
  })

// Factory function for easier usage
export const createProfilingUIFactory = (performanceProfiler?: PerformanceProfiler, config?: Partial<ProfilingUIConfig>) => {
  return Effect.runSync(createProfilingUI(performanceProfiler, config))
}
