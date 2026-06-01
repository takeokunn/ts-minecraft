import { Array as Arr, Effect, Option } from 'effect'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { describe, it } from '@effect/vitest'
import { SettingsService } from '@ts-minecraft/game'
import {
  DEFAULT_SETTINGS,
  makeLocalStorageMock,
  SettingsLive,
  STORAGE_KEY,
} from './settings-service-test-utils'

describe('application/settings/settings-service (mutations)', () => {
  let getItemSpy: ReturnType<typeof vi.fn>
  let setItemSpy: ReturnType<typeof vi.fn>
  let removeItemSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    const mock = makeLocalStorageMock()
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
expect.fail('save failed')
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
