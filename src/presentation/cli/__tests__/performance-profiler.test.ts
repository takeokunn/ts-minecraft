import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Effect } from 'effect'
import { createPerformanceProfiler, type PerformanceStats, type PerformanceRecord } from '../performance-profiler'
import { runEffect, expectEffect } from '../../__tests__/setup'

// Mock DOM and performance APIs
const mockDocument = () => {
  const mockElements = new Map<string, HTMLElement>()
  
  const createMockElement = (tagName: string): HTMLElement => {
    const element = {
      tagName: tagName.toUpperCase(),
      id: '',
      style: {} as CSSStyleDeclaration,
      innerHTML: '',
      textContent: '',
      width: tagName === 'canvas' ? 380 : undefined,
      height: tagName === 'canvas' ? 120 : undefined,
      onclick: null as any,
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      getContext: vi.fn(() => ({
        strokeStyle: '',
        lineWidth: 0,
        fillStyle: '',
        font: '',
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fillRect: vi.fn(),
        fillText: vi.fn()
      }))
    } as any
    
    return element
  }

  global.document = {
    createElement: vi.fn((tagName: string) => createMockElement(tagName)),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn()
    } as any
  } as any

  // Mock performance.now()
  global.performance = {
    now: vi.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000
    }
  } as any
}

// Mock import.meta.env
Object.defineProperty(import.meta, 'env', {
  value: { DEV: false }, // Set to false to avoid auto-initialization
  writable: true
})

describe('PerformanceProfiler', () => {
  beforeEach(() => {
    mockDocument()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('createPerformanceProfiler', () => {
    it('should create performance profiler with correct interface', async () => {
      const profiler = await runEffect(createPerformanceProfiler())
      
      expect(profiler).toBeDefined()
      expect(typeof profiler.start).toBe('function')
      expect(typeof profiler.stop).toBe('function')
      expect(typeof profiler.startRecording).toBe('function')
      expect(typeof profiler.stopRecording).toBe('function')
      expect(typeof profiler.update).toBe('function')
      expect(typeof profiler.getStats).toBe('function')
      expect(typeof profiler.exportPerformanceData).toBe('function')
      expect(typeof profiler.analyzePerformance).toBe('function')
    })

    it('should not create UI elements when not in dev mode', async () => {
      const profiler = await runEffect(createPerformanceProfiler())
      
      expect(global.document.createElement).not.toHaveBeenCalled()
      expect(global.document.body.appendChild).not.toHaveBeenCalled()
    })

    it('should create UI elements when in dev mode', async () => {
      // Temporarily set DEV mode
      Object.defineProperty(import.meta, 'env', {
        value: { DEV: true },
        writable: true
      })

      const profiler = await runEffect(createPerformanceProfiler())
      
      expect(global.document.createElement).toHaveBeenCalledWith('div')
      expect(global.document.createElement).toHaveBeenCalledWith('canvas')
      expect(global.document.body.appendChild).toHaveBeenCalled()

      // Reset DEV mode
      Object.defineProperty(import.meta, 'env', {
        value: { DEV: false },
        writable: true
      })
    })
  })

  describe('start/stop functionality', () => {
    let profiler: any

    beforeEach(async () => {
      profiler = await runEffect(createPerformanceProfiler())
    })

    it('should start profiler', async () => {
      await runEffect(profiler.start())
      
      // Should reset frame count and times
      const stats = await runEffect(profiler.getStats())
      expect(stats).toBeDefined()
    })

    it('should stop profiler', async () => {
      await runEffect(profiler.start())
      await runEffect(profiler.stop())
      
      // Should stop profiler
      const stats = await runEffect(profiler.getStats())
      expect(stats).toBeDefined()
    })

    it('should handle stop before start', async () => {
      await runEffect(profiler.stop())
      
      // Should not throw error
      const stats = await runEffect(profiler.getStats())
      expect(stats).toBeDefined()
    })

    it('should handle multiple start calls', async () => {
      await runEffect(profiler.start())
      await runEffect(profiler.start())
      
      // Should handle gracefully
      const stats = await runEffect(profiler.getStats())
      expect(stats).toBeDefined()
    })
  })

  describe('recording functionality', () => {
    let profiler: any

    beforeEach(async () => {
      profiler = await runEffect(createPerformanceProfiler())
      await runEffect(profiler.start())
    })

    it('should start recording', async () => {
      await runEffect(profiler.startRecording())
      
      // Should initialize recording state
    })

    it('should stop recording and return data', async () => {
      await runEffect(profiler.startRecording())
      
      // Update a few times to generate data
      await runEffect(profiler.update(16.67))
      await runEffect(profiler.update(16.67))
      await runEffect(profiler.update(16.67))
      
      const data = await runEffect(profiler.stopRecording())
      
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThan(0)
    })

    it('should handle stop recording without start', async () => {
      const data = await runEffect(profiler.stopRecording())
      
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(0)
    })

    it('should collect performance records during recording', async () => {
      await runEffect(profiler.startRecording())
      
      // Mock performance.now to return predictable values
      let timeCounter = 1000
      vi.mocked(global.performance.now).mockImplementation(() => {
        timeCounter += 16.67 // ~60 FPS
        return timeCounter
      })
      
      // Update several times
      for (let i = 0; i < 5; i++) {
        await runEffect(profiler.update(16.67))
      }
      
      const data = await runEffect(profiler.stopRecording())
      
      expect(data.length).toBe(5)
      data.forEach((record: PerformanceRecord) => {
        expect(record).toHaveProperty('timestamp')
        expect(record).toHaveProperty('frameTime')
        expect(record).toHaveProperty('fps')
        expect(record).toHaveProperty('memoryUsage')
        expect(record).toHaveProperty('drawCalls')
        expect(record).toHaveProperty('triangles')
        
        expect(typeof record.timestamp).toBe('number')
        expect(typeof record.frameTime).toBe('number')
        expect(typeof record.fps).toBe('number')
        expect(typeof record.memoryUsage).toBe('number')
        expect(typeof record.drawCalls).toBe('number')
        expect(typeof record.triangles).toBe('number')
      })
    })

    it('should not record when not recording', async () => {
      // Update without recording
      await runEffect(profiler.update(16.67))
      await runEffect(profiler.update(16.67))
      
      const data = await runEffect(profiler.stopRecording())
      expect(data.length).toBe(0)
    })
  })

  describe('update functionality', () => {
    let profiler: any

    beforeEach(async () => {
      profiler = await runEffect(createPerformanceProfiler())
    })

    it('should update when running', async () => {
      await runEffect(profiler.start())
      await runEffect(profiler.update(16.67))
      
      const stats = await runEffect(profiler.getStats())
      expect(stats.frameTime).toBeGreaterThan(0)
    })

    it('should not update when not running', async () => {
      await runEffect(profiler.update(16.67))
      
      const stats = await runEffect(profiler.getStats())
      expect(stats.frameTime).toBe(0) // Initial value
    })

    it('should handle zero delta time', async () => {
      await runEffect(profiler.start())
      await runEffect(profiler.update(0))
      
      const stats = await runEffect(profiler.getStats())
      expect(stats).toBeDefined()
    })

    it('should handle negative delta time', async () => {
      await runEffect(profiler.start())
      await runEffect(profiler.update(-16.67))
      
      const stats = await runEffect(profiler.getStats())
      expect(stats).toBeDefined()
    })

    it('should maintain frame time history', async () => {
      await runEffect(profiler.start())
      
      // Mock performance.now to return predictable values
      let timeCounter = 1000
      vi.mocked(global.performance.now).mockImplementation(() => {
        timeCounter += 16.67
        return timeCounter
      })
      
      // Update multiple times
      for (let i = 0; i < 10; i++) {
        await runEffect(profiler.update(16.67))
      }
      
      const stats = await runEffect(profiler.getStats())
      expect(stats.avgFrameTime).toBeCloseTo(16.67, 1)
      expect(stats.minFrameTime).toBeLessThanOrEqual(stats.avgFrameTime)
      expect(stats.maxFrameTime).toBeGreaterThanOrEqual(stats.avgFrameTime)
    })

    it('should limit frame history to max count', async () => {
      await runEffect(profiler.start())
      
      // Mock consistent performance timing
      let timeCounter = 1000
      vi.mocked(global.performance.now).mockImplementation(() => {
        timeCounter += 16.67
        return timeCounter
      })
      
      // Update more than max frame history (60)
      for (let i = 0; i < 70; i++) {
        await runEffect(profiler.update(16.67))
      }
      
      const stats = await runEffect(profiler.getStats())
      // Should still calculate stats correctly despite history limit
      expect(stats.avgFrameTime).toBeGreaterThan(0)
    })
  })

  describe('getStats functionality', () => {
    let profiler: any

    beforeEach(async () => {
      profiler = await runEffect(createPerformanceProfiler())
      await runEffect(profiler.start())
    })

    it('should return valid performance stats', async () => {
      await runEffect(profiler.update(16.67))
      
      const stats = await runEffect(profiler.getStats())
      
      expect(stats).toBeDefined()
      expect(stats).toHaveProperty('fps')
      expect(stats).toHaveProperty('frameTime')
      expect(stats).toHaveProperty('memoryUsage')
      expect(stats).toHaveProperty('drawCalls')
      expect(stats).toHaveProperty('triangles')
      expect(stats).toHaveProperty('avgFrameTime')
      expect(stats).toHaveProperty('minFrameTime')
      expect(stats).toHaveProperty('maxFrameTime')
      
      expect(typeof stats.fps).toBe('number')
      expect(typeof stats.frameTime).toBe('number')
      expect(typeof stats.memoryUsage).toBe('number')
      expect(typeof stats.drawCalls).toBe('number')
      expect(typeof stats.triangles).toBe('number')
      expect(typeof stats.avgFrameTime).toBe('number')
      expect(typeof stats.minFrameTime).toBe('number')
      expect(typeof stats.maxFrameTime).toBe('number')
    })

    it('should calculate FPS correctly', async () => {
      // Mock performance.now for 60 FPS
      let timeCounter = 1000
      vi.mocked(global.performance.now).mockImplementation(() => {
        timeCounter += 16.67 // 60 FPS
        return timeCounter
      })
      
      await runEffect(profiler.update(16.67))
      
      const stats = await runEffect(profiler.getStats())
      expect(stats.fps).toBeCloseTo(60, 1)
    })

    it('should handle zero frame time', async () => {
      // Mock performance.now to return same time (zero delta)
      vi.mocked(global.performance.now).mockReturnValue(1000)
      
      await runEffect(profiler.update(0))
      
      const stats = await runEffect(profiler.getStats())
      expect(stats.fps).toBe(0) // Should handle divide by zero
    })

    it('should return memory usage from performance.memory', async () => {
      const stats = await runEffect(profiler.getStats())
      
      // Should return memory usage in MB
      expect(stats.memoryUsage).toBeCloseTo(1000000 / 1024 / 1024, 1)
    })

    it('should return placeholder values for draw calls and triangles', async () => {
      const stats = await runEffect(profiler.getStats())
      
      expect(stats.drawCalls).toBe(0) // Placeholder
      expect(stats.triangles).toBe(0) // Placeholder
    })

    it('should calculate min/max/avg frame times correctly', async () => {
      // Mock varying performance
      const frameTimes = [16.67, 33.33, 8.33, 50.0, 16.67] // Varying frame times
      let frameIndex = 0
      let timeCounter = 1000
      
      vi.mocked(global.performance.now).mockImplementation(() => {
        const deltaTime = frameTimes[frameIndex % frameTimes.length]
        timeCounter += deltaTime
        frameIndex++
        return timeCounter
      })
      
      for (let i = 0; i < frameTimes.length; i++) {
        await runEffect(profiler.update(frameTimes[i]))
      }
      
      const stats = await runEffect(profiler.getStats())
      
      expect(stats.minFrameTime).toBeCloseTo(8.33, 1)
      expect(stats.maxFrameTime).toBeCloseTo(50.0, 1)
      expect(stats.avgFrameTime).toBeCloseTo(24.996, 1) // Average of frame times
    })
  })

  describe('exportPerformanceData functionality', () => {
    let profiler: any

    beforeEach(async () => {
      profiler = await runEffect(createPerformanceProfiler())
      await runEffect(profiler.start())
    })

    it('should export empty data when no recording', async () => {
      const data = await runEffect(profiler.exportPerformanceData())
      
      expect(data).toBe('[]')
    })

    it('should export recorded data as JSON', async () => {
      await runEffect(profiler.startRecording())
      
      // Mock performance timing
      let timeCounter = 1000
      vi.mocked(global.performance.now).mockImplementation(() => {
        timeCounter += 16.67
        return timeCounter
      })
      
      await runEffect(profiler.update(16.67))
      await runEffect(profiler.update(16.67))
      
      const data = await runEffect(profiler.exportPerformanceData())
      
      expect(typeof data).toBe('string')
      
      const parsed = JSON.parse(data)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed.length).toBe(2)
      
      parsed.forEach((record: PerformanceRecord) => {
        expect(record).toHaveProperty('timestamp')
        expect(record).toHaveProperty('frameTime')
        expect(record).toHaveProperty('fps')
        expect(record).toHaveProperty('memoryUsage')
      })
    })

    it('should export properly formatted JSON', async () => {
      await runEffect(profiler.startRecording())
      await runEffect(profiler.update(16.67))
      
      const data = await runEffect(profiler.exportPerformanceData())
      
      // Should be valid JSON with pretty formatting
      expect(() => JSON.parse(data)).not.toThrow()
      expect(data).toContain('  ') // Should have indentation
    })
  })

  describe('analyzePerformance functionality', () => {
    let profiler: any

    beforeEach(async () => {
      profiler = await runEffect(createPerformanceProfiler())
      await runEffect(profiler.start())
    })

    it('should return null when no recording data', async () => {
      const analysis = await runEffect(profiler.analyzePerformance())
      
      expect(analysis).toBeNull()
    })

    it('should analyze recorded performance data', async () => {
      await runEffect(profiler.startRecording())
      
      // Mock performance data with varying frame times
      const frameTimes = [16.67, 33.33, 16.67, 50.0, 16.67] // Some stutters
      let frameIndex = 0
      let timeCounter = 1000
      
      vi.mocked(global.performance.now).mockImplementation(() => {
        const deltaTime = frameTimes[frameIndex % frameTimes.length]
        timeCounter += deltaTime
        frameIndex++
        return timeCounter
      })
      
      for (const frameTime of frameTimes) {
        await runEffect(profiler.update(frameTime))
      }
      
      const analysis = await runEffect(profiler.analyzePerformance())
      
      expect(analysis).toBeDefined()
      expect(analysis).toHaveProperty('totalSamples')
      expect(analysis).toHaveProperty('avgFrameTime')
      expect(analysis).toHaveProperty('maxFrameTime')
      expect(analysis).toHaveProperty('minFrameTime')
      expect(analysis).toHaveProperty('avgFPS')
      expect(analysis).toHaveProperty('maxFPS')
      expect(analysis).toHaveProperty('minFPS')
      expect(analysis).toHaveProperty('frameTimeStdDev')
      expect(analysis).toHaveProperty('stutterCount')
      
      expect(analysis.totalSamples).toBe(5)
      expect(analysis.maxFrameTime).toBeCloseTo(50.0, 1)
      expect(analysis.minFrameTime).toBeCloseTo(16.67, 1)
      expect(analysis.stutterCount).toBe(2) // 33.33ms and 50ms are > 33.33ms (30fps)
      expect(analysis.frameTimeStdDev).toBeGreaterThan(0)
    })

    it('should calculate statistics correctly', async () => {
      await runEffect(profiler.startRecording())
      
      // Mock consistent performance (60 FPS)
      let timeCounter = 1000
      vi.mocked(global.performance.now).mockImplementation(() => {
        timeCounter += 16.67
        return timeCounter
      })
      
      for (let i = 0; i < 10; i++) {
        await runEffect(profiler.update(16.67))
      }
      
      const analysis = await runEffect(profiler.analyzePerformance())
      
      expect(analysis).toBeDefined()
      expect(analysis.totalSamples).toBe(10)
      expect(analysis.avgFrameTime).toBeCloseTo(16.67, 1)
      expect(analysis.avgFPS).toBeCloseTo(60, 1)
      expect(analysis.stutterCount).toBe(0) // All frames are 60 FPS
      expect(analysis.frameTimeStdDev).toBeCloseTo(0, 1) // Very consistent
    })

    it('should detect stutters correctly', async () => {
      await runEffect(profiler.startRecording())
      
      // Mock data with many stutters
      const stutterFrameTimes = [40, 45, 35, 60, 80] // All > 33.33ms (below 30fps)
      let frameIndex = 0
      let timeCounter = 1000
      
      vi.mocked(global.performance.now).mockImplementation(() => {
        const deltaTime = stutterFrameTimes[frameIndex % stutterFrameTimes.length]
        timeCounter += deltaTime
        frameIndex++
        return timeCounter
      })
      
      for (const frameTime of stutterFrameTimes) {
        await runEffect(profiler.update(frameTime))
      }
      
      const analysis = await runEffect(profiler.analyzePerformance())
      
      expect(analysis).toBeDefined()
      expect(analysis.stutterCount).toBe(5) // All frames are stutters
    })
  })

  describe('complex workflows', () => {
    let profiler: any

    beforeEach(async () => {
      profiler = await runEffect(createPerformanceProfiler())
    })

    it('should handle complete profiling session', async () => {
      // Start profiling
      await runEffect(profiler.start())
      
      // Run for a while
      let timeCounter = 1000
      vi.mocked(global.performance.now).mockImplementation(() => {
        timeCounter += 16.67
        return timeCounter
      })
      
      for (let i = 0; i < 30; i++) {
        await runEffect(profiler.update(16.67))
      }
      
      // Start recording
      await runEffect(profiler.startRecording())
      
      // Record some data
      for (let i = 0; i < 10; i++) {
        await runEffect(profiler.update(16.67))
      }
      
      // Stop recording and analyze
      const recordedData = await runEffect(profiler.stopRecording())
      const analysis = await runEffect(profiler.analyzePerformance())
      const exportedData = await runEffect(profiler.exportPerformanceData())
      
      // Stop profiling
      await runEffect(profiler.stop())
      
      expect(recordedData.length).toBe(10)
      expect(analysis).toBeDefined()
      expect(analysis.totalSamples).toBe(10)
      expect(exportedData).toBe('[]') // Should be empty after stop recording
    })

    it('should handle concurrent operations', async () => {
      await runEffect(profiler.start())
      
      const operations = [
        profiler.update(16.67),
        profiler.startRecording(),
        profiler.getStats(),
        profiler.exportPerformanceData()
      ]
      
      const results = await runEffect(Effect.all(operations))
      
      expect(results).toHaveLength(4)
      expect(results[2]).toHaveProperty('fps') // getStats result
      expect(typeof results[3]).toBe('string') // exportPerformanceData result
    })

    it('should handle rapid start/stop cycles', async () => {
      for (let i = 0; i < 5; i++) {
        await runEffect(profiler.start())
        await runEffect(profiler.update(16.67))
        await runEffect(profiler.stop())
      }
      
      // Should handle without errors
      const stats = await runEffect(profiler.getStats())
      expect(stats).toBeDefined()
    })

    it('should handle rapid recording start/stop cycles', async () => {
      await runEffect(profiler.start())
      
      for (let i = 0; i < 5; i++) {
        await runEffect(profiler.startRecording())
        await runEffect(profiler.update(16.67))
        const data = await runEffect(profiler.stopRecording())
        expect(data.length).toBeLessThanOrEqual(1)
      }
    })
  })

  describe('edge cases', () => {
    let profiler: any

    beforeEach(async () => {
      profiler = await runEffect(createPerformanceProfiler())
    })

    it('should handle missing performance.memory gracefully', async () => {
      // Mock performance without memory
      global.performance = {
        now: vi.fn(() => Date.now())
      } as any
      
      const newProfiler = await runEffect(createPerformanceProfiler())
      await runEffect(newProfiler.start())
      await runEffect(newProfiler.update(16.67))
      
      const stats = await runEffect(newProfiler.getStats())
      expect(stats.memoryUsage).toBe(0)
    })

    it('should handle very high frame times', async () => {
      await runEffect(profiler.start())
      
      // Mock extremely slow frames (1 FPS)
      let timeCounter = 1000
      vi.mocked(global.performance.now).mockImplementation(() => {
        timeCounter += 1000
        return timeCounter
      })
      
      await runEffect(profiler.update(1000))
      
      const stats = await runEffect(profiler.getStats())
      expect(stats.fps).toBeCloseTo(1, 1)
      expect(stats.frameTime).toBeCloseTo(1000, 1)
    })

    it('should handle very low frame times', async () => {
      await runEffect(profiler.start())
      
      // Mock extremely fast frames (1000 FPS)
      let timeCounter = 1000
      vi.mocked(global.performance.now).mockImplementation(() => {
        timeCounter += 1
        return timeCounter
      })
      
      await runEffect(profiler.update(1))
      
      const stats = await runEffect(profiler.getStats())
      expect(stats.fps).toBeCloseTo(1000, 1)
      expect(stats.frameTime).toBeCloseTo(1, 1)
    })

    it('should handle NaN and Infinity values', async () => {
      await runEffect(profiler.start())
      
      // Mock performance.now to return NaN
      vi.mocked(global.performance.now).mockReturnValue(NaN)
      
      await runEffect(profiler.update(16.67))
      
      const stats = await runEffect(profiler.getStats())
      expect(stats).toBeDefined()
      // Should handle gracefully without throwing
    })
  })
})