import { beforeEach, describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, Option } from 'effect'

import { type GameStateService } from '@ts-minecraft/game'
import { initializeSessionBootstrapWorldPresentationState } from './session-bootstrap-world-presentation-state'
import { restoreSavedState } from '@ts-minecraft/app/main/session-restore'

vi.mock('@ts-minecraft/app/main/session-restore', () => ({
  restoreSavedState: vi.fn(() => Effect.succeed(undefined) as Effect.Effect<void, never, never>),
}))

describe('initializeSessionBootstrapWorldPresentationState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes the live presentation state for a fresh world', async () => {
    const worldBootstrap = { savedPlayerState: Option.none() } as never
    const initialSpawnSelection = { yaw: 90 } as never
    const spawnPosition = { x: 10, y: 64, z: 10 }
    const noopEffect = Effect.succeed(undefined) as Effect.Effect<void, never, never>

    const gameState: Pick<GameStateService, 'initialize'> = {
      initialize: vi.fn((): Effect.Effect<void, never, never> => noopEffect),
    }
    const playerCameraState = { setYaw: vi.fn(() => noopEffect), setPitch: vi.fn(() => noopEffect) }
    const timeService = { setDayLength: vi.fn(() => noopEffect), setTimeOfDay: vi.fn(() => noopEffect) }

    await Effect.runPromise(Effect.scoped(initializeSessionBootstrapWorldPresentationState({
      worldBootstrap,
      initialSpawnSelection,
      initialSettings: { dayLengthSeconds: 900 },
      gameState: gameState as never,
      playerCameraState: playerCameraState as never,
      timeService: timeService as never,
      inventoryService: {} as never,
      equipmentService: {} as never,
      healthService: {} as never,
      hungerService: {} as never,
      xpService: {} as never,
      chestService: {} as never,
      furnaceService: {} as never,
      weatherService: {} as never,
      cropGrowthService: {} as never,
      spawnPosition,
    })))

    expect(gameState.initialize).toHaveBeenCalledWith(spawnPosition)
    expect(playerCameraState.setYaw).toHaveBeenCalledWith(90)
    expect(playerCameraState.setPitch).toHaveBeenCalledWith(0)
    expect(restoreSavedState).toHaveBeenCalledOnce()
    expect(timeService.setDayLength).toHaveBeenCalledWith(900)
    expect(timeService.setTimeOfDay).toHaveBeenCalledWith(0.5)
  })

  it('does not reset the camera when a saved player state exists', async () => {
    const worldBootstrap = { savedPlayerState: Option.some({} as never) } as never
    const initialSpawnSelection = { yaw: 45 } as never
    const spawnPosition = { x: 1, y: 2, z: 3 }
    const noopEffect = Effect.succeed(undefined) as Effect.Effect<void, never, never>

    const gameState: Pick<GameStateService, 'initialize'> = {
      initialize: vi.fn((): Effect.Effect<void, never, never> => noopEffect),
    }
    const playerCameraState = { setYaw: vi.fn(() => noopEffect), setPitch: vi.fn(() => noopEffect) }
    const timeService = { setDayLength: vi.fn(() => noopEffect), setTimeOfDay: vi.fn(() => noopEffect) }

    await Effect.runPromise(Effect.scoped(initializeSessionBootstrapWorldPresentationState({
      worldBootstrap,
      initialSpawnSelection,
      initialSettings: { dayLengthSeconds: 600 },
      gameState: gameState as never,
      playerCameraState: playerCameraState as never,
      timeService: timeService as never,
      inventoryService: {} as never,
      equipmentService: {} as never,
      healthService: {} as never,
      hungerService: {} as never,
      xpService: {} as never,
      chestService: {} as never,
      furnaceService: {} as never,
      weatherService: {} as never,
      cropGrowthService: {} as never,
      spawnPosition,
    })))

    expect(gameState.initialize).toHaveBeenCalledWith(spawnPosition)
    expect(playerCameraState.setYaw).not.toHaveBeenCalled()
    expect(playerCameraState.setPitch).not.toHaveBeenCalled()
    expect(restoreSavedState).toHaveBeenCalledOnce()
    expect(timeService.setDayLength).toHaveBeenCalledWith(600)
    expect(timeService.setTimeOfDay).toHaveBeenCalledWith(0.5)
  })
})
