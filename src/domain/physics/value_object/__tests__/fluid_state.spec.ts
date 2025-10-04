import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import { Vector3 } from '../../types/core'
import { FluidState } from '../fluid_state'

describe('FluidState', () => {
  it('create accepts valid parameters', () =>
    fc.assert(
      fc.property(
        fc.constantFrom('none', 'water', 'lava'),
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.float({ min: -1, max: 1, noNaN: true }),
        (kind, immersion, resistance, buoyancy) => {
          const result = Effect.runSync(
            FluidState.create({
              kind,
              immersion,
              resistance,
              buoyancy,
            })
          )
          expect(result.kind).toBe(kind)
          expect(result.immersion).toBe(immersion)
          expect(result.resistance).toBe(resistance)
          expect(result.buoyancy).toBe(buoyancy)
        }
      )
    ))

  it('calculate blends head and feet blocks', () =>
    fc.assert(
      fc.property(
        fc.constantFrom(0, 8, 9, 10, 11, null),
        fc.float({ min: 0, max: 1, noNaN: true }),
        (blockId, level) => {
          const result = Effect.runSync(
            FluidState.calculate({
              headBlock: blockId,
              feetBlock: blockId,
              headLevel: level,
              feetLevel: level,
            })
          )
          expect(result.immersion).toBe(level)
        }
      )
    ))

  it('applyResistance respects resistance and buoyancy', () =>
    fc.assert(
      fc.property(
        fc.constantFrom(FluidState.presets.none, FluidState.presets.water, FluidState.presets.lava),
        fc.record({
          x: fc.float({ min: -10, max: 10, noNaN: true }),
          y: fc.float({ min: -10, max: 10, noNaN: true }),
          z: fc.float({ min: -10, max: 10, noNaN: true }),
        }),
        (state, velocity) => {
          const result = Effect.runSync(FluidState.applyResistance(state, velocity as Vector3))
          expect(result.x).toBeCloseTo(velocity.x * state.resistance, 5)
          expect(result.y).toBeCloseTo(velocity.y * state.resistance + state.buoyancy, 5)
          expect(result.z).toBeCloseTo(velocity.z * state.resistance, 5)
        }
      )
    ))

  it('classify identifies fluid type by block ids', () => {
    expect(FluidState.classify(8)).toBe('water')
    expect(FluidState.classify(10)).toBe('lava')
    expect(FluidState.classify(null)).toBe('none')
    expect(FluidState.classify(1)).toBe('none')
  })

  it('isInFluid detects immersion state', () => {
    expect(FluidState.isInFluid(FluidState.presets.none)).toBe(false)
    expect(FluidState.isInFluid(FluidState.presets.water)).toBe(true)
  })

  it('isFullySubmerged checks immersion level', () => {
    expect(FluidState.isFullySubmerged(FluidState.presets.water)).toBe(true)
    expect(FluidState.isFullySubmerged(FluidState.presets.none)).toBe(false)
  })
})
