import { PerformanceProfiler } from './performance-profiler'
import { Effect } from 'effect'
import { PerformanceDashboard } from '../domain/performance'

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

export class ProfilingUI {
  private isOpen = false
  private element: HTMLElement | null = null
  private canvases: Map<string, HTMLCanvasElement> = new Map()
  private contexts: Map<string, CanvasRenderingContext2D> = new Map()
  private updateInterval: number | null = null
  private chartData: ChartData
  private config: ProfilingUIConfig
  private startTime = Date.now()

  constructor(
    private performanceProfiler?: PerformanceProfiler,
    config: Partial<ProfilingUIConfig> = {}
  ) {
    this.config = {
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
        text: '#cccccc'
      },
      ...config
    }

    this.chartData = {
      timestamps: [],
      fps: [],
      memory: [],
      frameTime: [],
      drawCalls: [],
      triangles: []
    }

    if (import.meta.env.DEV) {
      this.createProfilingUI()
      this.setupKeyboardShortcuts()
    }
  }

  private createProfilingUI(): void {
    this.element = document.createElement('div')
    this.element.id = 'profiling-ui'
    this.element.style.cssText = `
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

    this.createHeader()
    this.createGraphsContainer()
    this.createMetricsPanel()
    this.createControlsPanel()

    document.body.appendChild(this.element)
  }

  private createHeader(): void {
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
    exportBtn.style.cssText = this.getButtonStyle()
    exportBtn.onclick = () => this.exportData()

    const settingsBtn = document.createElement('button')
    settingsBtn.textContent = '⚙️'
    settingsBtn.title = 'Settings'
    settingsBtn.style.cssText = this.getButtonStyle()
    settingsBtn.onclick = () => this.toggleSettings()

    const closeBtn = document.createElement('button')
    closeBtn.textContent = '✕'
    closeBtn.title = 'Close'
    closeBtn.style.cssText = this.getButtonStyle('#d33')
    closeBtn.onclick = () => this.close()

    controls.appendChild(recordingIndicator)
    controls.appendChild(timer)
    controls.appendChild(exportBtn)
    controls.appendChild(settingsBtn)
    controls.appendChild(closeBtn)

    header.appendChild(title)
    header.appendChild(controls)

    this.element!.appendChild(header)
  }

  private createGraphsContainer(): void {
    const container = document.createElement('div')
    container.id = 'graphs-container'
    container.style.cssText = `
      padding: 16px;
      max-height: 400px;
      overflow-y: auto;
    `

    if (this.config.showFPSGraph) {
      this.createGraph('fps', 'FPS Graph', this.config.graphColors.fps)
    }

    if (this.config.showFrameTimeGraph) {
      this.createGraph('frameTime', 'Frame Time (ms)', this.config.graphColors.frameTime)
    }

    if (this.config.showMemoryGraph) {
      this.createGraph('memory', 'Memory Usage (MB)', this.config.graphColors.memory)
    }

    this.element!.appendChild(container)
  }

  private createGraph(id: string, title: string, color: string): void {
    const container = document.getElementById('graphs-container')!
    
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
      background: ${this.config.graphColors.background};
      border: 1px solid #333;
      border-radius: 4px;
    `

    const canvas = document.createElement('canvas')
    canvas.width = 468 // Container width minus padding
    canvas.height = this.config.graphHeight
    canvas.style.cssText = `
      display: block;
      width: 100%;
      height: ${this.config.graphHeight}px;
    `

    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    this.canvases.set(id, canvas)
    this.contexts.set(id, ctx)

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
  }

  private createMetricsPanel(): void {
    if (!this.config.showSystemMetrics) return

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
    this.element!.appendChild(panel)
  }

  private createControlsPanel(): void {
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
    startBtn.style.cssText = this.getButtonStyle('#28a745')
    startBtn.onclick = () => this.startProfiling()

    const pauseBtn = document.createElement('button')
    pauseBtn.id = 'pause-btn'
    pauseBtn.textContent = '⏸️ Pause'
    pauseBtn.style.cssText = this.getButtonStyle('#ffc107')
    pauseBtn.onclick = () => this.pauseProfiling()
    pauseBtn.disabled = true

    const stopBtn = document.createElement('button')
    stopBtn.id = 'stop-btn'
    stopBtn.textContent = '⏹️ Stop'
    stopBtn.style.cssText = this.getButtonStyle('#dc3545')
    stopBtn.onclick = () => this.stopProfiling()
    stopBtn.disabled = true

    const clearBtn = document.createElement('button')
    clearBtn.textContent = '🧹 Clear'
    clearBtn.style.cssText = this.getButtonStyle()
    clearBtn.onclick = () => this.clearData()

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
    this.element!.appendChild(panel)
  }

  private getButtonStyle(bgColor = '#333'): string {
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

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (event) => {
      // Ctrl+Shift+M to toggle profiling UI
      if (event.ctrlKey && event.shiftKey && event.key === 'M') {
        event.preventDefault()
        this.toggle()
      }

      if (this.isOpen) {
        // Space to start/pause
        if (event.code === 'Space' && event.target === document.body) {
          event.preventDefault()
          if (this.updateInterval) {
            this.pauseProfiling()
          } else {
            this.startProfiling()
          }
        }

        // Escape to stop
        if (event.key === 'Escape') {
          this.stopProfiling()
        }
      }
    })
  }

  private startProfiling(): void {
    if (this.updateInterval) return

    console.log('📊 Starting performance profiling...')
    this.startTime = Date.now()
    
    // Update button states
    this.updateButtonState('start', true)
    this.updateButtonState('pause', false)
    this.updateButtonState('stop', false)
    
    // Update recording indicator
    const indicator = document.getElementById('recording-indicator')
    if (indicator) {
      indicator.style.background = '#ff0000'
    }

    // Start performance profiler if available
    this.performanceProfiler?.startRecording()

    // Start update loop
    this.updateInterval = window.setInterval(() => {
      this.updateData()
      this.updateGraphs()
      this.updateMetrics()
      this.updateTimer()
    }, this.config.updateInterval)

    this.updateStats('Recording...')
  }

  private pauseProfiling(): void {
    if (!this.updateInterval) return

    clearInterval(this.updateInterval)
    this.updateInterval = null

    // Update button states
    this.updateButtonState('start', false)
    this.updateButtonState('pause', true)
    this.updateButtonState('stop', false)

    // Update recording indicator
    const indicator = document.getElementById('recording-indicator')
    if (indicator) {
      indicator.style.background = '#ffaa00'
    }

    this.updateStats('Paused')
    console.log('⏸️ Performance profiling paused')
  }

  private stopProfiling(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }

    // Update button states
    this.updateButtonState('start', false)
    this.updateButtonState('pause', true)
    this.updateButtonState('stop', true)

    // Update recording indicator
    const indicator = document.getElementById('recording-indicator')
    if (indicator) {
      indicator.style.background = '#333'
    }

    // Stop performance profiler
    const data = this.performanceProfiler?.stopRecording()
    if (data) {
      console.log('📊 Performance profiling stopped. Data points:', data.length)
    }

    this.updateStats(`Stopped (${this.chartData.timestamps.length} samples)`)
    console.log('⏹️ Performance profiling stopped')
  }

  private clearData(): void {
    this.chartData = {
      timestamps: [],
      fps: [],
      memory: [],
      frameTime: [],
      drawCalls: [],
      triangles: []
    }

    this.updateGraphs()
    this.updateStats('Cleared')
    console.log('🧹 Performance data cleared')
  }

  private updateButtonState(buttonId: string, disabled: boolean): void {
    const button = document.getElementById(`${buttonId}-btn`) as HTMLButtonElement
    if (button) {
      button.disabled = disabled
      button.style.opacity = disabled ? '0.5' : '1'
    }
  }

  private updateStats(status: string): void {
    const display = document.getElementById('stats-display')
    if (display) {
      display.textContent = status
    }
  }

  private updateTimer(): void {
    const timer = document.getElementById('session-timer')
    if (timer) {
      const elapsed = Date.now() - this.startTime
      const minutes = Math.floor(elapsed / 60000)
      const seconds = Math.floor((elapsed % 60000) / 1000)
      timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
  }

  private updateData(): void {
    const now = Date.now()
    
    // Get current performance metrics
    let fps = 60 // Default fallback
    let memory = 0
    let frameTime = 16.67

    if (this.performanceProfiler) {
      const stats = this.performanceProfiler.getStats()
      fps = stats.fps
      memory = stats.memoryUsage
      frameTime = stats.frameTime
    }

    // Try to get real-time metrics from performance system
    try {
      Effect.runSync(
        Effect.gen(() => {
          return PerformanceDashboard.getRealTimeMetrics()
        })
      ).then((metrics: { fps: number; memoryUsage: number }) => {
        fps = metrics.fps
        memory = metrics.memoryUsage / 1024 / 1024 // Convert to MB
      }).catch(() => {
        // Use fallback values
      })
    } catch {
      // Use fallback values
    }

    // Add data points
    this.chartData.timestamps.push(now)
    this.chartData.fps.push(fps)
    this.chartData.memory.push(memory)
    this.chartData.frameTime.push(frameTime)
    this.chartData.drawCalls.push(Math.floor(Math.random() * 200)) // Placeholder
    this.chartData.triangles.push(Math.floor(Math.random() * 50000)) // Placeholder

    // Limit data points
    const maxPoints = this.config.maxDataPoints
    if (this.chartData.timestamps.length > maxPoints) {
      this.chartData.timestamps = this.chartData.timestamps.slice(-maxPoints)
      this.chartData.fps = this.chartData.fps.slice(-maxPoints)
      this.chartData.memory = this.chartData.memory.slice(-maxPoints)
      this.chartData.frameTime = this.chartData.frameTime.slice(-maxPoints)
      this.chartData.drawCalls = this.chartData.drawCalls.slice(-maxPoints)
      this.chartData.triangles = this.chartData.triangles.slice(-maxPoints)
    }
  }

  private updateGraphs(): void {
    this.updateGraph('fps', this.chartData.fps, 0, 120, this.config.graphColors.fps)
    this.updateGraph('frameTime', this.chartData.frameTime, 0, 50, this.config.graphColors.frameTime)
    this.updateGraph('memory', this.chartData.memory, 0, Math.max(100, Math.max(...this.chartData.memory) * 1.2), this.config.graphColors.memory)
  }

  private updateGraph(id: string, data: number[], min: number, max: number, color: string): void {
    const ctx = this.contexts.get(id)
    const canvas = this.canvases.get(id)
    if (!ctx || !canvas) return

    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.fillStyle = this.config.graphColors.background
    ctx.fillRect(0, 0, width, height)

    // Draw grid
    ctx.strokeStyle = this.config.graphColors.grid
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
  }

  private updateMetrics(): void {
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
      thermalState: 'Normal'
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

    metricItems.forEach(item => {
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
  }

  private exportData(): void {
    const exportData = {
      timestamp: Date.now(),
      startTime: this.startTime,
      duration: Date.now() - this.startTime,
      config: this.config,
      chartData: this.chartData,
      summary: {
        avgFPS: this.chartData.fps.length > 0 ? this.chartData.fps.reduce((a, b) => a + b, 0) / this.chartData.fps.length : 0,
        minFPS: this.chartData.fps.length > 0 ? Math.min(...this.chartData.fps) : 0,
        maxFPS: this.chartData.fps.length > 0 ? Math.max(...this.chartData.fps) : 0,
        avgMemory: this.chartData.memory.length > 0 ? this.chartData.memory.reduce((a, b) => a + b, 0) / this.chartData.memory.length : 0,
        maxMemory: this.chartData.memory.length > 0 ? Math.max(...this.chartData.memory) : 0,
        samples: this.chartData.timestamps.length
      }
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `performance-profile-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)

    console.log('📊 Performance data exported:', exportData.summary)
  }

  private toggleSettings(): void {
    // Settings panel implementation would go here
    console.log('⚙️ Settings panel (not implemented)')
  }

  // Public API
  public open(): void {
    this.isOpen = true
    if (this.element) {
      this.element.style.display = 'flex'
    }
  }

  public close(): void {
    this.isOpen = false
    this.stopProfiling()
    if (this.element) {
      this.element.style.display = 'none'
    }
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close()
    } else {
      this.open()
    }
  }

  public updateConfig(newConfig: Partial<ProfilingUIConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  public getChartData(): ChartData {
    return { ...this.chartData }
  }

  public destroy(): void {
    this.close()
    if (this.element) {
      document.body.removeChild(this.element)
      this.element = null
    }
    this.canvases.clear()
    this.contexts.clear()
  }
}

// Factory function for compatibility
export const createProfilingUI = (config?: Partial<ProfilingUIConfig>): ProfilingUI => {
  return new ProfilingUI(config)
}