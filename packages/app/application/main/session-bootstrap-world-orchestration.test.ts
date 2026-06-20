import { beforeEach, describe, it } from '@effect/vitest'
import { Effect, MutableRef } from 'effect'
import { expect, vi } from 'vitest'

import { buildSessionBootstrapWorldOrchestration } from './session-bootstrap-world-orchestration'
import { buildPersistSessionState } from '@ts-minecraft/app/main/session-persist'
import { buildSessionBootstrapWorldState } from '@ts-minecraft/app/main/session-bootstrap-world-state'
import { initializeSessionBootstrapWorldPresentation } from '@ts-minecraft/app/main/session-bootstrap-world-presentation'
import { prepareInitialTerrain } from '@ts-minecraft/app/main/session-loading-gates-terrain'

vi.mock('@ts-minecraft/app/main/session-persist', () => ({
  buildPersistSessionState: vi.fn(),
}))

vi.mock('@ts-minecraft/app/main/session-bootstrap-world-state', () => ({
  buildSessionBootstrapWorldState: vi.fn(),
}))

vi.mock('@ts-minecraft/app/main/session-bootstrap-world-presentation', () => ({
  initializeSessionBootstrapWorldPresentation: vi.fn(() => Effect.void),
}))

vi.mock('@ts-minecraft/app/main/session-loading-gates-terrain', () => ({
  prepareInitialTerrain: vi.fn(() => Effect.void),
}))

describe('buildSessionBootstrapWorldOrchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('preserves the bootstrap sequence and returns the persistence hook', async () => {
    const callOrder: string[] = []
    const persistSessionState = vi.fn()
    const respawnPositionRef = MutableRef.make({ x: 1, y: 2, z: 3 })
    const worldBootstrap = { baseSpawnPosition: { x: 4, y: 5, z: 6 } } as never
    const initialSpawnSelection = { position: { x: 7, y: 8, z: 9 } } as never
    const initialChunkLoadAnchor = { x: 10, y: 11, z: 12 }
    const spawnPosition = { x: 13, y: 14, z: 15 }
    const gameModeService = {
      set: vi.fn(() => {
        callOrder.push('game-mode')
        return Effect.void
      }),
    } as never
    const chunkManagerService = {
      setActiveWorldId: vi.fn(() => {
        callOrder.push('active-world')
        return Effect.void
      }),
    } as never
    const deps = {
      state: {
        bootCtx: {
          storageService: {} as never,
          noiseService: {} as never,
        },
        worldId: 'world-1' as never,
        initialGameMode: 'survival' as never,
        chunkManagerService,
        gameModeService,
      },
      terrain: {
        bootCtx: {
          terrainPool: { queueDepth: () => 0 } as never,
        },
        loadingScreen: {} as never,
        scene: {} as never,
        canvas: {} as HTMLCanvasElement,
        initialSettings: {
          renderDistance: 8,
          dayLengthSeconds: 1200,
        },
        worldRendererService: {} as never,
      },
      presentation: {
        gameState: {} as never,
        playerCameraState: {} as never,
        particleSystem: {} as never,
        blockHighlight: {} as never,
        hotbarRenderer: {} as never,
        crosshair: {} as never,
        timeService: {} as never,
        inventoryService: {} as never,
        equipmentService: {} as never,
        healthService: {} as never,
        hungerService: {} as never,
        xpService: {} as never,
        chestService: {} as never,
        furnaceService: {} as never,
        weatherService: {} as never,
        cropGrowthService: {} as never,
      },
    } satisfies Parameters<typeof buildSessionBootstrapWorldOrchestration>[0]

    vi.mocked(buildSessionBootstrapWorldState).mockImplementation(() => {
      callOrder.push('world-state')
      return Effect.succeed({
        worldBootstrap,
        initialSpawnSelection,
        initialChunkLoadAnchor,
        respawnPositionRef,
        spawnPosition,
      })
    })
    vi.mocked(buildPersistSessionState).mockImplementation(() => {
      callOrder.push('persist-factory')
      return persistSessionState
    })
    vi.mocked(prepareInitialTerrain).mockImplementation(() => {
      callOrder.push('terrain')
      return Effect.void
    })
    vi.mocked(initializeSessionBootstrapWorldPresentation).mockImplementation(() => {
      callOrder.push('presentation')
      return Effect.void
    })

    const result = await Effect.runPromise(buildSessionBootstrapWorldOrchestration(deps))

    expect(callOrder).toEqual([
      'game-mode',
      'world-state',
      'active-world',
      'terrain',
      'persist-factory',
      'presentation',
    ])
    expect(buildSessionBootstrapWorldState).toHaveBeenCalledWith(expect.objectContaining({
      worldId: 'world-1',
      initialGameMode: 'survival',
      chunkManagerService,
      gameModeService,
    }))
    expect(prepareInitialTerrain).toHaveBeenCalledOnce()
    expect(initializeSessionBootstrapWorldPresentation).toHaveBeenCalledOnce()
    expect(result).toEqual({
      respawnPositionRef,
      persistSessionState,
    })
  })
})
