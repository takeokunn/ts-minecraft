import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Option } from 'effect'

import { buildSessionRestorePlayerState } from './session-restore-player-state'

describe('buildSessionRestorePlayerState', () => {
  it('passes through canonical saved values and normalizes equipment slots', () => {
    const restored = buildSessionRestorePlayerState({
      inventory: {
        slots: [
          Option.some({ slot: 0, itemType: 'WOOD', count: 4, durability: null }),
          Option.none(),
        ],
      },
      health: 16,
      hunger: { foodLevel: 8, saturation: 2.5 },
      totalXP: 42,
      equipment: {
        CHESTPLATE: 'IRON_CHESTPLATE',
      },
      cropAges: { '1,64,1': 3 },
    })

    expect(restored).toEqual({
      inventory: {
        slots: [
          Option.some({ slot: 0, itemType: 'WOOD', count: 4, durability: null }),
          Option.none(),
        ],
      },
      health: 16,
      hunger: { foodLevel: 8, saturation: 2.5 },
      totalXP: 42,
      equipment: {
        HELMET: null,
        CHESTPLATE: 'IRON_CHESTPLATE',
        LEGGINGS: null,
        BOOTS: null,
      },
      cropAges: { '1,64,1': 3 },
    })
  })
})
