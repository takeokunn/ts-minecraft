import { describe, expect, it } from 'vitest'
import { resolveFootstepState } from './footstep-logic'

describe('physics-stage-survival/footstep-logic', () => {
  it('accumulates movement until the interval is reached', () => {
    expect(
      resolveFootstepState({
        currentAccumulator: 0.2,
        distanceMoved: 0.3,
        isGrounded: true,
        isSneaking: false,
        hasFootstepEffect: true,
        intervalBlocks: 0.72,
      }),
    ).toEqual({
      nextAccumulator: 0.5,
      shouldPlay: false,
    })
  })

  it('wraps the accumulator and signals playback when stepping', () => {
    const state = resolveFootstepState({
      currentAccumulator: 0.4,
      distanceMoved: 0.4,
      isGrounded: true,
      isSneaking: false,
      hasFootstepEffect: true,
      intervalBlocks: 0.72,
    })

    expect(state.shouldPlay).toBe(true)
    expect(state.nextAccumulator).toBeCloseTo(0.08)
  })

  it('resets accumulation when the player cannot produce footstep sounds', () => {
    expect(
      resolveFootstepState({
        currentAccumulator: 0.6,
        distanceMoved: 0.4,
        isGrounded: false,
        isSneaking: false,
        hasFootstepEffect: true,
        intervalBlocks: 0.72,
      }),
    ).toEqual({
      nextAccumulator: 0,
      shouldPlay: false,
    })
  })
})
