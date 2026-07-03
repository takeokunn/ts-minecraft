import { describe, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { expect, vi } from 'vitest'

import { initializeSessionBootstrapWorldPresentationTime } from '@ts-minecraft/app/main/session-bootstrap-world-presentation-time'

describe('initializeSessionBootstrapWorldPresentationTime', () => {
  it('starts fresh worlds mid-morning (no saved time)', async () => {
    const setDayLength = vi.fn(() => Effect.succeed(undefined))
    const setTimeOfDay = vi.fn(() => Effect.succeed(undefined))

    await Effect.runPromise(initializeSessionBootstrapWorldPresentationTime({
      initialSettings: { dayLengthSeconds: 900 },
      timeService: { setDayLength, setTimeOfDay } as never,
      savedTimeOfDay: Option.none(),
    }))

    expect(setDayLength).toHaveBeenCalledOnce()
    expect(setDayLength).toHaveBeenCalledWith(900)
    expect(setTimeOfDay).toHaveBeenCalledOnce()
    expect(setTimeOfDay).toHaveBeenCalledWith(0.3)
  })

  it('restores the persisted time of day for saved worlds', async () => {
    const setDayLength = vi.fn(() => Effect.succeed(undefined))
    const setTimeOfDay = vi.fn(() => Effect.succeed(undefined))

    await Effect.runPromise(initializeSessionBootstrapWorldPresentationTime({
      initialSettings: { dayLengthSeconds: 900 },
      timeService: { setDayLength, setTimeOfDay } as never,
      savedTimeOfDay: Option.some(0.82),
    }))

    expect(setTimeOfDay).toHaveBeenCalledOnce()
    expect(setTimeOfDay).toHaveBeenCalledWith(0.82)
  })
})
