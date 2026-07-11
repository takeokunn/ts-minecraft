import { describe, expect, it } from 'vitest'
import { resolveHotbarViewportLayout } from './hotbar-three'

describe('resolveHotbarViewportLayout', () => {
  it.each([320, 390])('fits all nine slots inside the safe area at %ipx', (width) => {
    const layout = resolveHotbarViewportLayout(width, 640, 1)

    expect(620 * layout.zoom).toBeLessThanOrEqual(width - 32)
    expect(layout.zoom).toBeGreaterThan(0)
  })

  it('honours UI scale when the viewport has enough room', () => {
    expect(resolveHotbarViewportLayout(1920, 1080, 1.5).zoom).toBe(1.5)
    expect(resolveHotbarViewportLayout(1920, 1080, 0.75).zoom).toBe(0.75)
  })

  it('falls back to the default scale for invalid settings', () => {
    expect(resolveHotbarViewportLayout(1920, 1080, Number.NaN).zoom).toBe(1)
    expect(resolveHotbarViewportLayout(1920, 1080, 0).zoom).toBe(1)
  })
})
