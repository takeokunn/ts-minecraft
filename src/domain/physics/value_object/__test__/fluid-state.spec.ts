import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { describe, expect } from 'vitest'
import { FluidState } from '../fluid-state'

const waterBlocks = { headBlock: 8, feetBlock: 8, headLevel: 1, feetLevel: 1 }

const run = <A>(program: Effect.Effect<A>) => Effect.runPromise(program)
const runExit = <A>(program: Effect.Effect<A, unknown>) => Effect.runPromiseExit(program)

describe('FluidState', () => {
  it.effect('detects water immersion', () =>
    Effect.map(FluidState.calculate(waterBlocks), (state) => {
      expect(state.kind).toBe('water')
      expect(FluidState.isInFluid(state)).toBe(true)
    })
  )

  it('classifies block ids into fluid kinds', () => {
    expect(FluidState.classify(null)).toBe('none')
    expect(FluidState.classify(0)).toBe('none')
    expect(FluidState.classify(8)).toBe('water')
    expect(FluidState.classify(9)).toBe('water')
    expect(FluidState.classify(10)).toBe('lava')
    expect(FluidState.classify(11)).toBe('lava')
    expect(FluidState.classify(12)).toBe('none')
  })

  it('blends head and feet fluid states', async () => {
    const state = await run(FluidState.blend('water', 'none', 0.6, 0.3))
    expect(state.kind).toBe('water')
    expect(state.immersion).toBeCloseTo(0.6)
    expect(state.resistance).toBeCloseTo(1)
    expect(state.buoyancy).toBeGreaterThan(0)
  })

  it('calculate uses highest immersion level', async () => {
    const state = await run(
      FluidState.calculate({ headBlock: 8, feetBlock: null, headLevel: 0.4, feetLevel: 0.2 })
    )
    expect(state.immersion).toBeCloseTo(0.4)
    expect(state.kind).toBe('water')
  })

  it('applyResistance attenuates velocity and adds buoyancy', async () => {
    const fluid = FluidState.presets.water
    const exit = await runExit(
      FluidState.applyResistance(fluid, { x: 2, y: -1, z: 0 })
    )
    expect(exit._tag).toBe('Success')
    if (exit._tag === 'Success') {
      const result = exit.value
      expect(result.x).toBeCloseTo(2 * fluid.resistance)
      expect(result.y).toBeCloseTo(-1 * fluid.resistance + fluid.buoyancy)
      expect(result.z).toBeCloseTo(0)
    }
  })
})
