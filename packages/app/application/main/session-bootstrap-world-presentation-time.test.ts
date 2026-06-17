import { describe, it } from '@effect/vitest'
import { Effect } from 'effect'
import { expect, vi } from 'vitest'

import { initializeSessionBootstrapWorldPresentationTime } from '@ts-minecraft/app/main/session-bootstrap-world-presentation-time'

describe('initializeSessionBootstrapWorldPresentationTime', () => {
  it('applies the boot day length and time of day', async () => {
    const setDayLength = vi.fn(() => Effect.succeed(undefined))
    const setTimeOfDay = vi.fn(() => Effect.succeed(undefined))

    await Effect.runPromise(initializeSessionBootstrapWorldPresentationTime({
      initialSettings: { dayLengthSeconds: 900 },
      timeService: { setDayLength, setTimeOfDay } as never,
    }))

    expect(setDayLength).toHaveBeenCalledOnce()
    expect(setDayLength).toHaveBeenCalledWith(900)
    expect(setTimeOfDay).toHaveBeenCalledOnce()
    expect(setTimeOfDay).toHaveBeenCalledWith(0.5)
  })
})
