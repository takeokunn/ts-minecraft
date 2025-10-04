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

  it.effect.prop('classify block types', [fc.option(fc.constantFrom(8, 9, 10, 11, 0))], ([block]) =>
    Effect.sync(() => {
      const kind = FluidState.classify(block ?? null)
      expect(['none', 'water', 'lava']).toContain(kind)
    })
  )
})
