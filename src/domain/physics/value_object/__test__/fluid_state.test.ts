import { it } from '@effect/vitest'
import { Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import { describe, expect } from 'vitest'
import { FluidState } from '../fluid_state'

const waterBlocks = { headBlock: 8, feetBlock: 8, headLevel: 1, feetLevel: 1 }

describe('FluidState', () => {
  it.effect('detects water immersion', () =>
    Effect.map(FluidState.calculate(waterBlocks), (state) => {
      expect(state.kind).toBe('water')
      expect(FluidState.isInFluid(state)).toBe(true)
    })
  )

  // TODO: プロパティテストの高速化後にskipを解除する
  it.effect.skip('classify block types', () => Effect.unit)
})
