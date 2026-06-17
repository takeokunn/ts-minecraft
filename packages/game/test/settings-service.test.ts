import { describe,it } from '@effect/vitest'
import { GRAPHICS_PRESETS,resolvePreset,SettingsService } from '@ts-minecraft/game'
import { Array as Arr,Effect,MutableHashMap } from 'effect'
import { afterEach,beforeEach,expect,vi } from 'vitest'
import {
  DEFAULT_SETTINGS,
  makeIndexedDbMock,
  SettingsServiceDefault,
  SettingsServiceLayer,
  SETTINGS_RECORD_KEY,
} from './settings-service-test-utils'

describe('application/settings/settings-service', () => {
  let idbStore: MutableHashMap.MutableHashMap<string, unknown>
  let idbGetSpy: ReturnType<typeof vi.fn>
  let idbPutSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    const idb = makeIndexedDbMock()
    idbStore = idb.store
    idbGetSpy = idb.getSpy
    idbPutSpy = idb.putSpy
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })


  describe('SettingsService/getSettings', () => {
    it.effect('returns default settings when IndexedDB is empty', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings).toEqual(DEFAULT_SETTINGS)
        expect(idbGetSpy).toHaveBeenCalledWith('current')
      }).pipe(Effect.provide(SettingsServiceLayer))
    )

    it.effect('loads persisted settings when IndexedDB has valid data', () => {
      MutableHashMap.set(idbStore,
        SETTINGS_RECORD_KEY,
        {
          renderDistance: 12,
          mouseSensitivity: 1.2,
          dayLengthSeconds: 900,
          difficulty: 'normal',
          graphicsQuality: 'ultra',
          adaptivePerformanceMode: false,
          audioEnabled: true,
          masterVolume: 0.25,
          sfxVolume: 0.4,
          musicVolume: 0.6,
        }
      )
      return Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings).toEqual({
          renderDistance: 12,
          mouseSensitivity: 1.2,
          dayLengthSeconds: 900,
          difficulty: 'normal',
          graphicsQuality: 'ultra',
          adaptivePerformanceMode: false,
          audioEnabled: false,
          masterVolume: 0.25,
          sfxVolume: 0.4,
          musicVolume: 0.6,
        })
      }).pipe(Effect.provide(SettingsServiceLayer))
    })

    it.effect('falls back to defaults when IndexedDB contains invalid settings', () => {
      MutableHashMap.set(idbStore, SETTINGS_RECORD_KEY, '{invalid-settings}')
      return Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings).toEqual(DEFAULT_SETTINGS)
      }).pipe(Effect.provide(SettingsServiceLayer))
    })

    it.effect('falls back to defaults when persisted settings fail the current schema', () => {
      MutableHashMap.set(idbStore,
        SETTINGS_RECORD_KEY,
        {
          renderDistance: 1,
          mouseSensitivity: 1.25,
          dayLengthSeconds: 600,
          graphicsQuality: 'ultra',
  adaptivePerformanceMode: false,
          audioEnabled: false,
          masterVolume: 0.25,
          sfxVolume: 0.4,
          musicVolume: 0.6,
        }
      )
      return Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings).toEqual(DEFAULT_SETTINGS)
        expect(idbPutSpy).not.toHaveBeenCalled()
      }).pipe(Effect.provide(SettingsServiceLayer))
    })

    it.effect("default settings should include graphicsQuality='low'", () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings.graphicsQuality).toBe('low')
      }).pipe(Effect.provide(SettingsServiceDefault))
    )

    it.effect("should accept and persist graphicsQuality='low'", () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ graphicsQuality: 'low' })
        const settings = yield* service.getSettings()
        expect(settings.graphicsQuality).toBe('low')
        expect(idbPutSpy).toHaveBeenCalledWith(settings, SETTINGS_RECORD_KEY)
      }).pipe(Effect.provide(SettingsServiceDefault))
    )

    it.effect("should accept and persist graphicsQuality='ultra'", () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ graphicsQuality: 'ultra' })
        const settings = yield* service.getSettings()
        expect(settings.graphicsQuality).toBe('ultra')
        expect(idbPutSpy).toHaveBeenCalledWith(settings, SETTINGS_RECORD_KEY)
      }).pipe(Effect.provide(SettingsServiceDefault))
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
          expect(resolved.refractionMinScreenRatio).toBe(expected.refractionMinScreenRatio)
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
