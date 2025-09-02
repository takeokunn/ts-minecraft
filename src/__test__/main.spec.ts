import { Effect, Layer } from 'effect'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as loop from '@/runtime/loop'
import * as systems from '@/systems'
import { WorldLive } from '@/runtime/world'
import { GameStateService, DeltaTime } from '@/runtime/services'
import { Hotbar } from '@/domain/components'

// Mock all systems
vi.mock('@/systems', async (importOriginal) => {
  const original = await importOriginal<typeof systems>()
  return {
    ...original,
    inputPollingSystem: Effect.void,
    cameraControlSystem: Effect.void,
    playerMovementSystem: Effect.void,
    physicsSystem: Effect.void,
    updatePhysicsWorldSystem: Effect.void,
    collisionSystem: Effect.void,
    raycastSystem: Effect.void,
    updateTargetSystem: Effect.void,
    blockInteractionSystem: Effect.void,
    chunkLoadingSystem: Effect.void,
    worldUpdateSystem: Effect.void,
    createUISystem: () => Effect.void,
  }
})

// Mock the game loop
const gameLoopSpy = vi.spyOn(loop, 'gameLoop')

// Dynamically import main to get the un-exported 'main' effect
async function getMainEffect() {
  const mainModule = await import('@/main')
  return (mainModule as any).main
}

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    gameLoopSpy.mockImplementation(() => Effect.void)
  })

  it.skip('should initialize and run systems in the correct order', async () => {
    const mainEffect = await getMainEffect()

    // Provide a minimal layer for the main effect to run
    const GameStateLive = Layer.succeed(GameStateService, {
      hotbar: new Hotbar({ slots: [], selectedIndex: 0 }),
    })
    const DeltaTimeLive = Layer.succeed(DeltaTime, 0)
    const TestLayer = Layer.mergeAll(WorldLive, GameStateLive, DeltaTimeLive)

    await Effect.runPromise(mainEffect.pipe(Effect.provide(TestLayer)))

    expect(gameLoopSpy).toHaveBeenCalledOnce()

    const systemsPassedToGameLoop = gameLoopSpy.mock.calls[0]![0]
    const systemNames = systemsPassedToGameLoop.map((s: any) => {
      if (s === systems.inputPollingSystem) return 'inputPollingSystem'
      if (s === systems.cameraControlSystem) return 'cameraControlSystem'
      if (s === systems.playerMovementSystem) return 'playerMovementSystem'
      if (s === systems.physicsSystem) return 'physicsSystem'
      if (s === systems.updatePhysicsWorldSystem) return 'updatePhysicsWorldSystem'
      if (s === systems.collisionSystem) return 'collisionSystem'
      if (s === systems.raycastSystem) return 'raycastSystem'
      if (s === systems.updateTargetSystem) return 'updateTargetSystem'
      if (s === systems.blockInteractionSystem) return 'blockInteractionSystem'
      if (s === systems.chunkLoadingSystem) return 'chunkLoadingSystem'
      if (s === systems.worldUpdateSystem) return 'worldUpdateSystem'
      return 'uiSystem'
    })

    const expectedOrder = [
      'inputPollingSystem',
      'cameraControlSystem',
      'playerMovementSystem',
      'physicsSystem',
      'updatePhysicsWorldSystem',
      'collisionSystem',
      'raycastSystem',
      'updateTargetSystem',
      'blockInteractionSystem',
      'chunkLoadingSystem',
      'worldUpdateSystem',
      'uiSystem',
    ]

    expect(systemNames).toEqual(expectedOrder)
  })
})
