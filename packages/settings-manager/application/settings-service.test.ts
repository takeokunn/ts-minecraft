import { Array as Arr, Effect, Layer, MutableHashMap, Option, Schema } from 'effect'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { describe, it } from '@effect/vitest'
import { ResolvedGraphicsSchema, resolvePreset, SettingsSchema, SettingsService, SettingsServiceLive, type GraphicsQuality, GRAPHICS_PRESETS } from '@ts-minecraft/settings-manager'
import { EnvironmentPort } from '@ts-minecraft/environment'

// Test EnvironmentPort: previous behavior treated jsdom (`window.location.hostname === 'localhost'`)
// as localhost, which forces audioEnabled=false on load. Replicate that explicitly here.
const EnvironmentTest = Layer.succeed(EnvironmentPort, { isLocalhost: Effect.succeed(true) })

const SettingsLive = SettingsServiceLive.pipe(Layer.provide(EnvironmentTest))
const SettingsDefault = SettingsService.Default.pipe(Layer.provide(EnvironmentTest))

const STORAGE_KEY = 'minecraft-settings'

const DEFAULT_SETTINGS = {
  renderDistance: 2,
  mouseSensitivity: 0.5,
  dayLengthSeconds: 400,
  graphicsQuality: 'low',
  adaptivePerformanceMode: true,
  audioEnabled: false, // NOTE: false intentionally — must match settings-service.ts DEFAULT_SETTINGS
  masterVolume: 0.8,
  sfxVolume: 1.0,
  musicVolume: 0.55,
}

describe('application/settings/settings-service', () => {
  let store: MutableHashMap.MutableHashMap<string, string>
  let getItemSpy: ReturnType<typeof vi.fn>
  let setItemSpy: ReturnType<typeof vi.fn>
  let removeItemSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    store = MutableHashMap.empty<string, string>()

    getItemSpy = vi.fn((key: string) => Option.getOrNull(MutableHashMap.get(store, key)))
    setItemSpy = vi.fn((key: string, value: string) => {
      MutableHashMap.set(store, key, value)
    })
    removeItemSpy = vi.fn((key: string) => {
      MutableHashMap.remove(store, key)
    })

    vi.stubGlobal('localStorage', {
      getItem: getItemSpy,
      setItem: setItemSpy,
      removeItem: removeItemSpy,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

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

      expect(result).toEqual(DEFAULT_SETTINGS)
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
  })

  describe('ResolvedGraphicsSchema/preset bounds', () => {
    // Guards against schema/preset bound mismatches: every value in
    // GRAPHICS_PRESETS[q] must satisfy ResolvedGraphicsSchema. A regression
    // here (e.g. shrinking refractionThrottleFrames bounds without updating
    // the medium preset) would throw at runtime any time a path decodes
    // preset values.
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

  describe('SettingsService/getSettings', () => {
    it.effect('returns default settings when localStorage is empty', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings).toEqual(DEFAULT_SETTINGS)
        expect(getItemSpy).toHaveBeenCalledWith(STORAGE_KEY)
      }).pipe(Effect.provide(SettingsLive))
    )

    it.effect('loads persisted settings when localStorage has valid data', () => {
      MutableHashMap.set(store,
        STORAGE_KEY,
        JSON.stringify({
          renderDistance: 12,
          mouseSensitivity: 1.2,
          dayLengthSeconds: 900,
          graphicsQuality: 'ultra',
  adaptivePerformanceMode: false,
        })
      )
      return Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings).toEqual({
          renderDistance: 12,
          mouseSensitivity: 1.2,
          dayLengthSeconds: 900,
          graphicsQuality: 'ultra',
  adaptivePerformanceMode: false,
          audioEnabled: false,
          masterVolume: 0.8,
          sfxVolume: 1.0,
          musicVolume: 0.55,
        })
      }).pipe(Effect.provide(SettingsLive))
    })

    it.effect('falls back to defaults when localStorage contains invalid JSON', () => {
      MutableHashMap.set(store, STORAGE_KEY, '{invalid-json}')
      return Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings).toEqual(DEFAULT_SETTINGS)
      }).pipe(Effect.provide(SettingsLive))
    })

    it.effect('migrates schema-invalid legacy data instead of discarding valid fields', () => {
      MutableHashMap.set(store,
        STORAGE_KEY,
        JSON.stringify({
          renderDistance: 1,
          mouseSensitivity: 1.25,
          dayLengthSeconds: 600,
          graphicsQuality: 'ultra',
  adaptivePerformanceMode: false,
          audioEnabled: false,
          masterVolume: 0.25,
          sfxVolume: 0.4,
          musicVolume: 0.6,
        })
      )
      return Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings).toEqual({
          renderDistance: 2,
          mouseSensitivity: 1.25,
          dayLengthSeconds: 600,
          graphicsQuality: 'ultra',
  adaptivePerformanceMode: false,
          audioEnabled: false,
          masterVolume: 0.25,
          sfxVolume: 0.4,
          musicVolume: 0.6,
        })
        expect(setItemSpy).toHaveBeenCalledWith(
          STORAGE_KEY,
          JSON.stringify({
            renderDistance: 2,
            mouseSensitivity: 1.25,
            dayLengthSeconds: 600,
            graphicsQuality: 'ultra',
  adaptivePerformanceMode: false,
            audioEnabled: false,
            masterVolume: 0.25,
            sfxVolume: 0.4,
            musicVolume: 0.6,
          })
        )
      }).pipe(Effect.provide(SettingsLive))
    })

    it.effect('falls back to defaults when localStorage.getItem throws', () => {
      getItemSpy.mockImplementation(() => {
        throw new Error('boom')
      })
      return Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings).toEqual(DEFAULT_SETTINGS)
      }).pipe(Effect.provide(SettingsLive))
    })

    it.effect("default settings should include graphicsQuality='low'", () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings.graphicsQuality).toBe('low')
      }).pipe(Effect.provide(SettingsDefault))
    )

    it.effect("should accept and persist graphicsQuality='low'", () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ graphicsQuality: 'low' })
        const settings = yield* service.getSettings()
        expect(settings.graphicsQuality).toBe('low')
      }).pipe(Effect.provide(SettingsDefault))
    )

    it.effect("should accept and persist graphicsQuality='ultra'", () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ graphicsQuality: 'ultra' })
        const settings = yield* service.getSettings()
        expect(settings.graphicsQuality).toBe('ultra')
      }).pipe(Effect.provide(SettingsDefault))
    )

    it('resolvePreset returns the correct values for every quality level', () => {
      Arr.forEach(
        ['low', 'medium', 'high', 'ultra'] as const,
        (quality) => {
          const resolved = resolvePreset(quality)
          const expected = GRAPHICS_PRESETS[quality]
          expect(resolved.shadowsEnabled).toBe(expected.shadowsEnabled)
          expect(resolved.ssaoEnabled).toBe(expected.ssaoEnabled)
          expect(resolved.bloomEnabled).toBe(expected.bloomEnabled)
          expect(resolved.smaaEnabled).toBe(expected.smaaEnabled)
          expect(resolved.skyEnabled).toBe(expected.skyEnabled)
          expect(resolved.dofEnabled).toBe(expected.dofEnabled)
          expect(resolved.godRaysEnabled).toBe(expected.godRaysEnabled)
          expect(resolved.godRaysSamples).toBe(expected.godRaysSamples)
          expect(resolved.bloomStrength).toBe(expected.bloomStrength)
          expect(resolved.refractionThrottleFrames).toBe(expected.refractionThrottleFrames)
          expect(resolved.pixelRatioCap).toBe(expected.pixelRatioCap)
        }
      )
    })

    it('resolvePreset: lower quality presets clamp DPR more aggressively', () => {
      expect(GRAPHICS_PRESETS.low.pixelRatioCap).toBeLessThanOrEqual(GRAPHICS_PRESETS.medium.pixelRatioCap)
      expect(GRAPHICS_PRESETS.medium.pixelRatioCap).toBeLessThanOrEqual(GRAPHICS_PRESETS.high.pixelRatioCap)
      expect(GRAPHICS_PRESETS.high.pixelRatioCap).toBeLessThanOrEqual(GRAPHICS_PRESETS.ultra.pixelRatioCap)
    })

    it('resolvePreset: each higher quality level has >= enabled passes than lower ones', () => {
      const countEnabled = (q: typeof GRAPHICS_PRESETS[keyof typeof GRAPHICS_PRESETS]) =>
        Arr.filter([q.shadowsEnabled, q.ssaoEnabled, q.bloomEnabled, q.dofEnabled, q.godRaysEnabled], Boolean).length
      expect(countEnabled(GRAPHICS_PRESETS.low)).toBeLessThanOrEqual(countEnabled(GRAPHICS_PRESETS.medium))
      expect(countEnabled(GRAPHICS_PRESETS.medium)).toBeLessThanOrEqual(countEnabled(GRAPHICS_PRESETS.high))
      expect(countEnabled(GRAPHICS_PRESETS.high)).toBeLessThanOrEqual(countEnabled(GRAPHICS_PRESETS.ultra))
    })
  })

  describe('SettingsService/updateSettings', () => {
    it.effect('updates a single field', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 10 })
        const settings = yield* service.getSettings()
        expect(settings).toEqual({ ...DEFAULT_SETTINGS, renderDistance: 10 })
      }).pipe(Effect.provide(SettingsLive))
    )

    it.effect('updates multiple fields', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 14, dayLengthSeconds: 600 })
        const settings = yield* service.getSettings()
        expect(settings).toEqual({ ...DEFAULT_SETTINGS, renderDistance: 14, dayLengthSeconds: 600 })
      }).pipe(Effect.provide(SettingsLive))
    )

    it.effect('accumulates valid sequential partial updates', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 6 })
        yield* service.updateSettings({ mouseSensitivity: 1.8 })
        yield* service.updateSettings({ dayLengthSeconds: 300 })
        const settings = yield* service.getSettings()
        expect(settings).toEqual({ ...DEFAULT_SETTINGS, renderDistance: 6, mouseSensitivity: 1.8, dayLengthSeconds: 300 })
      }).pipe(Effect.provide(SettingsLive))
    )

    it.effect('falls back to defaults when renderDistance is out of range', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 17 })
        const settings = yield* service.getSettings()
        expect(settings).toEqual(DEFAULT_SETTINGS)
      }).pipe(Effect.provide(SettingsLive))
    )

    it.effect('falls back to defaults when mouseSensitivity is out of range', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ mouseSensitivity: 0.05 })
        const settings = yield* service.getSettings()
        expect(settings).toEqual(DEFAULT_SETTINGS)
      }).pipe(Effect.provide(SettingsLive))
    )

    it.effect('falls back to defaults when dayLengthSeconds is out of range', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ dayLengthSeconds: 5000 })
        const settings = yield* service.getSettings()
        expect(settings).toEqual(DEFAULT_SETTINGS)
      }).pipe(Effect.provide(SettingsLive))
    )

    it.effect('falls back to defaults when one field is valid and another is invalid', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 12, mouseSensitivity: 99 })
        const settings = yield* service.getSettings()
        expect(settings).toEqual(DEFAULT_SETTINGS)
      }).pipe(Effect.provide(SettingsLive))
    )

    it.effect('keeps previously valid settings when an update becomes invalid', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 10, mouseSensitivity: 1.4 })
        yield* service.updateSettings({ renderDistance: 99 })
        const settings = yield* service.getSettings()
        expect(settings).toEqual({ ...DEFAULT_SETTINGS, renderDistance: 10, mouseSensitivity: 1.4 })
      }).pipe(Effect.provide(SettingsLive))
    )

    it.effect('persists updated settings to localStorage', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 11 })
        expect(setItemSpy).toHaveBeenCalledWith(
          STORAGE_KEY,
          JSON.stringify({ ...DEFAULT_SETTINGS, renderDistance: 11 })
        )
      }).pipe(Effect.provide(SettingsLive))
    )

    it.effect('keeps in-memory update even when localStorage.setItem throws', () => {
      setItemSpy.mockImplementation(() => {
        throw new Error('save failed')
      })
      return Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ mouseSensitivity: 2.2 })
        const settings = yield* service.getSettings()
        expect(settings).toEqual({ ...DEFAULT_SETTINGS, mouseSensitivity: 2.2 })
      }).pipe(Effect.provide(SettingsLive))
    })
  })

  describe('SettingsService/resetToDefaults', () => {
    it.effect('resets settings back to defaults', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({
          renderDistance: 15,
          mouseSensitivity: 1.7,
          dayLengthSeconds: 1000,
        })
        yield* service.resetToDefaults()
        const settings = yield* service.getSettings()
        expect(settings).toEqual(DEFAULT_SETTINGS)
      }).pipe(Effect.provide(SettingsLive))
    )

    it.effect('persists defaults to localStorage on reset', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 13 })
        yield* service.resetToDefaults()
        const lastCall = Option.getOrThrow(Arr.last(setItemSpy.mock.calls))
        expect(lastCall).toEqual([STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS)])
      }).pipe(Effect.provide(SettingsLive))
    )
  })

  describe('Effect composition', () => {
    it.effect('chains getSettings -> updateSettings -> getSettings', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        const before = yield* service.getSettings()
        yield* service.updateSettings({ renderDistance: 9 })
        const after = yield* service.getSettings()
        expect(before).toEqual(DEFAULT_SETTINGS)
        expect(after).toEqual({ ...DEFAULT_SETTINGS, renderDistance: 9 })
      }).pipe(Effect.provide(SettingsLive))
    )

    it.effect('chains getSettings -> updateSettings -> resetToDefaults -> getSettings', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        const initial = yield* service.getSettings()
        yield* service.updateSettings({ dayLengthSeconds: 850 })
        const updated = yield* service.getSettings()
        yield* service.resetToDefaults()
        const reset = yield* service.getSettings()
        expect(initial).toEqual(DEFAULT_SETTINGS)
        expect(updated).toEqual({ ...DEFAULT_SETTINGS, dayLengthSeconds: 850 })
        expect(reset).toEqual(DEFAULT_SETTINGS)
      }).pipe(Effect.provide(SettingsLive))
    )
  })

  describe('updateSettings — edge cases', () => {
    it.effect('updateSettings({}) with empty partial is a no-op (all fields unchanged)', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        const before = yield* service.getSettings()
        yield* service.updateSettings({})
        const after = yield* service.getSettings()
        expect(after).toEqual(before)
      }).pipe(Effect.provide(SettingsLive))
    )
  })
})
