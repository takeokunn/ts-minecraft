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
    const validSettingsInput = {
      renderDistance: 4,
      mouseSensitivity: 0.5,
      dayLengthSeconds: 400,
      graphicsQuality: 'medium' as const,
      adaptivePerformanceMode: true,
      audioEnabled: false,
      masterVolume: 0.8,
      sfxVolume: 1.0,
      musicVolume: 0.55,
    }

    it('decodes valid settings', () => {
      const result = decode(validSettingsInput)

      expect(result.renderDistance).toBe(4)
      expect(result.mouseSensitivity).toBe(0.5)
      expect(result.dayLengthSeconds).toBe(400)
      expect(result.graphicsQuality).toBe('medium')
      expect(result.adaptivePerformanceMode).toBe(true)
    })

    it('accepts exact minimum boundaries', () => {
      const result = decode({
        ...validSettingsInput,
        renderDistance: 4,
        mouseSensitivity: 0.1,
        dayLengthSeconds: 120,
        adaptivePerformanceMode: false,
      })

      expect(result).toEqual({
        renderDistance: 4,
        mouseSensitivity: 0.1,
        dayLengthSeconds: 120,
        graphicsQuality: 'medium',
        adaptivePerformanceMode: false,
        audioEnabled: false,
        masterVolume: 0.8,
        sfxVolume: 1.0,
        musicVolume: 0.55,
      })
    })

    it('accepts exact maximum boundaries', () => {
      const result = decode({
        ...validSettingsInput,
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
          ...validSettingsInput,
          renderDistance: 1,
        })
      ).toThrow()
    })

    it('rejects renderDistance above range', () => {
      expect(() =>
        decode({
          ...validSettingsInput,
          renderDistance: 17,
        })
      ).toThrow()
    })

    it('rejects mouseSensitivity below range', () => {
      expect(() =>
        decode({
          ...validSettingsInput,
          mouseSensitivity: 0.09,
        })
      ).toThrow()
    })

    it('rejects mouseSensitivity above range', () => {
      expect(() =>
        decode({
          ...validSettingsInput,
          mouseSensitivity: 3.01,
        })
      ).toThrow()
    })

    it('rejects dayLengthSeconds below range', () => {
      expect(() =>
        decode({
          ...validSettingsInput,
          dayLengthSeconds: 119,
        })
      ).toThrow()
    })

    it('rejects dayLengthSeconds above range', () => {
      expect(() =>
        decode({
          ...validSettingsInput,
          dayLengthSeconds: 1201,
        })
      ).toThrow()
    })

    it('rejects NaN values', () => {
      expect(() =>
        decode({
          ...validSettingsInput,
          renderDistance: Number.NaN,
        })
      ).toThrow()
    })

    it('rejects Infinity values', () => {
      expect(() =>
        decode({
          ...validSettingsInput,
          mouseSensitivity: Number.POSITIVE_INFINITY,
        })
      ).toThrow()
    })

    it('rejects missing required fields', () => {
      expect(() => decode({ renderDistance: 8, mouseSensitivity: 0.5 })).toThrow()
    })

  it('rejects omitted fields instead of applying implicit defaults', () => {
      expect(() => decode({ renderDistance: 4, mouseSensitivity: 1.0, dayLengthSeconds: 400 })).toThrow()
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
