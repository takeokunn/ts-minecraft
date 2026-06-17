import { Effect, MutableRef } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { applyCadencedHazard } from './hazard-logic'

describe('physics-stage-survival/hazard-logic', () => {
  it('resets the accumulator when the hazard is inactive', async () => {
    const accumulatorRef = MutableRef.make(0.6)
    const onTicks = vi.fn(() => Effect.void)

    await Effect.runPromise(
      applyCadencedHazard({
        active: false,
        accumulatorRef,
        deltaTime: 0.5,
        intervalSecs: 1,
        onTicks,
      }),
    )

    expect(MutableRef.get(accumulatorRef)).toBe(0)
    expect(onTicks).not.toHaveBeenCalled()
  })

  it('passes emitted ticks to the callback and updates the accumulator', async () => {
    const accumulatorRef = MutableRef.make(0.6)
    const onTicks = vi.fn(() => Effect.void)

    await Effect.runPromise(
      applyCadencedHazard({
        active: true,
        accumulatorRef,
        deltaTime: 0.5,
        intervalSecs: 1,
        onTicks,
      }),
    )

    expect(MutableRef.get(accumulatorRef)).toBeCloseTo(0.1)
    expect(onTicks).toHaveBeenCalledWith(1)
  })
})
