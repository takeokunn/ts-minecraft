import { describe, expect, it } from 'vitest'

import { TOUCH_CONTROLS_STYLE_ID, touchControlsCss } from './touch-controls-styles'

describe('touch controls styles', () => {
  it('exposes the stable stylesheet id and coarse-pointer display gate', () => {
    expect(TOUCH_CONTROLS_STYLE_ID).toBe('touch-controls-style')
    expect(touchControlsCss).toContain('@media (hover:none) and (pointer:coarse)')
    expect(touchControlsCss).toContain('#touch-controls{display:block}')
  })

  it('accounts for device safe areas and minimum touch target sizes', () => {
    expect(touchControlsCss).toContain('env(safe-area-inset-left)')
    expect(touchControlsCss).toContain('env(safe-area-inset-right)')
    expect(touchControlsCss).toContain('env(safe-area-inset-top)')
    expect(touchControlsCss).toContain('env(safe-area-inset-bottom)')
    expect(touchControlsCss).toContain('min-width:48px')
    expect(touchControlsCss).toContain('min-height:48px')
    expect(touchControlsCss).not.toContain('transform:scale(')
  })

  it('provides portrait guidance without animating reduced-motion users', () => {
    expect(touchControlsCss).toContain('(orientation:portrait)')
    expect(touchControlsCss).toContain('#touch-orientation{display:grid}')
    expect(touchControlsCss).toContain('@media (prefers-reduced-motion:reduce)')
  })
})
