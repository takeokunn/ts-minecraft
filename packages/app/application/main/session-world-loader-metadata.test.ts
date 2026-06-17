import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Option } from 'effect'
import { CURRENT_WORLD_SAVE_VERSION, type WorldMetadata } from '@ts-minecraft/world'

import { buildFreshWorldState, buildLoadedWorldBootstrap } from './session-world-loader-metadata'

describe('session-world-loader-metadata', () => {
  it('buildLoadedWorldBootstrap restores saved optional state and base spawn', () => {
    const playerState: NonNullable<WorldMetadata['playerState']> = {
      position: { x: 1, y: 64, z: 2 },
      health: 18,
      inventory: { slots: [] },
      timeOfDay: 0.25,
      hunger: { foodLevel: 20, saturation: 4 },
      totalXP: 12,
      equipment: {},
    }
    const metadata: WorldMetadata = {
      seed: 99,
      createdAt: new Date('2024-02-01'),
      lastPlayed: new Date('2024-02-02'),
      playerSpawn: { x: 8, y: 72, z: 16 },
      playerState,
      chestStates: [{ position: { x: 2, y: 64, z: 3 }, slots: [] }],
      furnaceStates: [{ position: { x: 4, y: 64, z: 5 }, input: Option.none(), fuel: Option.none(), output: Option.none(), activeRecipeId: Option.none(), progressSecs: 0 }],
      weatherState: { weather: 'rain', remainingSecs: 30 },
      gameMode: 'creative',
      saveVersion: CURRENT_WORLD_SAVE_VERSION,
    }

    const bootstrap = buildLoadedWorldBootstrap(metadata)

    expect(bootstrap.baseSpawnPosition).toEqual({ x: 8, y: 72, z: 16 })
    expect(Option.getOrThrow(bootstrap.savedPlayerState)).toEqual(playerState)
    expect(Option.getOrThrow(bootstrap.savedChestStates)).toEqual(metadata.chestStates)
    expect(Option.getOrThrow(bootstrap.savedFurnaceStates)).toEqual(metadata.furnaceStates)
    expect(Option.getOrThrow(bootstrap.savedWeatherState)).toEqual(metadata.weatherState)
    expect(bootstrap.gameMode).toBe('creative')
  })

  it('buildFreshWorldState creates consistent metadata and bootstrap defaults', () => {
    const createdAt = new Date('2024-03-03')
    const baseSpawnPosition = { x: 32, y: 100, z: -16 }

    const freshWorld = buildFreshWorldState({
      seed: 1234,
      createdAt,
      baseSpawnPosition,
      gameMode: 'survival',
    })

    expect(freshWorld.metadata).toEqual({
      seed: 1234,
      createdAt,
      lastPlayed: createdAt,
      playerSpawn: baseSpawnPosition,
      gameMode: 'survival',
      saveVersion: CURRENT_WORLD_SAVE_VERSION,
    })
    expect(freshWorld.bootstrap.seed).toBe(1234)
    expect(freshWorld.bootstrap.createdAt).toBe(createdAt)
    expect(freshWorld.bootstrap.baseSpawnPosition).toEqual(baseSpawnPosition)
    expect(Option.isNone(freshWorld.bootstrap.savedPlayerState)).toBe(true)
    expect(Option.isNone(freshWorld.bootstrap.savedChestStates)).toBe(true)
    expect(Option.isNone(freshWorld.bootstrap.savedFurnaceStates)).toBe(true)
    expect(Option.isNone(freshWorld.bootstrap.savedWeatherState)).toBe(true)
    expect(freshWorld.metadata.saveVersion).toBe(CURRENT_WORLD_SAVE_VERSION)
  })
})
