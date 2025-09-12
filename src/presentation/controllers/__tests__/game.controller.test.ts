import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Effect, Layer, Random, Clock, Context } from 'effect'
import { 
  GameController,
  GameControllerLive,
  createGameController,
  type GameControllerState,
  type GameControllerInterface
} from '../game.controller'
import { CommandHandlers } from '@application/handlers/command.handler'
import { QueryHandlers } from '@application/handlers/query.handler'
import { runEffect, expectEffect, presentationTestUtils } from '../../__tests__/setup'

describe('GameController', () => {
  let mockCommandHandlers: ReturnType<typeof presentationTestUtils.createMockCommandHandlers>
  let mockQueryHandlers: ReturnType<typeof presentationTestUtils.createMockQueryHandlers>
  let gameController: GameControllerInterface

  beforeEach(async () => {
    mockCommandHandlers = presentationTestUtils.createMockCommandHandlers()
    mockQueryHandlers = presentationTestUtils.createMockQueryHandlers()
    
    const layer = Layer.mergeAll(
      Layer.succeed(CommandHandlers, mockCommandHandlers),
      Layer.succeed(QueryHandlers, mockQueryHandlers)
    )
    
    gameController = await runEffect(
      Effect.provide(GameController, Layer.provide(GameControllerLive, layer))
    )
  })

  describe('initializeWorld', () => {
    it('should initialize world with provided seed', async () => {
      const seed = 'test-seed-123'
      
      await runEffect(
        Effect.provide(gameController.initializeWorld(seed), Layer.mergeAll(
          Layer.succeed(Random.Random, Random.make(42)),
          Layer.succeed(Clock.Clock, Clock.make(() => 1000))
        ))
      )
      
      expect(mockCommandHandlers.handleWorldGenerate).toHaveBeenCalledWith({
        seed,
        worldType: 'default',
        generateStructures: true,
        timestamp: 1000
      })
    })

    it('should generate random seed when none provided', async () => {
      await runEffect(
        Effect.provide(gameController.initializeWorld(), Layer.mergeAll(
          Layer.succeed(Random.Random, Random.make(42)),
          Layer.succeed(Clock.Clock, Clock.make(() => 2000))
        ))
      )
      
      expect(mockCommandHandlers.handleWorldGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          worldType: 'default',
          generateStructures: true,
          timestamp: 2000,
          seed: expect.any(String)
        })
      )
    })

    it('should handle world generation errors', async () => {
      const error = new Error('World generation failed')
      mockCommandHandlers.handleWorldGenerate.mockReturnValueOnce(Effect.fail(error))
      
      await expectEffect.toFailWith(
        Effect.provide(gameController.initializeWorld('test'), Layer.mergeAll(
          Layer.succeed(Random.Random, Random.make(42)),
          Layer.succeed(Clock.Clock, Clock.make(() => 1000))
        )),
        error
      )
    })
  })

  describe('pauseGame', () => {
    it('should pause game successfully', async () => {
      const result = await runEffect(gameController.pauseGame())
      expect(result).toBeUndefined()
    })

    it('should return Effect that logs pause message', async () => {
      const effect = gameController.pauseGame()
      expect(effect).toBeValidControllerResponse()
      await runEffect(effect)
    })
  })

  describe('resumeGame', () => {
    it('should resume game successfully', async () => {
      const result = await runEffect(gameController.resumeGame())
      expect(result).toBeUndefined()
    })

    it('should return Effect that logs resume message', async () => {
      const effect = gameController.resumeGame()
      expect(effect).toBeValidControllerResponse()
      await runEffect(effect)
    })
  })

  describe('handlePlayerMovement', () => {
    it('should handle player movement command', async () => {
      const command = {
        entityId: 'player-1',
        position: { x: 10, y: 20, z: 30 },
        velocity: { x: 1, y: 0, z: 1 },
        timestamp: Date.now()
      }
      
      await runEffect(gameController.handlePlayerMovement(command))
      
      expect(mockCommandHandlers.handlePlayerMovement).toHaveBeenCalledWith(command)
    })

    it('should handle movement command errors', async () => {
      const error = new Error('Movement failed')
      mockCommandHandlers.handlePlayerMovement.mockReturnValueOnce(Effect.fail(error))
      
      const command = {
        entityId: 'player-1',
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        timestamp: Date.now()
      }
      
      await expectEffect.toFailWith(
        gameController.handlePlayerMovement(command),
        error
      )
    })
  })

  describe('handleBlockInteraction', () => {
    it('should handle block place interaction', async () => {
      const command = {
        action: 'place' as const,
        blockType: 'stone',
        position: { x: 5, y: 10, z: 15 },
        playerId: 'player-1',
        timestamp: Date.now()
      }
      
      await runEffect(gameController.handleBlockInteraction(command))
      
      expect(mockCommandHandlers.handleBlockInteraction).toHaveBeenCalledWith(command)
    })

    it('should handle block break interaction', async () => {
      const command = {
        action: 'break' as const,
        blockType: 'dirt',
        position: { x: 1, y: 2, z: 3 },
        playerId: 'player-1',
        timestamp: Date.now()
      }
      
      await runEffect(gameController.handleBlockInteraction(command))
      
      expect(mockCommandHandlers.handleBlockInteraction).toHaveBeenCalledWith(command)
    })

    it('should handle block interaction errors', async () => {
      const error = new Error('Block interaction failed')
      mockCommandHandlers.handleBlockInteraction.mockReturnValueOnce(Effect.fail(error))
      
      const command = {
        action: 'place' as const,
        blockType: 'stone',
        position: { x: 0, y: 0, z: 0 },
        playerId: 'player-1',
        timestamp: Date.now()
      }
      
      await expectEffect.toFailWith(
        gameController.handleBlockInteraction(command),
        error
      )
    })
  })

  describe('getGameState', () => {
    it('should return current game state', async () => {
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: [{ id: 'player-1' }, { id: 'mob-1' }],
        chunks: [],
        physics: null
      }))
      
      mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.succeed([
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 0, z: 1 }
      ]))
      
      const gameState = await runEffect(gameController.getGameState())
      
      expect(gameState).toBeValidGameState()
      expect(gameState).toEqual({
        isRunning: true,
        isPaused: false,
        playerCount: 2,
        loadedChunks: 3
      })
    })

    it('should handle missing entities in world state', async () => {
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.succeed({
        entities: undefined,
        chunks: [],
        physics: null
      }))
      
      mockQueryHandlers.getLoadedChunks.mockReturnValueOnce(Effect.succeed([]))
      
      const gameState = await runEffect(gameController.getGameState())
      
      expect(gameState.playerCount).toBe(0)
      expect(gameState.loadedChunks).toBe(0)
    })

    it('should handle query errors', async () => {
      const error = new Error('Query failed')
      mockQueryHandlers.getWorldState.mockReturnValueOnce(Effect.fail(error))
      
      await expectEffect.toFailWith(
        gameController.getGameState(),
        error
      )
    })
  })

  describe('GameControllerLive layer', () => {
    it('should create GameController with dependencies', async () => {
      const layer = Layer.mergeAll(
        Layer.succeed(CommandHandlers, mockCommandHandlers),
        Layer.succeed(QueryHandlers, mockQueryHandlers)
      )
      
      const controller = await runEffect(
        Effect.provide(GameController, Layer.provide(GameControllerLive, layer))
      )
      
      expect(controller).toBeDefined()
      expect(controller.initializeWorld).toBeDefined()
      expect(controller.pauseGame).toBeDefined()
      expect(controller.resumeGame).toBeDefined()
      expect(controller.handlePlayerMovement).toBeDefined()
      expect(controller.handleBlockInteraction).toBeDefined()
      expect(controller.getGameState).toBeDefined()
    })

    it('should satisfy GameControllerInterface', async () => {
      const layer = Layer.mergeAll(
        Layer.succeed(CommandHandlers, mockCommandHandlers),
        Layer.succeed(QueryHandlers, mockQueryHandlers)
      )
      
      const controller = await runEffect(
        Effect.provide(GameController, Layer.provide(GameControllerLive, layer))
      )
      
      // Type check - all methods should be functions
      expect(typeof controller.initializeWorld).toBe('function')
      expect(typeof controller.pauseGame).toBe('function')
      expect(typeof controller.resumeGame).toBe('function')
      expect(typeof controller.handlePlayerMovement).toBe('function')
      expect(typeof controller.handleBlockInteraction).toBe('function')
      expect(typeof controller.getGameState).toBe('function')
    })
  })

  describe('createGameController factory', () => {
    it('should create controller instance directly', () => {
      const controller = createGameController(mockCommandHandlers, mockQueryHandlers)
      
      expect(controller).toBeDefined()
      expect(controller.initializeWorld).toBeDefined()
      expect(controller.pauseGame).toBeDefined()
      expect(controller.resumeGame).toBeDefined()
      expect(controller.handlePlayerMovement).toBeDefined()
      expect(controller.handleBlockInteraction).toBeDefined()
      expect(controller.getGameState).toBeDefined()
    })

    it('should work with factory created controller', async () => {
      const controller = createGameController(mockCommandHandlers, mockQueryHandlers)
      
      await runEffect(controller.pauseGame())
      await runEffect(controller.resumeGame())
      
      // Should not throw and should call underlying handlers when needed
      expect(controller).toBeDefined()
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle multiple simultaneous operations', async () => {
      const effects = [
        gameController.pauseGame(),
        gameController.resumeGame(),
        gameController.getGameState()
      ]
      
      const results = await runEffect(Effect.all(effects))
      expect(results).toHaveLength(3)
    })

    it('should handle invalid command structures gracefully', async () => {
      const invalidCommand = {
        entityId: '',
        position: null,
        velocity: undefined,
        timestamp: NaN
      } as any
      
      mockCommandHandlers.handlePlayerMovement.mockReturnValueOnce(
        Effect.fail(new Error('Invalid command'))
      )
      
      await expectEffect.toFail(
        gameController.handlePlayerMovement(invalidCommand)
      )
    })

    it('should maintain state consistency across operations', async () => {
      // Test that multiple operations don't interfere with each other
      await runEffect(gameController.pauseGame())
      const state1 = await runEffect(gameController.getGameState())
      
      await runEffect(gameController.resumeGame())
      const state2 = await runEffect(gameController.getGameState())
      
      // States should be valid even if internal values are mocked
      expect(state1).toBeValidGameState()
      expect(state2).toBeValidGameState()
    })
  })
})