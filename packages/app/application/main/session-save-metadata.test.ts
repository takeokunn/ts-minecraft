import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Option } from 'effect'
import { CURRENT_WORLD_SAVE_VERSION } from '@ts-minecraft/world'

import { buildSessionSaveMetadata } from './session-save-metadata'

describe('buildSessionSaveMetadata', () => {
  it('assembles a complete WorldMetadata payload and sets the current save version', () => {
    const metadata = buildSessionSaveMetadata({
      worldBootstrap: {
        seed: 987654,
        createdAt: new Date('2024-02-01T00:00:00.000Z'),
        baseSpawnPosition: { x: 128, y: 96, z: -32 },
      },
      lastPlayed: new Date('2024-02-02T12:34:56.000Z'),
      playerState: {
        position: { x: 10, y: 65, z: 20 },
        health: 17,
        inventory: {
          slots: [
            Option.some({ slot: 0, itemType: 'WOOD', count: 3, durability: null }),
            Option.none(),
          ],
        },
        timeOfDay: 0.25,
        hunger: { foodLevel: 14, saturation: 2.5 },
        totalXP: 42,
        equipment: {},
        respawnPosition: { x: 100, y: 70, z: -40 },
        cropAges: { '1,64,1': 2 },
      },
      chestStates: [
        {
          position: { x: 5, y: 64, z: 5 },
          slots: [
            Option.none(),
            Option.some({ itemType: 'STONE', count: 16, durability: null }),
          ],
        },
      ],
      furnaceStates: [
        {
          position: { x: 8, y: 64, z: 8 },
          input: Option.some({ itemType: 'RAW_IRON', count: 1 }),
          fuel: Option.some({ itemType: 'COAL', count: 1 }),
          output: Option.none(),
          activeRecipeId: Option.none(),
          progressSecs: 4,
          burnRemainingSecs: 8,
          burnTotalSecs: 12,
        },
      ],
      weatherState: { weather: 'rain', remainingSecs: 600 },
      gameMode: 'creative',
    })

    expect(metadata).toEqual({
      seed: 987654,
      createdAt: new Date('2024-02-01T00:00:00.000Z'),
      lastPlayed: new Date('2024-02-02T12:34:56.000Z'),
      playerSpawn: { x: 128, y: 96, z: -32 },
      playerState: {
        position: { x: 10, y: 65, z: 20 },
        health: 17,
        inventory: {
          slots: [
            Option.some({ slot: 0, itemType: 'WOOD', count: 3, durability: null }),
            Option.none(),
          ],
        },
        timeOfDay: 0.25,
        hunger: { foodLevel: 14, saturation: 2.5 },
        totalXP: 42,
        equipment: {},
        respawnPosition: { x: 100, y: 70, z: -40 },
        cropAges: { '1,64,1': 2 },
      },
      chestStates: [
        {
          position: { x: 5, y: 64, z: 5 },
          slots: [
            Option.none(),
            Option.some({ itemType: 'STONE', count: 16, durability: null }),
          ],
        },
      ],
      furnaceStates: [
        {
          position: { x: 8, y: 64, z: 8 },
          input: Option.some({ itemType: 'RAW_IRON', count: 1 }),
          fuel: Option.some({ itemType: 'COAL', count: 1 }),
          output: Option.none(),
          activeRecipeId: Option.none(),
          progressSecs: 4,
          burnRemainingSecs: 8,
          burnTotalSecs: 12,
        },
      ],
      weatherState: { weather: 'rain', remainingSecs: 600 },
      gameMode: 'creative',
      saveVersion: CURRENT_WORLD_SAVE_VERSION,
    })
  })
})
