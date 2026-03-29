import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Arbitrary, Schema } from 'effect'
import { SettingsSchema } from './settings-service'

const BASE = {
  renderDistance: 8,
  mouseSensitivity: 0.5,
  dayLengthSeconds: 400,
  graphicsQuality: 'high' as const,
} as const

const decode = Schema.decodeUnknownSync(SettingsSchema)

describe('SettingsSchema property tests', () => {
  describe('renderDistance', () => {
    it.prop('accepts any integer in [2, 16]', { n: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(2, 16))) }, ({ n }) => {
      expect(() => decode({ ...BASE, renderDistance: n })).not.toThrow()
    })

    it.prop('rejects integers below 2', { n: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-1000, 1))) }, ({ n }) => {
      expect(() => decode({ ...BASE, renderDistance: n })).toThrow()
    })

    it.prop('rejects integers above 16', { n: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(17, 1000))) }, ({ n }) => {
      expect(() => decode({ ...BASE, renderDistance: n })).toThrow()
    })

    it('rejects NaN', () => {
      expect(() => decode({ ...BASE, renderDistance: NaN })).toThrow()
    })

    it('rejects Infinity', () => {
      expect(() => decode({ ...BASE, renderDistance: Infinity })).toThrow()
    })

    it('rejects -Infinity', () => {
      expect(() => decode({ ...BASE, renderDistance: -Infinity })).toThrow()
    })

    it.prop('decoded value equals the input for any valid integer', { n: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(2, 16))) }, ({ n }) => {
      const result = decode({ ...BASE, renderDistance: n })
      expect(result.renderDistance).toBe(n)
    })
  })

  describe('mouseSensitivity', () => {
    it.prop(
      'accepts any finite double in [0.1, 3.0]',
      { n: Arbitrary.make(Schema.Number.pipe(Schema.between(0.1, 3.0))) },
      ({ n }) => {
        expect(() => decode({ ...BASE, mouseSensitivity: n })).not.toThrow()
      }
    )

    it.prop(
      'rejects finite doubles below 0.1',
      { n: Arbitrary.make(Schema.Number.pipe(Schema.between(-1000, 0.09))) },
      ({ n }) => {
        expect(() => decode({ ...BASE, mouseSensitivity: n })).toThrow()
      }
    )

    it.prop(
      'rejects finite doubles above 3.0',
      { n: Arbitrary.make(Schema.Number.pipe(Schema.between(3.01, 1000))) },
      ({ n }) => {
        expect(() => decode({ ...BASE, mouseSensitivity: n })).toThrow()
      }
    )

    it('rejects NaN', () => {
      expect(() => decode({ ...BASE, mouseSensitivity: NaN })).toThrow()
    })

    it('rejects Infinity', () => {
      expect(() => decode({ ...BASE, mouseSensitivity: Infinity })).toThrow()
    })

    it('rejects -Infinity', () => {
      expect(() => decode({ ...BASE, mouseSensitivity: -Infinity })).toThrow()
    })
  })

  describe('dayLengthSeconds', () => {
    it.prop('accepts any integer in [120, 1200]', { n: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(120, 1200))) }, ({ n }) => {
      expect(() => decode({ ...BASE, dayLengthSeconds: n })).not.toThrow()
    })

    it.prop('rejects integers below 120', { n: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-1000, 119))) }, ({ n }) => {
      expect(() => decode({ ...BASE, dayLengthSeconds: n })).toThrow()
    })

    it.prop('rejects integers above 1200', { n: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(1201, 10000))) }, ({ n }) => {
      expect(() => decode({ ...BASE, dayLengthSeconds: n })).toThrow()
    })

    it('rejects NaN', () => {
      expect(() => decode({ ...BASE, dayLengthSeconds: NaN })).toThrow()
    })

    it('rejects Infinity', () => {
      expect(() => decode({ ...BASE, dayLengthSeconds: Infinity })).toThrow()
    })

    it.prop('decoded value equals the input for any valid integer', { n: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(120, 1200))) }, ({ n }) => {
      const result = decode({ ...BASE, dayLengthSeconds: n })
      expect(result.dayLengthSeconds).toBe(n)
    })
  })

  describe('graphicsQuality', () => {
    it.prop(
      'accepts any valid quality literal',
      { q: Arbitrary.make(Schema.Literal('low', 'medium', 'high', 'ultra')) },
      ({ q }) => {
        expect(() => decode({ ...BASE, graphicsQuality: q })).not.toThrow()
      }
    )

    it.prop(
      'rejects non-string graphicsQuality',
      { v: Arbitrary.make(Schema.Union(Schema.Number, Schema.Boolean, Schema.Null)) },
      ({ v }) => {
        expect(() => decode({ ...BASE, graphicsQuality: v })).toThrow()
      }
    )
  })

  describe('full object round-trip', () => {
    it.prop(
      'encode then decode is identity for any valid settings object',
      { settings: Arbitrary.make(SettingsSchema) },
      ({ settings }) => {
        const encoded = Schema.encodeSync(SettingsSchema)(settings)
        const redecoded = decode(encoded)
        expect(redecoded.renderDistance).toBe(settings.renderDistance)
        expect(redecoded.dayLengthSeconds).toBe(settings.dayLengthSeconds)
        expect(redecoded.graphicsQuality).toBe(settings.graphicsQuality)
      }
    )
  })
})
