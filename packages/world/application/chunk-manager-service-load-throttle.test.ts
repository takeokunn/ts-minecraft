import { describe, expect, it } from 'vitest'
import { resolveChunkLoadThrottle } from './chunk-manager-service-load-throttle'

describe('chunk-manager-service-load-throttle', () => {
  it('keeps the previous timestamp when the load is still within the throttle window', () => {
    expect(resolveChunkLoadThrottle(1_199, 1_000)).toEqual([false, 1_000])
  })

  it('allows loading and advances the timestamp when the throttle window has elapsed', () => {
    expect(resolveChunkLoadThrottle(1_200, 1_000)).toEqual([true, 1_200])
  })
})
