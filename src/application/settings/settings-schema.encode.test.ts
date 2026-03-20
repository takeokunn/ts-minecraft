import { describe, it } from 'vitest'
import { expect } from 'vitest'
import { Schema } from 'effect'
import { SettingsSchema, type Settings } from './settings-service'

describe('SettingsSchema encode round-trip', () => {
  const validSettings: Settings = {
    renderDistance: 8,
    mouseSensitivity: 0.5,
    dayLengthSeconds: 400,
    shadowsEnabled: true,
    ssaoEnabled: true,
    bloomEnabled: true,
    skyEnabled: true,
    ssrEnabled: false,
    dofEnabled: false,
    godRaysEnabled: false,
    smaaEnabled: true,
  }

  it('encodes valid settings to a plain object', () => {
    const encoded = Schema.encodeSync(SettingsSchema)(validSettings)
    expect(encoded.renderDistance).toBe(8)
    expect(encoded.mouseSensitivity).toBe(0.5)
    expect(encoded.dayLengthSeconds).toBe(400)
    expect(encoded.shadowsEnabled).toBe(true)
    expect(encoded.ssaoEnabled).toBe(true)
  })

  it('round-trips encode then decode back to identical values', () => {
    const encoded = Schema.encodeSync(SettingsSchema)(validSettings)
    const decoded = Schema.decodeUnknownSync(SettingsSchema)(encoded)
    expect(decoded.renderDistance).toBe(validSettings.renderDistance)
    expect(decoded.mouseSensitivity).toBe(validSettings.mouseSensitivity)
    expect(decoded.dayLengthSeconds).toBe(validSettings.dayLengthSeconds)
    expect(decoded.shadowsEnabled).toBe(validSettings.shadowsEnabled)
    expect(decoded.ssaoEnabled).toBe(validSettings.ssaoEnabled)
  })

  it('round-trips with renderDistance at minimum boundary (2)', () => {
    const settings: Settings = { ...validSettings, renderDistance: 2 }
    const encoded = Schema.encodeSync(SettingsSchema)(settings)
    const decoded = Schema.decodeUnknownSync(SettingsSchema)(encoded)
    expect(decoded.renderDistance).toBe(2)
  })

  it('round-trips with renderDistance at maximum boundary (16)', () => {
    const settings: Settings = { ...validSettings, renderDistance: 16 }
    const encoded = Schema.encodeSync(SettingsSchema)(settings)
    const decoded = Schema.decodeUnknownSync(SettingsSchema)(encoded)
    expect(decoded.renderDistance).toBe(16)
  })

  it('round-trips with mouseSensitivity at minimum boundary (0.1)', () => {
    const settings: Settings = { ...validSettings, mouseSensitivity: 0.1 }
    const encoded = Schema.encodeSync(SettingsSchema)(settings)
    const decoded = Schema.decodeUnknownSync(SettingsSchema)(encoded)
    expect(decoded.mouseSensitivity).toBeCloseTo(0.1)
  })

  it('round-trips with mouseSensitivity at maximum boundary (3.0)', () => {
    const settings: Settings = { ...validSettings, mouseSensitivity: 3.0 }
    const encoded = Schema.encodeSync(SettingsSchema)(settings)
    const decoded = Schema.decodeUnknownSync(SettingsSchema)(encoded)
    expect(decoded.mouseSensitivity).toBe(3.0)
  })

  it('round-trips with dayLengthSeconds at minimum boundary (120)', () => {
    const settings: Settings = { ...validSettings, dayLengthSeconds: 120 }
    const encoded = Schema.encodeSync(SettingsSchema)(settings)
    const decoded = Schema.decodeUnknownSync(SettingsSchema)(encoded)
    expect(decoded.dayLengthSeconds).toBe(120)
  })

  it('round-trips with dayLengthSeconds at maximum boundary (1200)', () => {
    const settings: Settings = { ...validSettings, dayLengthSeconds: 1200 }
    const encoded = Schema.encodeSync(SettingsSchema)(settings)
    const decoded = Schema.decodeUnknownSync(SettingsSchema)(encoded)
    expect(decoded.dayLengthSeconds).toBe(1200)
  })

  it('round-trips with shadowsEnabled=false and ssaoEnabled=false', () => {
    const settings: Settings = { ...validSettings, shadowsEnabled: false, ssaoEnabled: false }
    const encoded = Schema.encodeSync(SettingsSchema)(settings)
    const decoded = Schema.decodeUnknownSync(SettingsSchema)(encoded)
    expect(decoded.shadowsEnabled).toBe(false)
    expect(decoded.ssaoEnabled).toBe(false)
  })

  it('decode rejects renderDistance below minimum (1)', () => {
    expect(() =>
      Schema.decodeUnknownSync(SettingsSchema)({ ...validSettings, renderDistance: 1 })
    ).toThrow()
  })

  it('decode rejects renderDistance above maximum (17)', () => {
    expect(() =>
      Schema.decodeUnknownSync(SettingsSchema)({ ...validSettings, renderDistance: 17 })
    ).toThrow()
  })

  it('decode rejects mouseSensitivity below minimum (0.09)', () => {
    expect(() =>
      Schema.decodeUnknownSync(SettingsSchema)({ ...validSettings, mouseSensitivity: 0.09 })
    ).toThrow()
  })

  it('decode rejects mouseSensitivity above maximum (3.01)', () => {
    expect(() =>
      Schema.decodeUnknownSync(SettingsSchema)({ ...validSettings, mouseSensitivity: 3.01 })
    ).toThrow()
  })

  it('decode rejects dayLengthSeconds below minimum (119)', () => {
    expect(() =>
      Schema.decodeUnknownSync(SettingsSchema)({ ...validSettings, dayLengthSeconds: 119 })
    ).toThrow()
  })

  it('decode rejects dayLengthSeconds above maximum (1201)', () => {
    expect(() =>
      Schema.decodeUnknownSync(SettingsSchema)({ ...validSettings, dayLengthSeconds: 1201 })
    ).toThrow()
  })

  it('decode rejects non-boolean shadowsEnabled', () => {
    expect(() =>
      Schema.decodeUnknownSync(SettingsSchema)({ ...validSettings, shadowsEnabled: 1 })
    ).toThrow()
  })

  it('decode rejects non-boolean ssaoEnabled', () => {
    expect(() =>
      Schema.decodeUnknownSync(SettingsSchema)({ ...validSettings, ssaoEnabled: 'yes' })
    ).toThrow()
  })

  it('decode rejects missing required field', () => {
    const { renderDistance: _omitted, ...withoutRenderDistance } = validSettings
    expect(() =>
      Schema.decodeUnknownSync(SettingsSchema)(withoutRenderDistance)
    ).toThrow()
  })

  it('Schema.encodeUnknownEither returns Right for valid settings', () => {
    const result = Schema.encodeUnknownEither(SettingsSchema)(validSettings)
    expect(result._tag).toBe('Right')
  })

  it('Schema.decodeUnknownEither returns Left for invalid renderDistance', () => {
    const result = Schema.decodeUnknownEither(SettingsSchema)({ ...validSettings, renderDistance: 0 })
    expect(result._tag).toBe('Left')
  })
})
