import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Option } from 'effect'

import { buildSessionSavePlayerState } from './session-save-player-state'

describe('buildSessionSavePlayerState', () => {
  it('omits null equipment slots while preserving the rest of the player state', () => {
    const playerState = buildSessionSavePlayerState({
      position: { x: 12, y: 70, z: -3 },
      health: 18,
      inventory: {
        slots: [
          Option.some({ slot: 0, itemType: 'WOOD', count: 3, durability: null }),
          Option.none(),
        ],
      },
      timeOfDay: 0.875,
      hunger: { foodLevel: 15, saturation: 5.5 },
      totalXP: 128,
      equipment: {
        HELMET: null,
        CHESTPLATE: 'IRON_CHESTPLATE',
        LEGGINGS: null,
        BOOTS: 'IRON_BOOTS',
      },
      respawnPosition: { x: 100, y: 64, z: 100 },
      cropAges: { '1,64,1': 2 },
    })

    expect(playerState).toEqual({
      position: { x: 12, y: 70, z: -3 },
      health: 18,
      inventory: {
        slots: [
          Option.some({ slot: 0, itemType: 'WOOD', count: 3, durability: null }),
          Option.none(),
        ],
      },
      timeOfDay: 0.875,
      hunger: { foodLevel: 15, saturation: 5.5 },
      totalXP: 128,
      equipment: {
        CHESTPLATE: 'IRON_CHESTPLATE',
        BOOTS: 'IRON_BOOTS',
      },
      respawnPosition: { x: 100, y: 64, z: 100 },
      cropAges: { '1,64,1': 2 },
    })
  })
})
