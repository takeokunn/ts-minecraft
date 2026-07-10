import { afterEach, describe, expect, it } from 'vitest'
import { applyColorVisionMode } from '../hud/color-vision'

// Tests run in node environment (document === undefined).
// The DOM path is exercised via a stubbed global document.

const stubDocument = () => {
  const body = { dataset: {} as Record<string, string> }
  ;(globalThis as { document?: unknown }).document = { body }
  return body
}

afterEach(() => {
  delete (globalThis as { document?: unknown }).document
})

describe('applyColorVisionMode — no DOM', () => {
  it('does not throw when document is undefined', () => {
    expect(() => applyColorVisionMode('deuteranopia')).not.toThrow()
    expect(() => applyColorVisionMode('off')).not.toThrow()
  })
})

describe('applyColorVisionMode — DOM', () => {
  it('sets the body data attribute for a deficiency mode', () => {
    const body = stubDocument()
    applyColorVisionMode('protanopia')
    expect(body.dataset['colorVision']).toBe('protanopia')
  })

  it('removes the body data attribute when set back to off', () => {
    const body = stubDocument()
    applyColorVisionMode('tritanopia')
    applyColorVisionMode('off')
    expect('colorVision' in body.dataset).toBe(false)
  })
})
