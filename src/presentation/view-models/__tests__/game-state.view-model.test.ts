import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Effect, Layer, Context } from 'effect'
import { 
  GameStateViewModel,
  GameStateViewModelLive,
  createGameStateViewModel,
  type GameStateViewModelExtended,
  type GameStateView,
  type MemoryUsage
} from '../game-state.view-model'
import { QueryHandlers } from '@application/handlers/query.handler'
import { BrowserApiService } from '@presentation/services/browser-api.service'
import { runEffect, expectEffect, presentationTestUtils } from '../../__tests__/setup'

describe('GameStateViewModel', () => {
  let mockQueryHandlers: ReturnType<typeof presentationTestUtils.createMockQueryHandlers>
  let mockBrowserApi: any
  let gameStateViewModel: GameStateViewModelExtended

  beforeEach(async () => {
    mockQueryHandlers = presentationTestUtils.createMockQueryHandlers()
    
    mockBrowserApi = {
      getCurrentTime: vi.fn(() => Effect.succeed(Date.now())),
      getMemoryUsage: vi.fn(() => Effect.succeed({
        used: 1000000,
        total: 2000000,
        limit: 4000000,
        percentage: 50
      })),
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
    
    gameStateViewModel = await runEffect(
      Effect.provide(GameStateViewModel, Layer.provide(GameStateViewModelLive, layer))
    )
  })

  describe('getGameState', () => {
    it('should return valid game state with memory usage', async () => {
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [{ id: 'player-1' }],
        chunks: [{ x: 0, z: 0 }],
        physics: null
      }))

      const gameState = await runEffect(gameStateViewModel.getGameState())
      
      expect(gameState).toBeDefined()
      expect(gameState).toHaveProperty('isRunning')
      expect(gameState).toHaveProperty('isPaused')
      expect(gameState).toHaveProperty('gameTime')
      expect(gameState).toHaveProperty('fps')
      expect(gameState).toHaveProperty('memoryUsage')
      
      expect(typeof gameState.isRunning).toBe('boolean')
      expect(typeof gameState.isPaused).toBe('boolean')
      expect(typeof gameState.gameTime).toBe('number')
      expect(typeof gameState.fps).toBe('number')
      expect(gameState.memoryUsage).toHaveValidMemoryInfo()
    })

    it('should calculate game time correctly', async () => {
      const startTime = 1000000
      const currentTime = 1003000 // 3 seconds later
      
      mockBrowserApi.getCurrentTime
        .mockReturnValueOnce(Effect.succeed(startTime)) // Initial call for setup
        .mockReturnValueOnce(Effect.succeed(currentTime)) // Call during getGameState

      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))

      // Create a fresh view model to test the timing
      const freshViewModel = await runEffect(
        Effect.provide(GameStateViewModel, Layer.provide(GameStateViewModelLive, Layer.mergeAll(
          Layer.succeed(QueryHandlers, mockQueryHandlers),
          Layer.succeed(BrowserApiService, mockBrowserApi)
        )))
      )

      const gameState = await runEffect(freshViewModel.getGameState())
      
      expect(gameState.gameTime).toBe(3000) // 3 seconds difference
    })

    it('should include memory usage from browser API', async () => {
      const memoryInfo = {
        used: 1500000,
        total: 3000000,
        limit: 6000000,
        percentage: 50
      }
      
      mockBrowserApi.getMemoryUsage.mockReturnValueOnce(Effect.succeed(memoryInfo))
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))

      const gameState = await runEffect(gameStateViewModel.getGameState())
      
      expect(gameState.memoryUsage).toEqual({
        used: 1500000,
        total: 3000000,
        percentage: 50
      })
    })

    it('should handle memory usage API failure gracefully', async () => {
      mockBrowserApi.getMemoryUsage.mockReturnValueOnce(Effect.fail(new Error('Memory API failed')))
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))

      const gameState = await runEffect(gameStateViewModel.getGameState())
      
      expect(gameState.memoryUsage).toEqual({
        used: 0,
        total: 0,
        percentage: 0
      })
    })

    it('should return initial game state values', async () => {
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))

      const gameState = await runEffect(gameStateViewModel.getGameState())
      
      expect(gameState.isRunning).toBe(false)
      expect(gameState.isPaused).toBe(false)
      expect(gameState.fps).toBe(60)
    })

    it('should handle world state query errors', async () => {
      const error = new Error('World state query failed')
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.fail(error))

      await expectEffect.toFailWith(
        gameStateViewModel.getGameState(),
        error
      )
    })

    it('should call getWorldState with correct parameters', async () => {
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))

      await runEffect(gameStateViewModel.getGameState())
      
      expect(mockQueryHandlers.getWorldState).toHaveBeenCalledWith({
        includeEntities: true,
        includeChunks: true,
        includePhysics: false
      })
    })
  })

  describe('updateFPS', () => {
    it('should update FPS value', async () => {
      const newFPS = 120
      
      await runEffect(gameStateViewModel.updateFPS(newFPS))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      const gameState = await runEffect(gameStateViewModel.getGameState())
      expect(gameState.fps).toBe(newFPS)
    })

    it('should not affect other game state properties', async () => {
      await runEffect(gameStateViewModel.updateGameRunningState(true, true))
      await runEffect(gameStateViewModel.updateFPS(90))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      const gameState = await runEffect(gameStateViewModel.getGameState())
      expect(gameState.fps).toBe(90)
      expect(gameState.isRunning).toBe(true)
      expect(gameState.isPaused).toBe(true)
    })

    it('should handle zero FPS', async () => {
      await runEffect(gameStateViewModel.updateFPS(0))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      const gameState = await runEffect(gameStateViewModel.getGameState())
      expect(gameState.fps).toBe(0)
    })

    it('should handle negative FPS', async () => {
      await runEffect(gameStateViewModel.updateFPS(-10))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      const gameState = await runEffect(gameStateViewModel.getGameState())
      expect(gameState.fps).toBe(-10)
    })
  })

  describe('updateGameRunningState', () => {
    it('should update running state only', async () => {
      await runEffect(gameStateViewModel.updateGameRunningState(true))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      const gameState = await runEffect(gameStateViewModel.getGameState())
      expect(gameState.isRunning).toBe(true)
      expect(gameState.isPaused).toBe(false) // Default value
    })

    it('should update both running and paused state', async () => {
      await runEffect(gameStateViewModel.updateGameRunningState(true, true))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      const gameState = await runEffect(gameStateViewModel.getGameState())
      expect(gameState.isRunning).toBe(true)
      expect(gameState.isPaused).toBe(true)
    })

    it('should handle stop game state', async () => {
      await runEffect(gameStateViewModel.updateGameRunningState(false, false))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      const gameState = await runEffect(gameStateViewModel.getGameState())
      expect(gameState.isRunning).toBe(false)
      expect(gameState.isPaused).toBe(false)
    })

    it('should not affect FPS when updating game state', async () => {
      await runEffect(gameStateViewModel.updateFPS(144))
      await runEffect(gameStateViewModel.updateGameRunningState(true, true))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      const gameState = await runEffect(gameStateViewModel.getGameState())
      expect(gameState.fps).toBe(144)
      expect(gameState.isRunning).toBe(true)
      expect(gameState.isPaused).toBe(true)
    })
  })

  describe('GameStateViewModelLive layer', () => {
    it('should create GameStateViewModel with dependencies', async () => {
      const layer = Layer.mergeAll(
        Layer.succeed(QueryHandlers, mockQueryHandlers),
        Layer.succeed(BrowserApiService, mockBrowserApi)
      )
      
      const viewModel = await runEffect(
        Effect.provide(GameStateViewModel, Layer.provide(GameStateViewModelLive, layer))
      )
      
      expect(viewModel).toBeDefined()
      expect(typeof viewModel.getGameState).toBe('function')
      expect(typeof viewModel.updateFPS).toBe('function')
      expect(typeof viewModel.updateGameRunningState).toBe('function')
    })

    it('should handle missing dependencies gracefully', async () => {
      // Test without proper dependencies should fail at runtime
      const incompleteLayer = Layer.succeed(QueryHandlers, mockQueryHandlers)
      // Missing BrowserApiService should cause an error
      
      await expect(
        runEffect(Effect.provide(GameStateViewModel, Layer.provide(GameStateViewModelLive, incompleteLayer)))
      ).rejects.toThrow()
    })
  })

  describe('createGameStateViewModel factory', () => {
    it('should create view model instance directly', () => {
      const viewModel = createGameStateViewModel(mockQueryHandlers, mockBrowserApi)
      
      expect(viewModel).toBeDefined()
      expect(typeof viewModel.getGameState).toBe('function')
      expect(typeof viewModel.updateFPS).toBe('function')
    })

    it('should work with factory created view model', async () => {
      const viewModel = createGameStateViewModel(mockQueryHandlers, mockBrowserApi)
      
      await runEffect(viewModel.updateFPS(75))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      const gameState = await runEffect(viewModel.getGameState())
      expect(gameState.fps).toBe(75)
    })
  })

  describe('Complex workflows', () => {
    it('should handle game lifecycle state changes', async () => {
      // Game starts
      await runEffect(gameStateViewModel.updateGameRunningState(true, false))
      await runEffect(gameStateViewModel.updateFPS(60))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [{ id: 'player-1' }],
        chunks: [{ x: 0, z: 0 }],
        physics: null
      }))
      
      let gameState = await runEffect(gameStateViewModel.getGameState())
      expect(gameState.isRunning).toBe(true)
      expect(gameState.isPaused).toBe(false)
      expect(gameState.fps).toBe(60)
      
      // Game pauses
      await runEffect(gameStateViewModel.updateGameRunningState(true, true))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [{ id: 'player-1' }],
        chunks: [{ x: 0, z: 0 }],
        physics: null
      }))
      
      gameState = await runEffect(gameStateViewModel.getGameState())
      expect(gameState.isRunning).toBe(true)
      expect(gameState.isPaused).toBe(true)
      
      // Game resumes with performance issues
      await runEffect(gameStateViewModel.updateGameRunningState(true, false))
      await runEffect(gameStateViewModel.updateFPS(30))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [{ id: 'player-1' }],
        chunks: [{ x: 0, z: 0 }],
        physics: null
      }))
      
      gameState = await runEffect(gameStateViewModel.getGameState())
      expect(gameState.isRunning).toBe(true)
      expect(gameState.isPaused).toBe(false)
      expect(gameState.fps).toBe(30)
    })

    it('should handle concurrent state updates', async () => {
      const operations = [
        gameStateViewModel.updateFPS(144),
        gameStateViewModel.updateGameRunningState(true, false)
      ]
      
      await runEffect(Effect.all(operations))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      const gameState = await runEffect(gameStateViewModel.getGameState())
      expect(gameState.fps).toBe(144)
      expect(gameState.isRunning).toBe(true)
      expect(gameState.isPaused).toBe(false)
    })

    it('should handle multiple getGameState calls', async () => {
      mockQueryHandlers.getWorldState.mockReturnValue(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))

      const states = await runEffect(Effect.all([
        gameStateViewModel.getGameState(),
        gameStateViewModel.getGameState(),
        gameStateViewModel.getGameState()
      ]))
      
      expect(states).toHaveLength(3)
      states.forEach(state => {
        expect(state).toHaveProperty('isRunning')
        expect(state).toHaveProperty('isPaused')
        expect(state).toHaveProperty('gameTime')
        expect(state).toHaveProperty('fps')
        expect(state).toHaveProperty('memoryUsage')
      })
    })
  })

  describe('Edge cases', () => {
    it('should handle very high FPS values', async () => {
      const highFPS = 999999
      await runEffect(gameStateViewModel.updateFPS(highFPS))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))
      
      const gameState = await runEffect(gameStateViewModel.getGameState())
      expect(gameState.fps).toBe(highFPS)
    })

    it('should handle memory usage with zero values', async () => {
      mockBrowserApi.getMemoryUsage.mockReturnValueOnce(Effect.succeed({
        used: 0,
        total: 0,
        limit: 0,
        percentage: 0
      }))
      
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))

      const gameState = await runEffect(gameStateViewModel.getGameState())
      
      expect(gameState.memoryUsage.used).toBe(0)
      expect(gameState.memoryUsage.total).toBe(0)
      expect(gameState.memoryUsage.percentage).toBe(0)
    })

    it('should handle getCurrentTime errors', async () => {
      mockBrowserApi.getCurrentTime.mockReturnValueOnce(Effect.fail(new Error('Time API failed')))
      
      await expect(
        runEffect(Effect.provide(GameStateViewModel, Layer.provide(GameStateViewModelLive, Layer.mergeAll(
          Layer.succeed(QueryHandlers, mockQueryHandlers),
          Layer.succeed(BrowserApiService, mockBrowserApi)
        ))))
      ).rejects.toThrow('Time API failed')
    })

    it('should maintain game time consistency', async () => {
      const baseTime = 1000000
      mockBrowserApi.getCurrentTime
        .mockReturnValueOnce(Effect.succeed(baseTime))
        .mockReturnValue(Effect.succeed(baseTime + 5000))

      const freshViewModel = await runEffect(
        Effect.provide(GameStateViewModel, Layer.provide(GameStateViewModelLive, Layer.mergeAll(
          Layer.succeed(QueryHandlers, mockQueryHandlers),
          Layer.succeed(BrowserApiService, mockBrowserApi)
        )))
      )

      mockQueryHandlers.getWorldState.mockReturnValue(Effect.succeed({
        entities: [],
        chunks: [],
        physics: null
      }))

      // Multiple calls should show consistent time progression
      const state1 = await runEffect(freshViewModel.getGameState())
      const state2 = await runEffect(freshViewModel.getGameState())
      
      expect(state1.gameTime).toBe(5000)
      expect(state2.gameTime).toBe(5000) // Same because getCurrentTime is mocked to return same value
    })
  })
})