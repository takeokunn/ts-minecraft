import { describe, expect, it } from '@effect/vitest'
import { Option } from 'effect'
import { DeltaTimeSecs, RecipeId } from '@ts-minecraft/core'

import { advanceFurnaceSmeltingProgress } from '../domain/furnace-smelting'
import { emptyFurnaceAtPosition } from '../domain/furnace-service-utils'
import type { FurnaceBlockState } from '../domain/furnace-state'

const makeActiveFurnace = (overrides: Partial<FurnaceBlockState> = {}): FurnaceBlockState => ({
  ...emptyFurnaceAtPosition({ x: 0, y: 64, z: 0 }),
  input: Option.some({ itemType: 'RAW_IRON', count: 1 }),
  fuel: Option.some({ itemType: 'COAL', count: 1 }),
  activeRecipeId: Option.some(RecipeId.make('raw-iron-to-iron-ingot')),
  burnRemainingSecs: 80,
  burnTotalSecs: 80,
  ...overrides,
})

describe('domain/furnace-smelting', () => {
  it('returns the furnace unchanged when no recipe is active', () => {
    const furnace = emptyFurnaceAtPosition({ x: 0, y: 64, z: 0 })

    const result = advanceFurnaceSmeltingProgress(
      furnace,
      DeltaTimeSecs.make(3),
      80,
      { itemType: 'IRON_INGOT', count: 1 },
    )

    expect(result.furnace).toEqual(furnace)
    expect(result.remainingDeltaSecs).toBe(3)
  })

  it('preserves incomplete progress and remaining fuel', () => {
    const furnace = makeActiveFurnace({
      progressSecs: 1,
      burnRemainingSecs: 0.5,
    })

    const result = advanceFurnaceSmeltingProgress(
      furnace,
      DeltaTimeSecs.make(0.25),
      80,
      { itemType: 'IRON_INGOT', count: 1 },
    )

    expect(result.remainingDeltaSecs).toBe(0)
    expect(result.furnace.progressSecs).toBe(1.25)
    expect(result.furnace.burnRemainingSecs).toBe(0.25)
    expect(Option.getOrThrow(result.furnace.fuel).itemType).toBe('COAL')
    expect(Option.getOrThrow(result.furnace.input).itemType).toBe('RAW_IRON')
    expect(Option.isSome(result.furnace.activeRecipeId)).toBe(true)
    expect(Option.isNone(result.furnace.output)).toBe(true)
  })

  it('completes the smelt and clears the transient slots', () => {
    const furnace = makeActiveFurnace({
      progressSecs: 79.5,
      burnRemainingSecs: 0.5,
    })

    const result = advanceFurnaceSmeltingProgress(
      furnace,
      DeltaTimeSecs.make(1),
      80,
      { itemType: 'IRON_INGOT', count: 1 },
    )

    expect(result.remainingDeltaSecs).toBe(0.5)
    expect(result.furnace.progressSecs).toBe(80)
    expect(result.furnace.burnRemainingSecs).toBe(0)
    expect(Option.isNone(result.furnace.input)).toBe(true)
    expect(Option.isNone(result.furnace.fuel)).toBe(true)
    expect(Option.isSome(result.furnace.output)).toBe(true)
    expect(Option.isNone(result.furnace.activeRecipeId)).toBe(true)
  })
})
