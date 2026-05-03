import { Array as Arr, Effect, MutableHashMap, Schema } from 'effect'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { describe, it } from '@effect/vitest'
import { ResolvedGraphicsSchema, resolvePreset, SettingsSchema, SettingsService, type GraphicsQuality, GRAPHICS_PRESETS } from '@ts-minecraft/game'
import {
  DEFAULT_SETTINGS,
  makeLocalStorageMock,
  SettingsDefault,
  SettingsLive,
  STORAGE_KEY,
} from './settings-service-test-utils'

describe('application/settings/settings-service', () => {
  let store: MutableHashMap.MutableHashMap<string, string>
  let getItemSpy: ReturnType<typeof vi.fn>
  let setItemSpy: ReturnType<typeof vi.fn>
  let removeItemSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    const mock = makeLocalStorageMock()
    store = mock.store
    getItemSpy = mock.getItemSpy
    setItemSpy = mock.setItemSpy
    removeItemSpy = mock.removeItemSpy

    vi.stubGlobal('localStorage', {
      getItem: getItemSpy,
      setItem: setItemSpy,
      removeItem: removeItemSpy,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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

    it.effect('sanitizeLegacySettings: null parsed value is treated as {} — all defaults returned', () => {
      // localStorage contains "null" — JSON.parse("null") === null, not a record
      // isRecord(null) returns false → record = {} → all fields fall back to defaults
      MutableHashMap.set(store, STORAGE_KEY, 'null')
      return Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings).toEqual(DEFAULT_SETTINGS)
      }).pipe(Effect.provide(SettingsLive))
    })

    it.effect('sanitizeLegacySettings: clampNumber returns fallback for non-number renderDistance', () => {
      // renderDistance is a string — clampNumber branch: typeof value !== 'number' → return fallback
      MutableHashMap.set(store, STORAGE_KEY, JSON.stringify({
        renderDistance: 'not-a-number',
        mouseSensitivity: 1.0,
        dayLengthSeconds: 400,
        graphicsQuality: 'medium',
        adaptivePerformanceMode: false,
      }))
      return Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings.renderDistance).toBe(DEFAULT_SETTINGS.renderDistance)
      }).pipe(Effect.provide(SettingsLive))
    })

    it.effect('sanitizeLegacySettings: clampNumber returns fallback for Infinity mouseSensitivity', () => {
      // JSON.stringify converts Infinity to null; use a raw JSON string instead
      // null is not a number → clampNumber returns fallback
      MutableHashMap.set(store, STORAGE_KEY, '{"renderDistance":4,"mouseSensitivity":null,"dayLengthSeconds":400,"graphicsQuality":"low","adaptivePerformanceMode":true}')
      return Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings.mouseSensitivity).toBe(DEFAULT_SETTINGS.mouseSensitivity)
      }).pipe(Effect.provide(SettingsLive))
    })

    it.effect('sanitizeLegacySettings: isGraphicsQuality returns false for unknown value — uses default', () => {
      // graphicsQuality is not one of the four literals → isGraphicsQuality returns false
      MutableHashMap.set(store, STORAGE_KEY, JSON.stringify({
        renderDistance: 4,
        mouseSensitivity: 1.0,
        dayLengthSeconds: 400,
        graphicsQuality: 'extreme',
        adaptivePerformanceMode: false,
      }))
      return Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings.graphicsQuality).toBe(DEFAULT_SETTINGS.graphicsQuality)
      }).pipe(Effect.provide(SettingsLive))
    })

    it.effect('sanitizeLegacySettings: non-boolean adaptivePerformanceMode falls back to default', () => {
      // adaptivePerformanceMode is a number, not a boolean → ternary false branch → DEFAULT_SETTINGS value
      MutableHashMap.set(store, STORAGE_KEY, JSON.stringify({
        renderDistance: 4,
        mouseSensitivity: 1.0,
        dayLengthSeconds: 400,
        graphicsQuality: 'low',
        adaptivePerformanceMode: 1,
      }))
      return Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings.adaptivePerformanceMode).toBe(DEFAULT_SETTINGS.adaptivePerformanceMode)
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
})
