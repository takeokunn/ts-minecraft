export interface PerformanceStats {
  fps: number
  frameTime: number
  memoryUsage: number
  drawCalls: number
  triangles: number
  avgFrameTime: number
  minFrameTime: number
  maxFrameTime: number
}

export interface PerformanceRecord {
  timestamp: number
  frameTime: number
  fps: number
  memoryUsage: number
  drawCalls: number
  triangles: number
}

export class PerformanceProfiler {
  private isRunning: boolean = false
  private isRecording: boolean = false
  private frameCount: number = 0
  private lastTime: number = performance.now()
  private deltaTime: number = 0

  // パフォーマンス統計
  private frameTimes: number[] = []
  private maxFrameHistory = 60 // 60フレーム分の履歴
  private recordingData: PerformanceRecord[] = []

  // グラフ用のキャンバス
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private graphContainer: HTMLElement | null = null

  constructor() {
    if (import.meta.env.DEV) {
      this.createGraphUI()
    }
  }

  start(): void {
    this.isRunning = true
    this.lastTime = performance.now()
    this.frameCount = 0
    this.frameTimes = []
  }

  stop(): void {
    this.isRunning = false
    this.removeGraphUI()
  }

  startRecording(): void {
    this.isRecording = true
    this.recordingData = []
    console.log('📊 Performance recording started')
  }

  stopRecording(): PerformanceRecord[] {
    this.isRecording = false
    const data = [...this.recordingData]
    this.recordingData = []
    console.log(`📊 Performance recording stopped. ${data.length} samples collected`)
    return data
  }

  update(_currentDeltaTime: number): void {
    if (!this.isRunning) return

    const currentTime = performance.now()
    this.deltaTime = currentTime - this.lastTime
    this.lastTime = currentTime
    this.frameCount++

    // フレーム時間の履歴を保持
    this.frameTimes.push(this.deltaTime)
    if (this.frameTimes.length > this.maxFrameHistory) {
      this.frameTimes.shift()
    }

    // 記録中の場合、データを保存
    if (this.isRecording) {
      const record: PerformanceRecord = {
        timestamp: currentTime,
        frameTime: this.deltaTime,
        fps: 1000 / this.deltaTime,
        memoryUsage: this.getMemoryUsage(),
        drawCalls: this.getDrawCalls(),
        triangles: this.getTriangles(),
      }
      this.recordingData.push(record)
    }

    // グラフを更新
    this.updateGraph()
  }

  getStats(): PerformanceStats {
    const fps = this.deltaTime > 0 ? 1000 / this.deltaTime : 0
    const avgFrameTime = this.frameTimes.length > 0 ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length : 0
    const minFrameTime = this.frameTimes.length > 0 ? Math.min(...this.frameTimes) : 0
    const maxFrameTime = this.frameTimes.length > 0 ? Math.max(...this.frameTimes) : 0

    return {
      fps,
      frameTime: this.deltaTime,
      memoryUsage: this.getMemoryUsage(),
      drawCalls: this.getDrawCalls(),
      triangles: this.getTriangles(),
      avgFrameTime,
      minFrameTime,
      maxFrameTime,
    }
  }

  private getMemoryUsage(): number {
    // @ts-ignore
    if (performance.memory) {
      // @ts-ignore
      return performance.memory.usedJSHeapSize / 1024 / 1024 // MB
    }
    return 0
  }

  private getDrawCalls(): number {
    // Three.jsのrenderer情報から取得する実装
    // 実際の実装では、rendererのstatsを参照する
    return 0 // プレースホルダー
  }

  private getTriangles(): number {
    // Three.jsのrenderer情報から取得する実装
    return 0 // プレースホルダー
  }

  private createGraphUI(): void {
    // グラフ表示用のUI要素を作成
    this.graphContainer = document.createElement('div')
    this.graphContainer.id = 'performance-graphs'
    this.graphContainer.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      width: 400px;
      height: 200px;
      background: rgba(0, 0, 0, 0.8);
      border-radius: 5px;
      padding: 10px;
      z-index: 9998;
      display: none;
    `

    // FPSグラフ用のキャンバス
    this.canvas = document.createElement('canvas')
    this.canvas.width = 380
    this.canvas.height = 120
    this.canvas.style.cssText = 'border: 1px solid #333;'

    this.ctx = this.canvas.getContext('2d')

    const title = document.createElement('div')
    title.textContent = '📊 Performance Graph'
    title.style.cssText = 'color: white; font-family: monospace; font-size: 12px; margin-bottom: 5px;'

    const controls = document.createElement('div')
    controls.style.cssText = 'margin-top: 5px;'

    const toggleButton = document.createElement('button')
    toggleButton.textContent = 'Toggle Graph'
    toggleButton.style.cssText = 'margin-right: 5px; padding: 2px 8px; font-size: 10px;'
    toggleButton.onclick = () => this.toggleGraph()

    const recordButton = document.createElement('button')
    recordButton.textContent = 'Start Recording'
    recordButton.style.cssText = 'padding: 2px 8px; font-size: 10px;'
    recordButton.onclick = () => this.toggleRecording(recordButton)

    controls.appendChild(toggleButton)
    controls.appendChild(recordButton)

    this.graphContainer.appendChild(title)
    this.graphContainer.appendChild(this.canvas)
    this.graphContainer.appendChild(controls)

    document.body.appendChild(this.graphContainer)
  }

  private removeGraphUI(): void {
    if (this.graphContainer) {
      document.body.removeChild(this.graphContainer)
      this.graphContainer = null
      this.canvas = null
      this.ctx = null
    }
  }

  private toggleGraph(): void {
    if (this.graphContainer) {
      const isVisible = this.graphContainer.style.display !== 'none'
      this.graphContainer.style.display = isVisible ? 'none' : 'block'
    }
  }

  private toggleRecording(button: HTMLButtonElement): void {
    if (this.isRecording) {
      this.stopRecording()
      button.textContent = 'Start Recording'
    } else {
      this.startRecording()
      button.textContent = 'Stop Recording'
    }
  }

  private updateGraph(): void {
    if (!this.ctx || !this.canvas || this.graphContainer?.style.display === 'none') return

    const width = this.canvas.width
    const height = this.canvas.height

    // キャンバスをクリア
    this.ctx.fillStyle = '#111'
    this.ctx.fillRect(0, 0, width, height)

    // グリッド線を描画
    this.drawGrid()

    // FPSグラフを描画
    this.drawFPSGraph()

    // フレーム時間グラフを描画
    this.drawFrameTimeGraph()
  }

  private drawGrid(): void {
    if (!this.ctx) return

    this.ctx.strokeStyle = '#333'
    this.ctx.lineWidth = 1

    // 横線
    for (let i = 0; i < 5; i++) {
      const y = (this.canvas!.height / 4) * i
      this.ctx.beginPath()
      this.ctx.moveTo(0, y)
      this.ctx.lineTo(this.canvas!.width, y)
      this.ctx.stroke()
    }

    // 縦線
    for (let i = 0; i < 11; i++) {
      const x = (this.canvas!.width / 10) * i
      this.ctx.beginPath()
      this.ctx.moveTo(x, 0)
      this.ctx.lineTo(x, this.canvas!.height)
      this.ctx.stroke()
    }
  }

  private drawFPSGraph(): void {
    if (!this.ctx || this.frameTimes.length < 2) return

    this.ctx.strokeStyle = '#00ff00'
    this.ctx.lineWidth = 2
    this.ctx.beginPath()

    const width = this.canvas!.width
    const height = this.canvas!.height
    const maxFPS = 120

    for (let i = 0; i < this.frameTimes.length; i++) {
      const fps = 1000 / this.frameTimes[i]
      const x = (i / (this.frameTimes.length - 1)) * width
      const y = height - (fps / maxFPS) * height

      if (i === 0) {
        this.ctx.moveTo(x, y)
      } else {
        this.ctx.lineTo(x, y)
      }
    }

    this.ctx.stroke()

    // FPS値を表示
    this.ctx.fillStyle = '#00ff00'
    this.ctx.font = '10px monospace'
    const currentFPS = this.deltaTime > 0 ? (1000 / this.deltaTime).toFixed(1) : '0'
    this.ctx.fillText(`FPS: ${currentFPS}`, 5, 15)
  }

  private drawFrameTimeGraph(): void {
    if (!this.ctx || this.frameTimes.length < 2) return

    this.ctx.strokeStyle = '#ff6600'
    this.ctx.lineWidth = 1
    this.ctx.beginPath()

    const width = this.canvas!.width
    const height = this.canvas!.height
    const maxFrameTime = 33.33 // 30fps相当の33.33ms

    for (let i = 0; i < this.frameTimes.length; i++) {
      const frameTime = this.frameTimes[i]
      const x = (i / (this.frameTimes.length - 1)) * width
      const y = height - (frameTime / maxFrameTime) * height

      if (i === 0) {
        this.ctx.moveTo(x, y)
      } else {
        this.ctx.lineTo(x, y)
      }
    }

    this.ctx.stroke()

    // フレーム時間を表示
    this.ctx.fillStyle = '#ff6600'
    this.ctx.font = '10px monospace'
    this.ctx.fillText(`Frame: ${this.deltaTime.toFixed(2)}ms`, 5, 30)
  }

  // データエクスポート機能
  exportPerformanceData(): string {
    return JSON.stringify(this.recordingData, null, 2)
  }

  // パフォーマンス分析
  analyzePerformance(): any {
    if (this.recordingData.length === 0) return null

    const frameTimes = this.recordingData.map((r) => r.frameTime)
    const fps = this.recordingData.map((r) => r.fps)

    return {
      totalSamples: this.recordingData.length,
      avgFrameTime: frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length,
      maxFrameTime: Math.max(...frameTimes),
      minFrameTime: Math.min(...frameTimes),
      avgFPS: fps.reduce((a, b) => a + b, 0) / fps.length,
      maxFPS: Math.max(...fps),
      minFPS: Math.min(...fps),
      frameTimeStdDev: this.calculateStandardDeviation(frameTimes),
      stutterCount: frameTimes.filter((ft) => ft > 33.33).length, // 30fps以下のフレーム数
    }
  }

  private calculateStandardDeviation(values: number[]): number {
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const squareDiffs = values.map((value) => Math.pow(value - avg, 2))
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length
    return Math.sqrt(avgSquareDiff)
  }
}
