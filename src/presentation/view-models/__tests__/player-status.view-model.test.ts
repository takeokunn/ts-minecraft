import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Effect, Layer } from 'effect'
import { 
  PlayerStatusViewModel,
  PlayerStatusViewModelLive,
  createPlayerStatusViewModel,
  type PlayerStatusViewModelInterface,
  type PlayerStatusView,
  type Position3D,
  type HealthStatus
} from '../player-status.view-model'
import { QueryHandlers } from '@application/handlers/query.handler'
import { runEffect, expectEffect, presentationTestUtils } from '../../__tests__/setup'

describe('PlayerStatusViewModel', () => {
  let mockQueryHandlers: ReturnType<typeof presentationTestUtils.createMockQueryHandlers>
  let playerStatusViewModel: PlayerStatusViewModelInterface

  beforeEach(async () => {
    mockQueryHandlers = presentationTestUtils.createMockQueryHandlers()
    
    const layer = Layer.succeed(QueryHandlers, mockQueryHandlers)
    
    playerStatusViewModel = await runEffect(
      Effect.provide(PlayerStatusViewModel, Layer.provide(PlayerStatusViewModelLive, layer))
    )
  })

  describe('getPlayerStatus', () => {
    it('should return formatted player status', async () => {
      const playerData = {
        id: 'player-1',
        position: { x: 123.45, y: 64.0, z: -456.78 },
        health: 18,
        inventory: []
      }
      
      mockQueryHandlers.getPlayerState.mockReturnValueOnce(Effect.succeed(playerData))

      const status = await runEffect(playerStatusViewModel.getPlayerStatus('player-1'))
      
      expect(status).toBeDefined()
      expect(status.position).toEqual({
        x: 123.45,
        y: 64.0,
        z: -456.78,
        formatted: 'X: 123, Y: 64, Z: -457'
      })
      expect(status.health).toEqual({
        current: 18,
        maximum: 20,
        percentage: 90,
        status: 'healthy'
      })
      expect(status.isOnGround).toBe(true)
      expect(status.currentBiome).toBe('Plains')
    })

    it('should format position coordinates correctly', async () => {
      const testCases = [
        {
          position: { x: 0, y: 0, z: 0 },
          expectedFormatted: 'X: 0, Y: 0, Z: 0'
        },
        {
          position: { x: 123.9, y: 64.1, z: -456.7 },
          expectedFormatted: 'X: 124, Y: 64, Z: -457'
        },
        {
          position: { x: -123.4, y: 255.8, z: 999.5 },
          expectedFormatted: 'X: -123, Y: 256, Z: 1000'
        }
      ]

      for (const testCase of testCases) {
        const playerData = {
          id: 'test-player',
          position: testCase.position,
          health: 20,
          inventory: []
        }
        
        mockQueryHandlers.getPlayerState.mockReturnValueOnce(Effect.succeed(playerData))
        
        const status = await runEffect(playerStatusViewModel.getPlayerStatus('test-player'))
        
        expect(status.position.formatted).toBe(testCase.expectedFormatted)
        expect(status.position.x).toBe(testCase.position.x)
        expect(status.position.y).toBe(testCase.position.y)
        expect(status.position.z).toBe(testCase.position.z)
      }
    })

    it('should calculate health status correctly for healthy player', async () => {
      const playerData = {
        id: 'player-1',
        position: { x: 0, y: 0, z: 0 },
        health: 20,
        inventory: []
      }
      
      mockQueryHandlers.getPlayerState.mockReturnValueOnce(Effect.succeed(playerData))

      const status = await runEffect(playerStatusViewModel.getPlayerStatus('player-1'))
      
      expect(status.health).toEqual({
        current: 20,
        maximum: 20,
        percentage: 100,
        status: 'healthy'
      })
    })

    it('should calculate health status correctly for injured player', async () => {
      const playerData = {
        id: 'player-1',
        position: { x: 0, y: 0, z: 0 },
        health: 10,
        inventory: []
      }
      
      mockQueryHandlers.getPlayerState.mockReturnValueOnce(Effect.succeed(playerData))

      const status = await runEffect(playerStatusViewModel.getPlayerStatus('player-1'))
      
      expect(status.health).toEqual({
        current: 10,
        maximum: 20,
        percentage: 50,
        status: 'injured'
      })
    })

    it('should calculate health status correctly for critical player', async () => {
      const playerData = {
        id: 'player-1',
        position: { x: 0, y: 0, z: 0 },
        health: 5,
        inventory: []
      }
      
      mockQueryHandlers.getPlayerState.mockReturnValueOnce(Effect.succeed(playerData))

      const status = await runEffect(playerStatusViewModel.getPlayerStatus('player-1'))
      
      expect(status.health).toEqual({
        current: 5,
        maximum: 20,
        percentage: 25,
        status: 'critical'
      })
    })

    it('should calculate health status correctly for dead player', async () => {
      const playerData = {
        id: 'player-1',
        position: { x: 0, y: 0, z: 0 },
        health: 0,
        inventory: []
      }
      
      mockQueryHandlers.getPlayerState.mockReturnValueOnce(Effect.succeed(playerData))

      const status = await runEffect(playerStatusViewModel.getPlayerStatus('player-1'))
      
      expect(status.health).toEqual({
        current: 0,
        maximum: 20,
        percentage: 0,
        status: 'dead'
      })
    })

    it('should handle edge case health values', async () => {
      const testCases = [
        { health: 1, expectedStatus: 'critical' as const, expectedPercentage: 5 },
        { health: 4, expectedStatus: 'critical' as const, expectedPercentage: 20 },
        { health: 5, expectedStatus: 'critical' as const, expectedPercentage: 25 },
        { health: 6, expectedStatus: 'injured' as const, expectedPercentage: 30 },
        { health: 10, expectedStatus: 'injured' as const, expectedPercentage: 50 },
        { health: 11, expectedStatus: 'healthy' as const, expectedPercentage: 55 },
        { health: 19, expectedStatus: 'healthy' as const, expectedPercentage: 95 },
        { health: 20, expectedStatus: 'healthy' as const, expectedPercentage: 100 }
      ]

      for (const testCase of testCases) {
        const playerData = {
          id: 'test-player',
          position: { x: 0, y: 0, z: 0 },
          health: testCase.health,
          inventory: []
        }
        
        mockQueryHandlers.getPlayerState.mockReturnValueOnce(Effect.succeed(playerData))
        
        const status = await runEffect(playerStatusViewModel.getPlayerStatus('test-player'))
        
        expect(status.health.current).toBe(testCase.health)
        expect(status.health.percentage).toBe(testCase.expectedPercentage)
        expect(status.health.status).toBe(testCase.expectedStatus)
      }
    })

    it('should call getPlayerState with correct entity ID', async () => {
      const entityId = 'specific-player-123'
      const playerData = {
        id: entityId,
        position: { x: 0, y: 0, z: 0 },
        health: 20,
        inventory: []
      }
      
      mockQueryHandlers.getPlayerState.mockReturnValueOnce(Effect.succeed(playerData))

      await runEffect(playerStatusViewModel.getPlayerStatus(entityId))
      
      expect(mockQueryHandlers.getPlayerState).toHaveBeenCalledWith({ entityId })
    })

    it('should handle getPlayerState errors', async () => {
      const error = new Error('Player not found')
      mockQueryHandlers.getPlayerState.mockReturnValueOnce(Effect.fail(error))

      await expectEffect.toFailWith(
        playerStatusViewModel.getPlayerStatus('invalid-player'),
        error
      )
    })

    it('should return default values for isOnGround and currentBiome', async () => {
      const playerData = {
        id: 'player-1',
        position: { x: 0, y: 0, z: 0 },
        health: 20,
        inventory: []
      }
      
      mockQueryHandlers.getPlayerState.mockReturnValueOnce(Effect.succeed(playerData))

      const status = await runEffect(playerStatusViewModel.getPlayerStatus('player-1'))
      
      expect(status.isOnGround).toBe(true)
      expect(status.currentBiome).toBe('Plains')
    })
  })

  describe('updateLocalState', () => {
    it('should update local state for given entity ID', async () => {
      const entityId = 'player-123'
      
      const result = await runEffect(playerStatusViewModel.updateLocalState(entityId))
      
      expect(result).toBeUndefined()
    })

    it('should handle empty entity ID', async () => {
      const result = await runEffect(playerStatusViewModel.updateLocalState(''))
      
      expect(result).toBeUndefined()
    })

    it('should handle multiple calls with different entity IDs', async () => {
      const operations = [
        playerStatusViewModel.updateLocalState('player-1'),
        playerStatusViewModel.updateLocalState('player-2'),
        playerStatusViewModel.updateLocalState('player-3')
      ]
      
      const results = await runEffect(Effect.all(operations))
      
      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result).toBeUndefined()
      })
    })
  })

  describe('PlayerStatusViewModelLive layer', () => {
    it('should create PlayerStatusViewModel with dependencies', async () => {
      const layer = Layer.succeed(QueryHandlers, mockQueryHandlers)
      
      const viewModel = await runEffect(
        Effect.provide(PlayerStatusViewModel, Layer.provide(PlayerStatusViewModelLive, layer))
      )
      
      expect(viewModel).toBeDefined()
      expect(typeof viewModel.getPlayerStatus).toBe('function')
      expect(typeof viewModel.updateLocalState).toBe('function')
    })

    it('should handle missing dependencies', async () => {
      // Test without QueryHandlers dependency
      await expect(
        runEffect(Effect.provide(PlayerStatusViewModel, PlayerStatusViewModelLive))
      ).rejects.toThrow()
    })
  })

  describe('createPlayerStatusViewModel factory', () => {
    it('should create view model instance directly', () => {
      const viewModel = createPlayerStatusViewModel(mockQueryHandlers)
      
      expect(viewModel).toBeDefined()
      expect(typeof viewModel.getPlayerStatus).toBe('function')
      expect(typeof viewModel.updateLocalState).toBe('function')
    })

    it('should work with factory created view model', async () => {
      const viewModel = createPlayerStatusViewModel(mockQueryHandlers)
      
      const playerData = {
        id: 'player-1',
        position: { x: 100, y: 64, z: -200 },
        health: 15,
        inventory: []
      }
      
      mockQueryHandlers.getPlayerState.mockReturnValueOnce(Effect.succeed(playerData))

      const status = await runEffect(viewModel.getPlayerStatus('player-1'))
      
      expect(status.position.formatted).toBe('X: 100, Y: 64, Z: -200')
      expect(status.health.status).toBe('healthy')
    })
  })

  describe('Complex scenarios', () => {
    it('should handle multiple players status requests', async () => {
      const players = [
        {
          id: 'player-1',
          position: { x: 0, y: 64, z: 0 },
          health: 20,
          inventory: []
        },
        {
          id: 'player-2',
          position: { x: 100, y: 80, z: -100 },
          health: 10,
          inventory: []
        },
        {
          id: 'player-3',
          position: { x: -50, y: 32, z: 75 },
          health: 2,
          inventory: []
        }
      ]

      mockQueryHandlers.getPlayerState
        .mockReturnValueOnce(Effect.succeed(players[0]))
        .mockReturnValueOnce(Effect.succeed(players[1]))
        .mockReturnValueOnce(Effect.succeed(players[2]))

      const statuses = await runEffect(Effect.all([
        playerStatusViewModel.getPlayerStatus('player-1'),
        playerStatusViewModel.getPlayerStatus('player-2'),
        playerStatusViewModel.getPlayerStatus('player-3')
      ]))

      expect(statuses).toHaveLength(3)
      
      expect(statuses[0].health.status).toBe('healthy')
      expect(statuses[0].position.formatted).toBe('X: 0, Y: 64, Z: 0')
      
      expect(statuses[1].health.status).toBe('injured')
      expect(statuses[1].position.formatted).toBe('X: 100, Y: 80, Z: -100')
      
      expect(statuses[2].health.status).toBe('critical')
      expect(statuses[2].position.formatted).toBe('X: -50, Y: 32, Z: 75')
    })

    it('should handle player state tracking workflow', async () => {
      const entityId = 'tracked-player'
      const playerData = {
        id: entityId,
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        inventory: []
      }
      
      // Initial state check
      mockQueryHandlers.getPlayerState.mockReturnValueOnce(Effect.succeed(playerData))
      let status = await runEffect(playerStatusViewModel.getPlayerStatus(entityId))
      expect(status.health.status).toBe('healthy')
      
      // Update local state
      await runEffect(playerStatusViewModel.updateLocalState(entityId))
      
      // Check state again with updated health
      const updatedPlayerData = { ...playerData, health: 8 }
      mockQueryHandlers.getPlayerState.mockReturnValueOnce(Effect.succeed(updatedPlayerData))
      status = await runEffect(playerStatusViewModel.getPlayerStatus(entityId))
      expect(status.health.status).toBe('injured')
    })

    it('should handle concurrent player status requests', async () => {
      const playerData = {
        id: 'concurrent-player',
        position: { x: 50, y: 100, z: -25 },
        health: 15,
        inventory: []
      }
      
      mockQueryHandlers.getPlayerState.mockReturnValue(Effect.succeed(playerData))

      const operations = [
        playerStatusViewModel.getPlayerStatus('concurrent-player'),
        playerStatusViewModel.getPlayerStatus('concurrent-player'),
        playerStatusViewModel.updateLocalState('concurrent-player')
      ]
      
      const results = await runEffect(Effect.all(operations))
      
      // First two results should be player statuses
      expect(results[0]).toHaveProperty('position')
      expect(results[0]).toHaveProperty('health')
      expect(results[1]).toHaveProperty('position')
      expect(results[1]).toHaveProperty('health')
      // Third result should be undefined (updateLocalState return)
      expect(results[2]).toBeUndefined()
    })
  })

  describe('Edge cases', () => {
    it('should handle negative health values', async () => {
      const playerData = {
        id: 'player-1',
        position: { x: 0, y: 0, z: 0 },
        health: -5,
        inventory: []
      }
      
      mockQueryHandlers.getPlayerState.mockReturnValueOnce(Effect.succeed(playerData))

      const status = await runEffect(playerStatusViewModel.getPlayerStatus('player-1'))
      
      expect(status.health).toEqual({
        current: -5,
        maximum: 20,
        percentage: -25,
        status: 'dead'
      })
    })

    it('should handle very large health values', async () => {
      const playerData = {
        id: 'player-1',
        position: { x: 0, y: 0, z: 0 },
        health: 1000,
        inventory: []
      }
      
      mockQueryHandlers.getPlayerState.mockReturnValueOnce(Effect.succeed(playerData))

      const status = await runEffect(playerStatusViewModel.getPlayerStatus('player-1'))
      
      expect(status.health).toEqual({
        current: 1000,
        maximum: 20,
        percentage: 5000,
        status: 'healthy'
      })
    })

    it('should handle extreme position coordinates', async () => {
      const playerData = {
        id: 'player-1',
        position: { x: Number.MAX_SAFE_INTEGER, y: -999999, z: 0.00001 },
        health: 20,
        inventory: []
      }
      
      mockQueryHandlers.getPlayerState.mockReturnValueOnce(Effect.succeed(playerData))

      const status = await runEffect(playerStatusViewModel.getPlayerStatus('player-1'))
      
      expect(status.position.x).toBe(Number.MAX_SAFE_INTEGER)
      expect(status.position.y).toBe(-999999)
      expect(status.position.z).toBe(0.00001)
      expect(status.position.formatted).toMatch(/X: \d+, Y: -999999, Z: 0/)
    })

    it('should handle special number values in positions', async () => {
      const testCases = [
        { x: NaN, y: 0, z: 0 },
        { x: 0, y: Infinity, z: 0 },
        { x: 0, y: 0, z: -Infinity }
      ]

      for (const position of testCases) {
        const playerData = {
          id: 'special-player',
          position,
          health: 20,
          inventory: []
        }
        
        mockQueryHandlers.getPlayerState.mockReturnValueOnce(Effect.succeed(playerData))
        
        const status = await runEffect(playerStatusViewModel.getPlayerStatus('special-player'))
        
        // Should handle special values gracefully
        expect(status.position).toBeDefined()
        expect(status.position.formatted).toBeDefined()
      }
    })
  })
})