import { Array as Arr, Effect, MutableHashMap, Option, Schema } from 'effect'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { describe, it } from '@effect/vitest'
import { resolvePreset, SettingsSchema, SettingsService, SettingsServiceLive } from './settings-service'

const STORAGE_KEY = 'minecraft-settings'

const DEFAULT_SETTINGS = {
  renderDistance: 8,
  mouseSensitivity: 0.5,
  dayLengthSeconds: 400,
  graphicsQuality: 'high',
  audioEnabled: true,
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
        renderDistance: 8,
        mouseSensitivity: 0.5,
        dayLengthSeconds: 400,
        graphicsQuality: 'high',
      })

      expect(result).toEqual(DEFAULT_SETTINGS)
    })

    it('accepts exact minimum boundaries', () => {
      const result = decode({
        renderDistance: 2,
        mouseSensitivity: 0.1,
        dayLengthSeconds: 120,
        graphicsQuality: 'low',
      })

      expect(result).toEqual({
        renderDistance: 2,
        mouseSensitivity: 0.1,
        dayLengthSeconds: 120,
        graphicsQuality: 'low',
        audioEnabled: true,
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
      })

      expect(result).toEqual({
        renderDistance: 16,
        mouseSensitivity: 3,
        dayLengthSeconds: 1200,
        graphicsQuality: 'ultra',
        audioEnabled: true,
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

  describe('SettingsService/getSettings', () => {
    it.effect('returns default settings when localStorage is empty', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings).toEqual(DEFAULT_SETTINGS)
        expect(getItemSpy).toHaveBeenCalledWith(STORAGE_KEY)
      }).pipe(Effect.provide(SettingsServiceLive))
    )

    it.effect('loads persisted settings when localStorage has valid data', () => {
      MutableHashMap.set(store,
        STORAGE_KEY,
        JSON.stringify({
          renderDistance: 12,
          mouseSensitivity: 1.2,
          dayLengthSeconds: 900,
          graphicsQuality: 'ultra',
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
          audioEnabled: true,
          masterVolume: 0.8,
          sfxVolume: 1.0,
          musicVolume: 0.55,
        })
      }).pipe(Effect.provide(SettingsServiceLive))
    })

    it.effect('falls back to defaults when localStorage contains invalid JSON', () => {
      MutableHashMap.set(store, STORAGE_KEY, '{invalid-json}')
      return Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings).toEqual(DEFAULT_SETTINGS)
      }).pipe(Effect.provide(SettingsServiceLive))
    })

    it.effect('falls back to defaults when localStorage contains schema-invalid data', () => {
      MutableHashMap.set(store,
        STORAGE_KEY,
        JSON.stringify({
          renderDistance: 999,
          mouseSensitivity: 0.5,
          dayLengthSeconds: 400,
        })
      )
      return Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings).toEqual(DEFAULT_SETTINGS)
      }).pipe(Effect.provide(SettingsServiceLive))
    })

    it.effect('falls back to defaults when localStorage.getItem throws', () => {
      getItemSpy.mockImplementation(() => {
        throw new Error('boom')
      })
      return Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings).toEqual(DEFAULT_SETTINGS)
      }).pipe(Effect.provide(SettingsServiceLive))
    })

    it.effect("default settings should include graphicsQuality='high'", () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        const settings = yield* service.getSettings()
        expect(settings.graphicsQuality).toBe('high')
      }).pipe(Effect.provide(SettingsService.Default))
    )

    it.effect("should accept and persist graphicsQuality='low'", () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ graphicsQuality: 'low' })
        const settings = yield* service.getSettings()
        expect(settings.graphicsQuality).toBe('low')
      }).pipe(Effect.provide(SettingsService.Default))
    )

    it.effect("should accept and persist graphicsQuality='ultra'", () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ graphicsQuality: 'ultra' })
        const settings = yield* service.getSettings()
        expect(settings.graphicsQuality).toBe('ultra')
      }).pipe(Effect.provide(SettingsService.Default))
    )

    it("resolvePreset('high') returns expected values", () => {
      const resolved = resolvePreset('high')
      expect(resolved.shadowsEnabled).toBe(true)
      expect(resolved.ssaoEnabled).toBe(true)
      expect(resolved.bloomEnabled).toBe(true)
      expect(resolved.smaaEnabled).toBe(true)
      expect(resolved.skyEnabled).toBe(true)
      expect(resolved.dofEnabled).toBe(false)
      expect(resolved.godRaysEnabled).toBe(false)
    })
  })

  describe('SettingsService/updateSettings', () => {
    it.effect('updates a single field', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 10 })
        const settings = yield* service.getSettings()
        expect(settings).toEqual({ ...DEFAULT_SETTINGS, renderDistance: 10 })
      }).pipe(Effect.provide(SettingsServiceLive))
    )

    it.effect('updates multiple fields', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 14, dayLengthSeconds: 600 })
        const settings = yield* service.getSettings()
        expect(settings).toEqual({ ...DEFAULT_SETTINGS, renderDistance: 14, dayLengthSeconds: 600 })
      }).pipe(Effect.provide(SettingsServiceLive))
    )

    it.effect('accumulates valid sequential partial updates', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 6 })
        yield* service.updateSettings({ mouseSensitivity: 1.8 })
        yield* service.updateSettings({ dayLengthSeconds: 300 })
        const settings = yield* service.getSettings()
        expect(settings).toEqual({ ...DEFAULT_SETTINGS, renderDistance: 6, mouseSensitivity: 1.8, dayLengthSeconds: 300 })
      }).pipe(Effect.provide(SettingsServiceLive))
    )

    it.effect('falls back to defaults when renderDistance is out of range', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 17 })
        const settings = yield* service.getSettings()
        expect(settings).toEqual(DEFAULT_SETTINGS)
      }).pipe(Effect.provide(SettingsServiceLive))
    )

    it.effect('falls back to defaults when mouseSensitivity is out of range', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ mouseSensitivity: 0.05 })
        const settings = yield* service.getSettings()
        expect(settings).toEqual(DEFAULT_SETTINGS)
      }).pipe(Effect.provide(SettingsServiceLive))
    )

    it.effect('falls back to defaults when dayLengthSeconds is out of range', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ dayLengthSeconds: 5000 })
        const settings = yield* service.getSettings()
        expect(settings).toEqual(DEFAULT_SETTINGS)
      }).pipe(Effect.provide(SettingsServiceLive))
    )

    it.effect('falls back to defaults when one field is valid and another is invalid', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 12, mouseSensitivity: 99 })
        const settings = yield* service.getSettings()
        expect(settings).toEqual(DEFAULT_SETTINGS)
      }).pipe(Effect.provide(SettingsServiceLive))
    )

    it.effect('keeps previously valid settings when an update becomes invalid', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 10, mouseSensitivity: 1.4 })
        yield* service.updateSettings({ renderDistance: 99 })
        const settings = yield* service.getSettings()
        expect(settings).toEqual({ ...DEFAULT_SETTINGS, renderDistance: 10, mouseSensitivity: 1.4 })
      }).pipe(Effect.provide(SettingsServiceLive))
    )

    it.effect('persists updated settings to localStorage', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 11 })
        expect(setItemSpy).toHaveBeenCalledWith(
          STORAGE_KEY,
          JSON.stringify({ ...DEFAULT_SETTINGS, renderDistance: 11 })
        )
      }).pipe(Effect.provide(SettingsServiceLive))
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
      }).pipe(Effect.provide(SettingsServiceLive))
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
      }).pipe(Effect.provide(SettingsServiceLive))
    )

    it.effect('persists defaults to localStorage on reset', () =>
      Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 13 })
        yield* service.resetToDefaults()
        const lastCall = Option.getOrThrow(Arr.last(setItemSpy.mock.calls))
        expect(lastCall).toEqual([STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS)])
      }).pipe(Effect.provide(SettingsServiceLive))
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
      }).pipe(Effect.provide(SettingsServiceLive))
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
      }).pipe(Effect.provide(SettingsServiceLive))
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
      }).pipe(Effect.provide(SettingsServiceLive))
    )
  })
})
