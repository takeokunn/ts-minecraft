import { describe, expect, it, vi } from 'vitest'
import {
  detectInputCapabilities,
  inputGuidance,
  TOUCH_CONTROLS_MEDIA_QUERY,
} from './input-guidance'

describe('inputGuidance', () => {
  it('puts touch-first instructions first without denying touch support', () => {
    const guidance = inputGuidance({ touch: true })

    expect(guidance.supportSummary).toContain('Touch controls are ready.')
    expect(guidance.instructions[0]).toContain('left joystick')
    expect(guidance.quickHelp.join(' ')).toContain('top-right buttons open inventory and pause')
    expect(guidance.instructions.join(' ')).not.toContain('not available')
  })

  it('keeps desktop controls first while accurately describing automatic touch controls', () => {
    const guidance = inputGuidance({ touch: false })

    expect(guidance.instructions[0]).toContain('WASD')
    expect(guidance.supportSummary.join(' ')).toContain('Touch controls appear automatically')
  })
})

describe('detectInputCapabilities', () => {
  it('uses the same touch-first media condition as the controls stylesheet', () => {
    const matchMedia = vi.fn(() => ({ matches: true }))

    expect(detectInputCapabilities({ matchMedia })).toEqual({ touch: true })
    expect(matchMedia).toHaveBeenCalledWith(TOUCH_CONTROLS_MEDIA_QUERY)
  })

  it('does not classify a device as touch-first when the media condition does not match', () => {
    expect(detectInputCapabilities({ matchMedia: () => ({ matches: false }) })).toEqual({ touch: false })
  })

  it('falls back to desktop guidance when matchMedia is unavailable', () => {
    expect(detectInputCapabilities({})).toEqual({ touch: false })
  })
})
