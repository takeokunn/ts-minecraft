import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { resolveAirMeterFeedback, syncAirMeterFeedback } from './environment-feedback'

describe('physics-stage-survival/environment-feedback', () => {
  it('resolves air meter feedback for full, partial, and empty air', () => {
    expect(resolveAirMeterFeedback(10)).toEqual({
      display: 'none',
      textContent: null,
    })
    expect(resolveAirMeterFeedback(3)).toEqual({
      display: 'block',
      textContent: '🫧🫧🫧',
    })
    expect(resolveAirMeterFeedback(0)).toEqual({
      display: 'block',
      textContent: '💀 Drowning',
    })
  })

  it('syncs air meter feedback without clearing text when hidden', async () => {
    const airElement = { style: { display: 'block' }, textContent: 'before' } as unknown as HTMLElement

    await Effect.runPromise(syncAirMeterFeedback(airElement, 10))

    expect(airElement.style.display).toBe('none')
    expect(airElement.textContent).toBe('before')
  })
})
