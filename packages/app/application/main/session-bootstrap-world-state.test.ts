import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, MutableRef } from 'effect'

import { buildSessionBootstrapWorldState } from './session-bootstrap-world-state'
import { buildSpawnSelection, loadOrCreateWorld } from '@ts-minecraft/app/main/session-world-loader'
import { resolveSessionStartPositions } from '@ts-minecraft/app/main/session-world-loader-state'

vi.mock('@ts-minecraft/app/main/session-world-loader', () => ({
  buildSpawnSelection: vi.fn(),
  loadOrCreateWorld: vi.fn(),
}))

vi.mock('@ts-minecraft/app/main/session-world-loader-state', () => ({
  resolveSessionStartPositions: vi.fn(),
}))

describe('buildSessionBootstrapWorldState', () => {
  it('loads the world once and returns the derived start state', async () => {
    const storageService = {} as never
    const noiseService = {} as never
    const bootCtx = { storageService, noiseService }
    const chunkManagerService = {} as never
    const gameModeService = {} as never
    const worldBootstrap = { baseSpawnPosition: { x: 1, y: 2, z: 3 } } as never
    const initialSpawnSelection = { position: { x: 4, y: 5, z: 6 }, yaw: 135 } as never
    const resolved = {
      initialChunkLoadAnchor: { x: 7, y: 8, z: 9 },
      respawnPosition: { x: 10, y: 11, z: 12 },
      spawnPosition: { x: 13, y: 14, z: 15 },
    }

    vi.mocked(loadOrCreateWorld).mockReturnValue(Effect.succeed(worldBootstrap))
    vi.mocked(buildSpawnSelection).mockReturnValue(Effect.succeed(initialSpawnSelection))
    vi.mocked(resolveSessionStartPositions).mockReturnValue(resolved)

    const result = await Effect.runPromise(buildSessionBootstrapWorldState({
      bootCtx,
      worldId: 'world-1' as never,
      initialGameMode: 'survival' as never,
      chunkManagerService,
      gameModeService,
    }))

    expect(loadOrCreateWorld).toHaveBeenCalledWith('world-1', 'survival', storageService, noiseService, gameModeService)
    expect(buildSpawnSelection).toHaveBeenCalledWith(worldBootstrap.baseSpawnPosition, chunkManagerService)
    expect(resolveSessionStartPositions).toHaveBeenCalledWith(worldBootstrap, initialSpawnSelection.position)
    expect(MutableRef.get(result.respawnPositionRef)).toEqual(resolved.respawnPosition)
    expect(result).toMatchObject({
      worldBootstrap,
      initialSpawnSelection,
      initialChunkLoadAnchor: resolved.initialChunkLoadAnchor,
      spawnPosition: resolved.spawnPosition,
    })
  })
})
