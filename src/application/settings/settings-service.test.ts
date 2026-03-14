import { Effect, Schema } from 'effect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsSchema, SettingsService, SettingsServiceLive } from './settings-service'

const STORAGE_KEY = 'minecraft-settings'

const DEFAULT_SETTINGS = {
  renderDistance: 8,
  mouseSensitivity: 0.5,
  dayLengthSeconds: 400,
}

describe('application/settings/settings-service', () => {
  let store: Map<string, string>
  let getItemSpy: ReturnType<typeof vi.fn>
  let setItemSpy: ReturnType<typeof vi.fn>
  let removeItemSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    store = new Map<string, string>()

    getItemSpy = vi.fn((key: string) => store.get(key) ?? null)
    setItemSpy = vi.fn((key: string, value: string) => {
      store.set(key, value)
    })
    removeItemSpy = vi.fn((key: string) => {
      store.delete(key)
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
      })

      expect(result).toEqual(DEFAULT_SETTINGS)
    })

    it('accepts exact minimum boundaries', () => {
      const result = decode({
        renderDistance: 2,
        mouseSensitivity: 0.1,
        dayLengthSeconds: 120,
      })

      expect(result).toEqual({
        renderDistance: 2,
        mouseSensitivity: 0.1,
        dayLengthSeconds: 120,
      })
    })

    it('accepts exact maximum boundaries', () => {
      const result = decode({
        renderDistance: 16,
        mouseSensitivity: 3,
        dayLengthSeconds: 1200,
      })

      expect(result).toEqual({
        renderDistance: 16,
        mouseSensitivity: 3,
        dayLengthSeconds: 1200,
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
    it('returns default settings when localStorage is empty', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        return yield* service.getSettings()
      }).pipe(Effect.provide(SettingsServiceLive))

      const settings = Effect.runSync(program)

      expect(settings).toEqual(DEFAULT_SETTINGS)
      expect(getItemSpy).toHaveBeenCalledWith(STORAGE_KEY)
    })

    it('loads persisted settings when localStorage has valid data', () => {
      store.set(
        STORAGE_KEY,
        JSON.stringify({
          renderDistance: 12,
          mouseSensitivity: 1.2,
          dayLengthSeconds: 900,
        })
      )

      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        return yield* service.getSettings()
      }).pipe(Effect.provide(SettingsServiceLive))

      const settings = Effect.runSync(program)

      expect(settings).toEqual({
        renderDistance: 12,
        mouseSensitivity: 1.2,
        dayLengthSeconds: 900,
      })
    })

    it('falls back to defaults when localStorage contains invalid JSON', () => {
      store.set(STORAGE_KEY, '{invalid-json}')

      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        return yield* service.getSettings()
      }).pipe(Effect.provide(SettingsServiceLive))

      const settings = Effect.runSync(program)

      expect(settings).toEqual(DEFAULT_SETTINGS)
    })

    it('falls back to defaults when localStorage contains schema-invalid data', () => {
      store.set(
        STORAGE_KEY,
        JSON.stringify({
          renderDistance: 999,
          mouseSensitivity: 0.5,
          dayLengthSeconds: 400,
        })
      )

      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        return yield* service.getSettings()
      }).pipe(Effect.provide(SettingsServiceLive))

      const settings = Effect.runSync(program)

      expect(settings).toEqual(DEFAULT_SETTINGS)
    })

    it('falls back to defaults when localStorage.getItem throws', () => {
      getItemSpy.mockImplementation(() => {
        throw new Error('boom')
      })

      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        return yield* service.getSettings()
      }).pipe(Effect.provide(SettingsServiceLive))

      const settings = Effect.runSync(program)

      expect(settings).toEqual(DEFAULT_SETTINGS)
    })
  })

  describe('SettingsService/updateSettings', () => {
    it('updates a single field', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 10 })
        return yield* service.getSettings()
      }).pipe(Effect.provide(SettingsServiceLive))

      const settings = Effect.runSync(program)

      expect(settings).toEqual({ ...DEFAULT_SETTINGS, renderDistance: 10 })
    })

    it('updates multiple fields', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 14, dayLengthSeconds: 600 })
        return yield* service.getSettings()
      }).pipe(Effect.provide(SettingsServiceLive))

      const settings = Effect.runSync(program)

      expect(settings).toEqual({
        renderDistance: 14,
        mouseSensitivity: 0.5,
        dayLengthSeconds: 600,
      })
    })

    it('accumulates valid sequential partial updates', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 6 })
        yield* service.updateSettings({ mouseSensitivity: 1.8 })
        yield* service.updateSettings({ dayLengthSeconds: 300 })
        return yield* service.getSettings()
      }).pipe(Effect.provide(SettingsServiceLive))

      const settings = Effect.runSync(program)

      expect(settings).toEqual({
        renderDistance: 6,
        mouseSensitivity: 1.8,
        dayLengthSeconds: 300,
      })
    })

    it('falls back to defaults when renderDistance is out of range', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 17 })
        return yield* service.getSettings()
      }).pipe(Effect.provide(SettingsServiceLive))

      const settings = Effect.runSync(program)

      expect(settings).toEqual(DEFAULT_SETTINGS)
    })

    it('falls back to defaults when mouseSensitivity is out of range', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ mouseSensitivity: 0.05 })
        return yield* service.getSettings()
      }).pipe(Effect.provide(SettingsServiceLive))

      const settings = Effect.runSync(program)

      expect(settings).toEqual(DEFAULT_SETTINGS)
    })

    it('falls back to defaults when dayLengthSeconds is out of range', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ dayLengthSeconds: 5000 })
        return yield* service.getSettings()
      }).pipe(Effect.provide(SettingsServiceLive))

      const settings = Effect.runSync(program)

      expect(settings).toEqual(DEFAULT_SETTINGS)
    })

    it('falls back to defaults when one field is valid and another is invalid', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 12, mouseSensitivity: 99 })
        return yield* service.getSettings()
      }).pipe(Effect.provide(SettingsServiceLive))

      const settings = Effect.runSync(program)

      expect(settings).toEqual(DEFAULT_SETTINGS)
    })

    it('persists updated settings to localStorage', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 11 })
      }).pipe(Effect.provide(SettingsServiceLive))

      Effect.runSync(program)

      expect(setItemSpy).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify({ ...DEFAULT_SETTINGS, renderDistance: 11 })
      )
    })

    it('keeps in-memory update even when localStorage.setItem throws', () => {
      setItemSpy.mockImplementation(() => {
        throw new Error('save failed')
      })

      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ mouseSensitivity: 2.2 })
        return yield* service.getSettings()
      }).pipe(Effect.provide(SettingsServiceLive))

      const settings = Effect.runSync(program)

      expect(settings).toEqual({ ...DEFAULT_SETTINGS, mouseSensitivity: 2.2 })
    })
  })

  describe('SettingsService/resetToDefaults', () => {
    it('resets settings back to defaults', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({
          renderDistance: 15,
          mouseSensitivity: 1.7,
          dayLengthSeconds: 1000,
        })
        yield* service.resetToDefaults()
        return yield* service.getSettings()
      }).pipe(Effect.provide(SettingsServiceLive))

      const settings = Effect.runSync(program)

      expect(settings).toEqual(DEFAULT_SETTINGS)
    })

    it('persists defaults to localStorage on reset', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 13 })
        yield* service.resetToDefaults()
      }).pipe(Effect.provide(SettingsServiceLive))

      Effect.runSync(program)

      const lastCall = setItemSpy.mock.calls[setItemSpy.mock.calls.length - 1]
      expect(lastCall).toEqual([STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS)])
    })
  })

  describe('Effect composition', () => {
    it('chains getSettings -> updateSettings -> getSettings', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        const before = yield* service.getSettings()
        yield* service.updateSettings({ renderDistance: 9 })
        const after = yield* service.getSettings()
        return { before, after }
      }).pipe(Effect.provide(SettingsServiceLive))

      const result = Effect.runSync(program)

      expect(result.before).toEqual(DEFAULT_SETTINGS)
      expect(result.after).toEqual({ ...DEFAULT_SETTINGS, renderDistance: 9 })
    })

    it('chains getSettings -> updateSettings -> resetToDefaults -> getSettings', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        const initial = yield* service.getSettings()
        yield* service.updateSettings({ dayLengthSeconds: 850 })
        const updated = yield* service.getSettings()
        yield* service.resetToDefaults()
        const reset = yield* service.getSettings()
        return { initial, updated, reset }
      }).pipe(Effect.provide(SettingsServiceLive))

      const result = Effect.runSync(program)

      expect(result.initial).toEqual(DEFAULT_SETTINGS)
      expect(result.updated).toEqual({ ...DEFAULT_SETTINGS, dayLengthSeconds: 850 })
      expect(result.reset).toEqual(DEFAULT_SETTINGS)
    })
  })
})
