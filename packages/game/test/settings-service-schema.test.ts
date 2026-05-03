import { Array as Arr, Schema } from 'effect'
import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import {
  ResolvedGraphicsSchema,
  resolvePreset,
  SettingsSchema,
  type GraphicsQuality,
  GRAPHICS_PRESETS,
} from '@ts-minecraft/game'

describe('application/settings/settings-service', () => {
  describe('SettingsSchema', () => {
    const decode = SettingsSchema.pipe(Schema.decodeUnknownSync)

    it('decodes valid settings', () => {
      const result = decode({
        renderDistance: 2,
        mouseSensitivity: 0.5,
        dayLengthSeconds: 400,
        graphicsQuality: 'low',
        adaptivePerformanceMode: true,
      })

      expect(result.renderDistance).toBe(2)
      expect(result.mouseSensitivity).toBe(0.5)
      expect(result.dayLengthSeconds).toBe(400)
      expect(result.graphicsQuality).toBe('low')
      expect(result.adaptivePerformanceMode).toBe(true)
    })

    it('accepts exact minimum boundaries', () => {
      const result = decode({
        renderDistance: 2,
        mouseSensitivity: 0.1,
        dayLengthSeconds: 120,
        graphicsQuality: 'low',
        adaptivePerformanceMode: false,
      })

      expect(result).toEqual({
        renderDistance: 2,
        mouseSensitivity: 0.1,
        dayLengthSeconds: 120,
        graphicsQuality: 'low',
        adaptivePerformanceMode: false,
        audioEnabled: false,
        masterVolume: 0.8,
        sfxVolume: 1.0,
        musicVolume: 0.55,
      })
    })

    it('accepts exact maximum boundaries', () => {
      const result = decode({
        renderDistance: 16,
        mouseSensitivity: 3,
        dayLengthSeconds: 1200,
        graphicsQuality: 'ultra',
        adaptivePerformanceMode: false,
      })

      expect(result).toEqual({
        renderDistance: 16,
        mouseSensitivity: 3,
        dayLengthSeconds: 1200,
        graphicsQuality: 'ultra',
        adaptivePerformanceMode: false,
        audioEnabled: false,
        masterVolume: 0.8,
        sfxVolume: 1.0,
        musicVolume: 0.55,
      })
    })

    it('rejects renderDistance below range', () => {
      expect(() =>
        decode({
          renderDistance: 1,
          mouseSensitivity: 0.5,
          dayLengthSeconds: 400,
        })
      ).toThrow()
    })

    it('rejects renderDistance above range', () => {
      expect(() =>
        decode({
          renderDistance: 17,
          mouseSensitivity: 0.5,
          dayLengthSeconds: 400,
        })
      ).toThrow()
    })

    it('rejects mouseSensitivity below range', () => {
      expect(() =>
        decode({
          renderDistance: 8,
          mouseSensitivity: 0.09,
          dayLengthSeconds: 400,
        })
      ).toThrow()
    })

    it('rejects mouseSensitivity above range', () => {
      expect(() =>
        decode({
          renderDistance: 8,
          mouseSensitivity: 3.01,
          dayLengthSeconds: 400,
        })
      ).toThrow()
    })

    it('rejects dayLengthSeconds below range', () => {
      expect(() =>
        decode({
          renderDistance: 8,
          mouseSensitivity: 0.5,
          dayLengthSeconds: 119,
        })
      ).toThrow()
    })

    it('rejects dayLengthSeconds above range', () => {
      expect(() =>
        decode({
          renderDistance: 8,
          mouseSensitivity: 0.5,
          dayLengthSeconds: 1201,
        })
      ).toThrow()
    })

    it('rejects NaN values', () => {
      expect(() =>
        decode({
          renderDistance: Number.NaN,
          mouseSensitivity: 0.5,
          dayLengthSeconds: 400,
        })
      ).toThrow()
    })

    it('rejects Infinity values', () => {
      expect(() =>
        decode({
          renderDistance: 8,
          mouseSensitivity: Number.POSITIVE_INFINITY,
          dayLengthSeconds: 400,
        })
      ).toThrow()
    })

    it('rejects missing required fields', () => {
      expect(() => decode({ renderDistance: 8, mouseSensitivity: 0.5 })).toThrow()
    })

    it('uses default values for graphicsQuality and adaptivePerformanceMode when omitted', () => {
      const result = decode({
        renderDistance: 4,
        mouseSensitivity: 1.0,
        dayLengthSeconds: 400,
      })
      expect(result.graphicsQuality).toBe('low')
      expect(result.adaptivePerformanceMode).toBe(true)
    })
  })

  describe('ResolvedGraphicsSchema/preset bounds', () => {
    const decodeResolved = ResolvedGraphicsSchema.pipe(Schema.decodeUnknownSync)

    Arr.forEach(['low', 'medium', 'high', 'ultra'] as const satisfies ReadonlyArray<GraphicsQuality>, (quality) => {
      it(`GRAPHICS_PRESETS.${quality} satisfies ResolvedGraphicsSchema`, () => {
        expect(() => decodeResolved(GRAPHICS_PRESETS[quality])).not.toThrow()
      })
    })

    it('resolvePreset output round-trips through ResolvedGraphicsSchema for every quality', () => {
      Arr.forEach(['low', 'medium', 'high', 'ultra'] as const satisfies ReadonlyArray<GraphicsQuality>, (quality) => {
        const resolved = resolvePreset(quality)
        expect(() => decodeResolved(resolved)).not.toThrow()
      })
    })
  })
})
