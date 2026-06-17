import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Option } from 'effect'
import { CURRENT_WORLD_SAVE_VERSION } from '@ts-minecraft/world'

import { DEFAULT_BASE_SPAWN_POSITION, resolveSessionStartPositions } from './session-world-loader-state'
import { buildLoadedWorldBootstrap } from './session-world-loader-metadata'

describe('session-world-loader-state', () => {
  it('exposes the default base spawn position used for absent metadata', () => {
    expect(DEFAULT_BASE_SPAWN_POSITION).toEqual({ x: 0, y: 100, z: 0 })
  })

  it('resolves initial session positions from saved state when present', () => {
    const worldBootstrap = buildLoadedWorldBootstrap({
      seed: 7,
      createdAt: new Date('2024-04-04'),
      lastPlayed: new Date('2024-04-05'),
      playerSpawn: { x: 10, y: 70, z: -4 },
      playerState: {
        position: { x: 11, y: 71, z: -3 },
        health: 20,
        inventory: { slots: [] },
        timeOfDay: 0.5,
        hunger: { foodLevel: 20, saturation: 5 },
        totalXP: 0,
        equipment: {},
        respawnPosition: { x: 12, y: 72, z: -2 },
      },
      chestStates: [],
      furnaceStates: [],
      weatherState: null,
      gameMode: 'survival',
      saveVersion: CURRENT_WORLD_SAVE_VERSION,
    })

    const positions = resolveSessionStartPositions(worldBootstrap, { x: 99, y: 88, z: 77 })

    expect(positions.initialChunkLoadAnchor).toEqual({ x: 11, y: 71, z: -3 })
    expect(positions.spawnPosition).toEqual({ x: 11, y: 71, z: -3 })
    expect(positions.respawnPosition).toEqual({ x: 12, y: 72, z: -2 })
  })
})
