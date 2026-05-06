import { describe,it } from '@effect/vitest'
import { GRAPHICS_PRESETS,resolvePreset,SettingsService } from '@ts-minecraft/game'
import { Array as Arr,Effect,MutableHashMap } from 'effect'
import { afterEach,beforeEach,expect,vi } from 'vitest'
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
          audioEnabled: true,
          masterVolume: 0.25,
          sfxVolume: 0.4,
          musicVolume: 0.6,
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
          masterVolume: 0.25,
          sfxVolume: 0.4,
          musicVolume: 0.6,
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

    it.effect('falls back to defaults when persisted settings fail the current schema', () => {
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
        expect(settings).toEqual(DEFAULT_SETTINGS)
        expect(setItemSpy).not.toHaveBeenCalled()
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

    it.effect("default settings should include graphicsQuality='medium'", () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings.graphicsQuality).toBe('medium')
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
