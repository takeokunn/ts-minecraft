import * as Effect from 'effect/Effect'
import * as Ref from 'effect/Ref'

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

interface PerformanceProfilerState {
  isRunning: boolean
  isRecording: boolean
  frameCount: number
  lastTime: number
  deltaTime: number
  frameTimes: number[]
  maxFrameHistory: number
  recordingData: PerformanceRecord[]
  canvas: HTMLCanvasElement | null
  ctx: CanvasRenderingContext2D | null
  graphContainer: HTMLElement | null
}

export const createPerformanceProfiler = () =>
  Effect.gen(function* () {
    const initialState: PerformanceProfilerState = {
      isRunning: false,
      isRecording: false,
      frameCount: 0,
      lastTime: performance.now(),
      deltaTime: 0,
      frameTimes: [],
      maxFrameHistory: 60, // 60フレーム分の履歴
      recordingData: [],
      canvas: null,
      ctx: null,
      graphContainer: null,
    }

    const stateRef = yield* Ref.make(initialState)

    const getMemoryUsage = (): number => {
      // @ts-ignore
      if (performance.memory) {
        // @ts-ignore
        return performance.memory.usedJSHeapSize / 1024 / 1024 // MB
      }
      return 0
    }

    const getDrawCalls = (): number => {
      // Three.jsのrenderer情報から取得する実装
      // 実際の実装では、rendererのstatsを参照する
      return 0 // プレースホルダー
    }

    const getTriangles = (): number => {
      // Three.jsのrenderer情報から取得する実装
      return 0 // プレースホルダー
    }

    const createGraphUI = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        
        if (!import.meta.env.DEV) return

        // グラフ表示用のUI要素を作成
        const graphContainer = document.createElement('div')
        graphContainer.id = 'performance-graphs'
        graphContainer.style.cssText = `
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
        const canvas = document.createElement('canvas')
        canvas.width = 380
        canvas.height = 120
        canvas.style.cssText = 'border: 1px solid #333;'

        const ctx = canvas.getContext('2d')

        const title = document.createElement('div')
        title.textContent = '📊 Performance Graph'
        title.style.cssText = 'color: white; font-family: monospace; font-size: 12px; margin-bottom: 5px;'

        const controls = document.createElement('div')
        controls.style.cssText = 'margin-top: 5px;'

        const toggleButton = document.createElement('button')
        toggleButton.textContent = 'Toggle Graph'
        toggleButton.style.cssText = 'margin-right: 5px; padding: 2px 8px; font-size: 10px;'
        toggleButton.onclick = () => Effect.runSync(toggleGraph())

        const recordButton = document.createElement('button')
        recordButton.textContent = 'Start Recording'
        recordButton.style.cssText = 'padding: 2px 8px; font-size: 10px;'
        recordButton.onclick = () => Effect.runSync(toggleRecording(recordButton))

        controls.appendChild(toggleButton)
        controls.appendChild(recordButton)

        graphContainer.appendChild(title)
        graphContainer.appendChild(canvas)
        graphContainer.appendChild(controls)

        document.body.appendChild(graphContainer)

        yield* Ref.update(stateRef, (state) => ({
          ...state,
          graphContainer,
          canvas,
          ctx,
        }))
      })

    const removeGraphUI = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        
        if (state.graphContainer) {
          document.body.removeChild(state.graphContainer)
          yield* Ref.update(stateRef, (state) => ({
            ...state,
            graphContainer: null,
            canvas: null,
            ctx: null,
          }))
        }
      })

    const toggleGraph = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        
        if (state.graphContainer) {
          const isVisible = state.graphContainer.style.display !== 'none'
          state.graphContainer.style.display = isVisible ? 'none' : 'block'
        }
      })

    const toggleRecording = (button: HTMLButtonElement) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        
        if (state.isRecording) {
          yield* stopRecording()
          button.textContent = 'Start Recording'
        } else {
          yield* startRecording()
          button.textContent = 'Stop Recording'
        }
      })

    const drawGrid = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        
        if (!state.ctx || !state.canvas) return

        state.ctx.strokeStyle = '#333'
        state.ctx.lineWidth = 1

        // 横線
        for (let i = 0; i < 5; i++) {
          const y = (state.canvas.height / 4) * i
          state.ctx.beginPath()
          state.ctx.moveTo(0, y)
          state.ctx.lineTo(state.canvas.width, y)
          state.ctx.stroke()
        }

        // 縦線
        for (let i = 0; i < 11; i++) {
          const x = (state.canvas.width / 10) * i
          state.ctx.beginPath()
          state.ctx.moveTo(x, 0)
          state.ctx.lineTo(x, state.canvas.height)
          state.ctx.stroke()
        }
      })

    const drawFPSGraph = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        
        if (!state.ctx || !state.canvas || state.frameTimes.length < 2) return

        state.ctx.strokeStyle = '#00ff00'
        state.ctx.lineWidth = 2
        state.ctx.beginPath()

        const width = state.canvas.width
        const height = state.canvas.height
        const maxFPS = 120

        for (let i = 0; i < state.frameTimes.length; i++) {
          const fps = 1000 / state.frameTimes[i]
          const x = (i / (state.frameTimes.length - 1)) * width
          const y = height - (fps / maxFPS) * height

          if (i === 0) {
            state.ctx.moveTo(x, y)
          } else {
            state.ctx.lineTo(x, y)
          }
        }

        state.ctx.stroke()

        // FPS値を表示
        state.ctx.fillStyle = '#00ff00'
        state.ctx.font = '10px monospace'
        const currentFPS = state.deltaTime > 0 ? (1000 / state.deltaTime).toFixed(1) : '0'
        state.ctx.fillText(`FPS: ${currentFPS}`, 5, 15)
      })

    const drawFrameTimeGraph = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        
        if (!state.ctx || !state.canvas || state.frameTimes.length < 2) return

        state.ctx.strokeStyle = '#ff6600'
        state.ctx.lineWidth = 1
        state.ctx.beginPath()

        const width = state.canvas.width
        const height = state.canvas.height
        const maxFrameTime = 33.33 // 30fps相当の33.33ms

        for (let i = 0; i < state.frameTimes.length; i++) {
          const frameTime = state.frameTimes[i]
          const x = (i / (state.frameTimes.length - 1)) * width
          const y = height - (frameTime / maxFrameTime) * height

          if (i === 0) {
            state.ctx.moveTo(x, y)
          } else {
            state.ctx.lineTo(x, y)
          }
        }

        state.ctx.stroke()

        // フレーム時間を表示
        state.ctx.fillStyle = '#ff6600'
        state.ctx.font = '10px monospace'
        state.ctx.fillText(`Frame: ${state.deltaTime.toFixed(2)}ms`, 5, 30)
      })

    const updateGraph = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        
        if (!state.ctx || !state.canvas || state.graphContainer?.style.display === 'none') return

        const width = state.canvas.width
        const height = state.canvas.height

        // キャンバスをクリア
        state.ctx.fillStyle = '#111'
        state.ctx.fillRect(0, 0, width, height)

        // グリッド線を描画
        yield* drawGrid()

        // FPSグラフを描画
        yield* drawFPSGraph()

        // フレーム時間グラフを描画
        yield* drawFrameTimeGraph()
      })

    const calculateStandardDeviation = (values: number[]): number => {
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      const squareDiffs = values.map((value) => Math.pow(value - avg, 2))
      const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length
      return Math.sqrt(avgSquareDiff)
    }

    const start = () =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (state) => ({
          ...state,
          isRunning: true,
          lastTime: performance.now(),
          frameCount: 0,
          frameTimes: [],
        }))
      })

    const stop = () =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (state) => ({
          ...state,
          isRunning: false,
        }))
        yield* removeGraphUI()
      })

    const startRecording = () =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (state) => ({
          ...state,
          isRecording: true,
          recordingData: [],
        }))
        console.log('📊 Performance recording started')
      })

    const stopRecording = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const data = [...state.recordingData]
        
        yield* Ref.update(stateRef, (state) => ({
          ...state,
          isRecording: false,
          recordingData: [],
        }))
        
        console.log(`📊 Performance recording stopped. ${data.length} samples collected`)
        return data
      })

    const update = (_currentDeltaTime: number) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        
        if (!state.isRunning) return

        const currentTime = performance.now()
        const deltaTime = currentTime - state.lastTime
        const frameCount = state.frameCount + 1

        // フレーム時間の履歴を保持
        const newFrameTimes = [...state.frameTimes, deltaTime]
        if (newFrameTimes.length > state.maxFrameHistory) {
          newFrameTimes.shift()
        }

        let newRecordingData = state.recordingData

        // 記録中の場合、データを保存
        if (state.isRecording) {
          const record: PerformanceRecord = {
            timestamp: currentTime,
            frameTime: deltaTime,
            fps: 1000 / deltaTime,
            memoryUsage: getMemoryUsage(),
            drawCalls: getDrawCalls(),
            triangles: getTriangles(),
          }
          newRecordingData = [...state.recordingData, record]
        }

        yield* Ref.update(stateRef, (state) => ({
          ...state,
          deltaTime,
          lastTime: currentTime,
          frameCount,
          frameTimes: newFrameTimes,
          recordingData: newRecordingData,
        }))

        // グラフを更新
        yield* updateGraph()
      })

    const getStats = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        
        const fps = state.deltaTime > 0 ? 1000 / state.deltaTime : 0
        const avgFrameTime = state.frameTimes.length > 0 ? state.frameTimes.reduce((a, b) => a + b, 0) / state.frameTimes.length : 0
        const minFrameTime = state.frameTimes.length > 0 ? Math.min(...state.frameTimes) : 0
        const maxFrameTime = state.frameTimes.length > 0 ? Math.max(...state.frameTimes) : 0

        return {
          fps,
          frameTime: state.deltaTime,
          memoryUsage: getMemoryUsage(),
          drawCalls: getDrawCalls(),
          triangles: getTriangles(),
          avgFrameTime,
          minFrameTime,
          maxFrameTime,
        }
      })

    const exportPerformanceData = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return JSON.stringify(state.recordingData, null, 2)
      })

    const analyzePerformance = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        
        if (state.recordingData.length === 0) return null

        const frameTimes = state.recordingData.map((r) => r.frameTime)
        const fps = state.recordingData.map((r) => r.fps)

        return {
          totalSamples: state.recordingData.length,
          avgFrameTime: frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length,
          maxFrameTime: Math.max(...frameTimes),
          minFrameTime: Math.min(...frameTimes),
          avgFPS: fps.reduce((a, b) => a + b, 0) / fps.length,
          maxFPS: Math.max(...fps),
          minFPS: Math.min(...fps),
          frameTimeStdDev: calculateStandardDeviation(frameTimes),
          stutterCount: frameTimes.filter((ft) => ft > 33.33).length, // 30fps以下のフレーム数
        }
      })

    // Initialize graph UI if in dev mode
    if (import.meta.env.DEV) {
      yield* createGraphUI()
    }

    return {
      start,
      stop,
      startRecording,
      stopRecording,
      update,
      getStats,
      exportPerformanceData,
      analyzePerformance,
    }
  })

// Factory function for easier instantiation
export const createPerformanceProfilerFactory = () => createPerformanceProfiler()