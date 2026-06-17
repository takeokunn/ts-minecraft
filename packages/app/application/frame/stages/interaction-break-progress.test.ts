import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'

import { advanceBreakProgress } from './interaction-break-progress'

describe('interaction-break-progress', () => {
  it('starts progress from zero when there is no current state', () => {
    expect(
      advanceBreakProgress({
        current: null,
        blockKey: '1,64,2',
        breakTicks: 10,
      }),
    ).toEqual({
      nextProgress: {
        blockKey: '1,64,2',
        ticks: 1,
        totalTicks: 10,
      },
      shouldBreak: false,
    })
  })

  it('continues the current block progress when the block key matches', () => {
    expect(
      advanceBreakProgress({
        current: {
          blockKey: '1,64,2',
          ticks: 3,
          totalTicks: 10,
        },
        blockKey: '1,64,2',
        breakTicks: 10,
      }),
    ).toEqual({
      nextProgress: {
        blockKey: '1,64,2',
        ticks: 4,
        totalTicks: 10,
      },
      shouldBreak: false,
    })
  })

  it('completes the break when the next tick reaches the threshold', () => {
    expect(
      advanceBreakProgress({
        current: {
          blockKey: '1,64,2',
          ticks: 9,
          totalTicks: 10,
        },
        blockKey: '1,64,2',
        breakTicks: 10,
      }),
    ).toEqual({
      nextProgress: null,
      shouldBreak: true,
    })
  })

  it('completes the break immediately when the block has zero break ticks', () => {
    expect(
      advanceBreakProgress({
        current: {
          blockKey: '1,64,2',
          ticks: 7,
          totalTicks: 10,
        },
        blockKey: '1,64,2',
        breakTicks: 0,
      }),
    ).toEqual({
      nextProgress: null,
      shouldBreak: true,
    })
  })
})
