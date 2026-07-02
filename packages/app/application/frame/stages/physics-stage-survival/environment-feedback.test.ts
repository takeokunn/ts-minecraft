import { Effect } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  resolveAirMeterFeedback,
  syncAirMeterFeedback,
  syncUnderwaterScreenTintFeedback,
  UNDERWATER_SCREEN_TINT_CLASS,
} from './environment-feedback'

afterEach(() => {
  vi.unstubAllGlobals()
})

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

  it('syncs underwater screen tint class on the document body', async () => {
    const toggle = vi.fn()
    vi.stubGlobal('document', { body: { classList: { toggle } } })

    await Effect.runPromise(syncUnderwaterScreenTintFeedback(true))
    await Effect.runPromise(syncUnderwaterScreenTintFeedback(false))

    expect(toggle).toHaveBeenNthCalledWith(1, UNDERWATER_SCREEN_TINT_CLASS, true)
    expect(toggle).toHaveBeenNthCalledWith(2, UNDERWATER_SCREEN_TINT_CLASS, false)
  })

  it('ignores underwater screen tint sync when document is unavailable', async () => {
    vi.stubGlobal('document', undefined)

    await Effect.runPromise(syncUnderwaterScreenTintFeedback(true))
  })
})
