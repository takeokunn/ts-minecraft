import { describe, expect, it } from 'vitest'

import { resolveMaintenanceContext } from './frame-maintenance-context'

describe('resolveMaintenanceContext', () => {
  it('disables mob spawning on peaceful difficulty', () => {
    expect(
      resolveMaintenanceContext({
        playerPos: { x: 33, y: 64, z: 65 },
        difficulty: 'peaceful',
        debugFlags: {
          'mobs.enabled': true,
          'mobs.spawn': true,
          'simulation.furnace': true,
          'simulation.village': false,
          'world.chunkStreaming': true,
          'world.chunkSceneSync': true,
          'world.dirtyChunkFlush': true,
        },
      }),
    ).toEqual({
      mobsEnabled: true,
      mobsSpawnEnabled: false,
      furnaceEnabled: true,
      villageEnabled: false,
      chunkStreamingEnabled: true,
      chunkSceneSyncEnabled: true,
      dirtyChunkFlushEnabled: true,
      cx: 2,
      cz: 4,
    })
  })

  it('floors negative chunk coordinates', () => {
    expect(
      resolveMaintenanceContext({
        playerPos: { x: -1, y: 64, z: -1 },
        difficulty: 'normal',
        debugFlags: {
          'mobs.enabled': false,
          'mobs.spawn': false,
          'simulation.furnace': false,
          'simulation.village': false,
          'world.chunkStreaming': false,
          'world.chunkSceneSync': false,
          'world.dirtyChunkFlush': false,
        },
      }),
    ).toMatchObject({ cx: -1, cz: -1 })
  })

  it('requires chunk scene sync before dirty chunk flush', () => {
    expect(
      resolveMaintenanceContext({
        playerPos: { x: 0, y: 64, z: 0 },
        difficulty: 'normal',
        debugFlags: {
          'mobs.enabled': false,
          'mobs.spawn': false,
          'simulation.furnace': false,
          'simulation.village': false,
          'world.chunkStreaming': false,
          'world.chunkSceneSync': true,
          'world.dirtyChunkFlush': false,
        },
      }),
    ).toMatchObject({
      chunkSceneSyncEnabled: true,
      dirtyChunkFlushEnabled: false,
    })
  })
})
