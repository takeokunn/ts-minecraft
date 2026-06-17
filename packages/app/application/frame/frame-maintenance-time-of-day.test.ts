import { Effect } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { resolveMaintenanceTimeOfDay } from './frame-maintenance-time-of-day'

describe('resolveMaintenanceTimeOfDay', () => {
  it('returns the idle fallback when no time-of-day lookup is needed', async () => {
    const getTimeOfDay = vi.fn(() => Effect.succeed(0.9))

    const result = await Effect.runPromise(
      resolveMaintenanceTimeOfDay({ getTimeOfDay }, false),
    )

    expect(result).toBe(0.5)
    expect(getTimeOfDay).not.toHaveBeenCalled()
  })

  it('returns the world time when the lookup succeeds', async () => {
    const getTimeOfDay = vi.fn(() => Effect.succeed(0.75))

    const result = await Effect.runPromise(
      resolveMaintenanceTimeOfDay({ getTimeOfDay }, true),
    )

    expect(result).toBe(0.75)
    expect(getTimeOfDay).toHaveBeenCalledOnce()
  })

  it('falls back to 0.5 when the time-of-day lookup fails', async () => {
    const getTimeOfDay = vi.fn(() => Effect.fail(new Error('boom')))

    const result = await Effect.runPromise(
      resolveMaintenanceTimeOfDay({ getTimeOfDay }, true),
    )

    expect(result).toBe(0.5)
    expect(getTimeOfDay).toHaveBeenCalledOnce()
  })
})
