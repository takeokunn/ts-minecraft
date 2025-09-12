import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Effect, Layer } from 'effect'
import { 
  WorldInfoViewModel,
  WorldInfoViewModelLive,
  createWorldInfoViewModel,
  type WorldInfoViewModelInterface,
  type WorldInfoView,
  type TimeInfo,
  type WeatherInfo
} from '../world-info.view-model'
import { QueryHandlers } from '@application/handlers/query.handler'
import { BrowserApiService } from '@presentation/services/browser-api.service'
import { runEffect, expectEffect, presentationTestUtils } from '../../__tests__/setup'

describe('WorldInfoViewModel', () => {
  let mockQueryHandlers: ReturnType<typeof presentationTestUtils.createMockQueryHandlers>
  let mockBrowserApi: any
  let worldInfoViewModel: WorldInfoViewModelInterface

  beforeEach(async () => {
    mockQueryHandlers = presentationTestUtils.createMockQueryHandlers()
    
    mockBrowserApi = {
      getCurrentTime: vi.fn(() => Effect.succeed(Date.now())),
      getMemoryUsage: vi.fn(),
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      getPerformanceNow: vi.fn()
    }

    const layer = Layer.mergeAll(
      Layer.succeed(QueryHandlers, mockQueryHandlers),
      Layer.succeed(BrowserApiService, mockBrowserApi)
    )
    
    worldInfoViewModel = await runEffect(
      Effect.provide(WorldInfoViewModel, Layer.provide(WorldInfoViewModelLive, layer))
    )
  })

  describe('getWorldInfo', () => {
    it('should return complete world info', async () => {
      const currentTime = 1000000000
      mockBrowserApi.getCurrentTime.mockReturnValueOnce(Effect.succeed(currentTime))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [{ x: 0, z: 0 }, { x: 1, z: 0 }],
        physics: null
      }))
      
      mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.succeed([
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 0, z: 1 }
      ]))

      const worldInfo = await runEffect(worldInfoViewModel.getWorldInfo())
      
      expect(worldInfo).toBeDefined()
      expect(worldInfo.name).toBe('New World')
      expect(worldInfo.seed).toBe('12345')
      expect(worldInfo.loadedChunks).toBe(3)
      expect(worldInfo.time).toBeDefined()
      expect(worldInfo.weather).toBeDefined()
    })

    it('should calculate world time correctly', async () => {
      const baseTime = 1000000000
      const currentTime = baseTime + 240000 // 4 minutes later
      
      mockBrowserApi.getCurrentTime.mockReturnValueOnce(Effect.succeed(currentTime))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.succeed([]))

      const worldInfo = await runEffect(worldInfoViewModel.getWorldInfo())
      
      // Time calculation: (currentTime - (currentTime - 60000)) / 100 = 60000 / 100 = 600
      // Day: Math.floor(600 / 24000) + 1 = 1
      // DayTime: 600 % 24000 = 600
      // TimeOfDay: dawn (< 1000)
      expect(worldInfo.time.day).toBe(1)
      expect(worldInfo.time.timeOfDay).toBe('dawn')
      expect(worldInfo.time.formatted).toMatch(/Day 1, \d+:\d{2}/)
    })

    it('should calculate different times of day correctly', async () => {
      const testCases = [
        { elapsed: 50000, expectedTimeOfDay: 'dawn' as const },      // 500 world time
        { elapsed: 200000, expectedTimeOfDay: 'morning' as const },   // 2000 world time
        { elapsed: 700000, expectedTimeOfDay: 'noon' as const },      // 7000 world time
        { elapsed: 1300000, expectedTimeOfDay: 'evening' as const },  // 13000 world time
        { elapsed: 1900000, expectedTimeOfDay: 'night' as const }     // 19000 world time
      ]

      for (const testCase of testCases) {
        const currentTime = 1000000000 + testCase.elapsed
        mockBrowserApi.getCurrentTime.mockReturnValueOnce(Effect.succeed(currentTime))
        
        mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
          entities: [],
          chunks: [],
          physics: null
        }))
        
        mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.succeed([]))

        const worldInfo = await runEffect(worldInfoViewModel.getWorldInfo())
        
        expect(worldInfo.time.timeOfDay).toBe(testCase.expectedTimeOfDay)
      }
    })

    it('should handle multiple days correctly', async () => {
      // 2.5 days worth of world time: 24000 * 2.5 * 100 = 6,000,000 ms
      const elapsed = 6000000
      const currentTime = 1000000000 + elapsed
      
      mockBrowserApi.getCurrentTime.mockReturnValueOnce(Effect.succeed(currentTime))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.succeed([]))

      const worldInfo = await runEffect(worldInfoViewModel.getWorldInfo())
      
      // World time: (6000000 - 60000) / 100 = 59400
      // Day: Math.floor(59400 / 24000) + 1 = 3
      expect(worldInfo.time.day).toBe(3)
      expect(worldInfo.time.formatted).toMatch(/Day 3, \d+:\d{2}/)
    })

    it('should format time string correctly', async () => {
      const testCases = [
        { worldTime: 0, expectedHour: 6, expectedMinute: 0 },      // 6:00
        { worldTime: 1000, expectedHour: 7, expectedMinute: 0 },   // 7:00
        { worldTime: 6000, expectedHour: 12, expectedMinute: 0 },  // 12:00 (noon)
        { worldTime: 12000, expectedHour: 18, expectedMinute: 0 }, // 18:00 (6 PM)
        { worldTime: 18000, expectedHour: 0, expectedMinute: 0 },  // 0:00 (midnight)
        { worldTime: 500, expectedHour: 6, expectedMinute: 30 }    // 6:30
      ]

      for (const testCase of testCases) {
        // Calculate required elapsed time to get desired world time
        const elapsedTime = (testCase.worldTime * 100) + 60000
        const currentTime = 1000000000 + elapsedTime
        
        mockBrowserApi.getCurrentTime.mockReturnValueOnce(Effect.succeed(currentTime))
        
        mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
          entities: [],
          chunks: [],
          physics: null
        }))
        
        mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.succeed([]))

        const worldInfo = await runEffect(worldInfoViewModel.getWorldInfo())
        
        const expectedTime = `${testCase.expectedHour}:${testCase.expectedMinute.toString().padStart(2, '0')}`
        expect(worldInfo.time.formatted).toContain(expectedTime)
      }
    })

    it('should include weather information', async () => {
      mockBrowserApi.getCurrentTime.mockReturnValueOnce(Effect.succeed(1000000000))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.succeed([]))

      const worldInfo = await runEffect(worldInfoViewModel.getWorldInfo())
      
      expect(worldInfo.weather).toEqual({
        current: 'clear',
        temperature: 20
      })
    })

    it('should count loaded chunks correctly', async () => {
      const chunks = [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 0, z: 1 },
        { x: 1, z: 1 },
        { x: -1, z: 0 }
      ]
      
      mockBrowserApi.getCurrentTime.mockReturnValueOnce(Effect.succeed(1000000000))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks,
        physics: null
      }))
      
      mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.succeed(chunks))

      const worldInfo = await runEffect(worldInfoViewModel.getWorldInfo())
      
      expect(worldInfo.loadedChunks).toBe(5)
    })

    it('should call query handlers with correct parameters', async () => {
      mockBrowserApi.getCurrentTime.mockReturnValueOnce(Effect.succeed(1000000000))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.succeed([]))

      await runEffect(worldInfoViewModel.getWorldInfo())
      
      expect(mockQueryHandlers.getWorldState).toHaveBeenCalledWith({
        includeEntities: false,
        includeChunks: true,
        includePhysics: false
      })
      expect(mockQueryHandlers.getLoadedChunks).toHaveBeenCalled()
    })

    it('should handle world state query errors', async () => {
      const error = new Error('World state query failed')
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.fail(error))

      await expectEffect.toFailWith(
        worldInfoViewModel.getWorldInfo(),
        error
      )
    })

    it('should handle loaded chunks query errors', async () => {
      mockBrowserApi.getCurrentTime.mockReturnValueOnce(Effect.succeed(1000000000))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      const error = new Error('Loaded chunks query failed')
      mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.fail(error))

      await expectEffect.toFailWith(
        worldInfoViewModel.getWorldInfo(),
        error
      )
    })

    it('should handle browser time API errors', async () => {
      const error = new Error('Time API failed')
      mockBrowserApi.getCurrentTime.mockReturnValueOnce(Effect.fail(error))

      await expectEffect.toFailWith(
        worldInfoViewModel.getWorldInfo(),
        error
      )
    })
  })

  describe('getChunkCount', () => {
    it('should return correct chunk count', async () => {
      const chunks = [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 0, z: 1 }
      ]
      
      mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.succeed(chunks))

      const count = await runEffect(worldInfoViewModel.getChunkCount())
      
      expect(count).toBe(3)
    })

    it('should return zero for no chunks', async () => {
      mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.succeed([]))

      const count = await runEffect(worldInfoViewModel.getChunkCount())
      
      expect(count).toBe(0)
    })

    it('should handle large number of chunks', async () => {
      const chunks = Array.from({ length: 1000 }, (_, i) => ({
        x: Math.floor(i / 32),
        z: i % 32
      }))
      
      mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.succeed(chunks))

      const count = await runEffect(worldInfoViewModel.getChunkCount())
      
      expect(count).toBe(1000)
    })

    it('should handle getLoadedChunks errors', async () => {
      const error = new Error('Chunks query failed')
      mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.fail(error))

      await expectEffect.toFailWith(
        worldInfoViewModel.getChunkCount(),
        error
      )
    })
  })

  describe('WorldInfoViewModelLive layer', () => {
    it('should create WorldInfoViewModel with dependencies', async () => {
      const layer = Layer.mergeAll(
        Layer.succeed(QueryHandlers, mockQueryHandlers),
        Layer.succeed(BrowserApiService, mockBrowserApi)
      )
      
      const viewModel = await runEffect(
        Effect.provide(WorldInfoViewModel, Layer.provide(WorldInfoViewModelLive, layer))
      )
      
      expect(viewModel).toBeDefined()
      expect(typeof viewModel.getWorldInfo).toBe('function')
      expect(typeof viewModel.getChunkCount).toBe('function')
    })

    it('should handle missing QueryHandlers dependency', async () => {
      const incompleteLayer = Layer.succeed(BrowserApiService, mockBrowserApi)
      
      await expect(
        runEffect(Effect.provide(WorldInfoViewModel, Layer.provide(WorldInfoViewModelLive, incompleteLayer)))
      ).rejects.toThrow()
    })

    it('should handle missing BrowserApiService dependency', async () => {
      const incompleteLayer = Layer.succeed(QueryHandlers, mockQueryHandlers)
      
      await expect(
        runEffect(Effect.provide(WorldInfoViewModel, Layer.provide(WorldInfoViewModelLive, incompleteLayer)))
      ).rejects.toThrow()
    })
  })

  describe('createWorldInfoViewModel factory', () => {
    it('should create view model instance directly', () => {
      const viewModel = createWorldInfoViewModel(mockQueryHandlers, mockBrowserApi)
      
      expect(viewModel).toBeDefined()
      expect(typeof viewModel.getWorldInfo).toBe('function')
      expect(typeof viewModel.getChunkCount).toBe('function')
    })

    it('should work with factory created view model', async () => {
      const viewModel = createWorldInfoViewModel(mockQueryHandlers, mockBrowserApi)
      
      mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.succeed([
        { x: 0, z: 0 },
        { x: 1, z: 0 }
      ]))

      const count = await runEffect(viewModel.getChunkCount())
      
      expect(count).toBe(2)
    })
  })

  describe('Complex scenarios', () => {
    it('should handle world progression over time', async () => {
      const baseTime = 1000000000
      const progression = [
        { elapsed: 0, expectedDay: 1, expectedTimeOfDay: 'dawn' as const },
        { elapsed: 600000, expectedDay: 1, expectedTimeOfDay: 'morning' as const },
        { elapsed: 1200000, expectedDay: 1, expectedTimeOfDay: 'noon' as const },
        { elapsed: 2400000, expectedDay: 2, expectedTimeOfDay: 'dawn' as const }
      ]

      for (const step of progression) {
        const currentTime = baseTime + step.elapsed
        mockBrowserApi.getCurrentTime.mockReturnValueOnce(Effect.succeed(currentTime))
        
        mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
          entities: [],
          chunks: [],
          physics: null
        }))
        
        mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.succeed([]))

        const worldInfo = await runEffect(worldInfoViewModel.getWorldInfo())
        
        expect(worldInfo.time.day).toBe(step.expectedDay)
        expect(worldInfo.time.timeOfDay).toBe(step.expectedTimeOfDay)
      }
    })

    it('should handle concurrent world info requests', async () => {
      mockBrowserApi.getCurrentTime.mockReturnValue(Effect.succeed(1000000000))
      
      mockQueryHandlers.getWorldState.mockReturnValue(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      mockQueryHandlers.getLoadedChunks.mockReturnValue(Effect.succeed([
        { x: 0, z: 0 }
      ]))

      const results = await runEffect(Effect.all([
        worldInfoViewModel.getWorldInfo(),
        worldInfoViewModel.getChunkCount(),
        worldInfoViewModel.getWorldInfo()
      ]))
      
      expect(results).toHaveLength(3)
      expect(results[0]).toHaveProperty('name')
      expect(results[0]).toHaveProperty('time')
      expect(results[1]).toBe(1) // chunk count
      expect(results[2]).toHaveProperty('name')
    })

    it('should maintain consistency between getWorldInfo and getChunkCount', async () => {
      const chunks = [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 0, z: 1 },
        { x: 1, z: 1 }
      ]
      
      mockBrowserApi.getCurrentTime.mockReturnValueOnce(Effect.succeed(1000000000))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks,
        physics: null
      }))
      
      mockQueryHandlers.getLoadedChunks
        .mockReturnValueOnce(Effect.succeed(chunks))  // For getWorldInfo
        .mockReturnValueOnce(Effect.succeed(chunks))  // For getChunkCount

      const worldInfo = await runEffect(worldInfoViewModel.getWorldInfo())
      const chunkCount = await runEffect(worldInfoViewModel.getChunkCount())
      
      expect(worldInfo.loadedChunks).toBe(chunkCount)
      expect(worldInfo.loadedChunks).toBe(4)
    })
  })

  describe('Edge cases', () => {
    it('should handle zero elapsed time', async () => {
      const currentTime = 1000000000
      mockBrowserApi.getCurrentTime.mockReturnValueOnce(Effect.succeed(currentTime))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.succeed([]))

      const worldInfo = await runEffect(worldInfoViewModel.getWorldInfo())
      
      // With -60000 offset: (currentTime - (currentTime - 60000)) / 100 = 600
      expect(worldInfo.time.day).toBe(1)
      expect(worldInfo.time.timeOfDay).toBe('dawn')
    })

    it('should handle very large elapsed times', async () => {
      const currentTime = 1000000000 + (365 * 24 * 60 * 60 * 1000) // 1 year later
      mockBrowserApi.getCurrentTime.mockReturnValueOnce(Effect.succeed(currentTime))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.succeed([]))

      const worldInfo = await runEffect(worldInfoViewModel.getWorldInfo())
      
      expect(worldInfo.time.day).toBeGreaterThan(1)
      expect(worldInfo.time.formatted).toMatch(/Day \d+, \d+:\d{2}/)
    })

    it('should handle negative time calculations gracefully', async () => {
      // This scenario could happen if system clock goes backwards
      const currentTime = 500000000 // Earlier than the -60000 offset
      mockBrowserApi.getCurrentTime.mockReturnValueOnce(Effect.succeed(currentTime))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.succeed([]))

      const worldInfo = await runEffect(worldInfoViewModel.getWorldInfo())
      
      // Should still return valid time info
      expect(worldInfo.time).toBeDefined()
      expect(worldInfo.time.day).toBeGreaterThanOrEqual(1)
      expect(worldInfo.time.formatted).toMatch(/Day \d+, \d+:\d{2}/)
    })

    it('should handle empty chunks array', async () => {
      mockBrowserApi.getCurrentTime.mockReturnValueOnce(Effect.succeed(1000000000))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.succeed([]))

      const worldInfo = await runEffect(worldInfoViewModel.getWorldInfo())
      
      expect(worldInfo.loadedChunks).toBe(0)
    })

    it('should handle very large chunk counts', async () => {
      const largeChunkArray = Array.from({ length: 100000 }, (_, i) => ({
        x: i % 1000,
        z: Math.floor(i / 1000)
      }))
      
      mockBrowserApi.getCurrentTime.mockReturnValueOnce(Effect.succeed(1000000000))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: largeChunkArray,
        physics: null
      }))
      
      mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.succeed(largeChunkArray))

      const worldInfo = await runEffect(worldInfoViewModel.getWorldInfo())
      
      expect(worldInfo.loadedChunks).toBe(100000)
    })
  })
})