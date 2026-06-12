import { MutableHashMap, Option, Layer, Effect } from 'effect'
import { vi } from 'vitest'
import { SettingsService, SettingsServiceLive } from '@ts-minecraft/game'
import { EnvironmentPort } from '@ts-minecraft/core'

// Test EnvironmentPort: jsdom localhost is treated as local development.
// as localhost, which forces audioEnabled=false on load. Replicate that explicitly here.
export const EnvironmentTest = Layer.succeed(EnvironmentPort, { isLocalhost: Effect.succeed(true) })

export const SettingsLive = SettingsServiceLive.pipe(Layer.provide(EnvironmentTest))
export const SettingsDefault = SettingsService.Default.pipe(Layer.provide(EnvironmentTest))

export const STORAGE_KEY = 'minecraft-settings'

export const DEFAULT_SETTINGS = {
  renderDistance: 4,
  mouseSensitivity: 0.5,
  dayLengthSeconds: 400,
  graphicsQuality: 'medium',
  adaptivePerformanceMode: true,
  audioEnabled: false, // NOTE: false intentionally — must match settings-service.ts DEFAULT_SETTINGS
  masterVolume: 0.8,
  sfxVolume: 1.0,
  musicVolume: 0.55,
}

export type LocalStorageMock = {
  store: MutableHashMap.MutableHashMap<string, string>
  getItemSpy: ReturnType<typeof vi.fn>
  setItemSpy: ReturnType<typeof vi.fn>
  removeItemSpy: ReturnType<typeof vi.fn>
}

export const makeLocalStorageMock = (): LocalStorageMock => {
  const store = MutableHashMap.empty<string, string>()
  const getItemSpy = vi.fn((key: string) => Option.getOrNull(MutableHashMap.get(store, key)))
  const setItemSpy = vi.fn((key: string, value: string) => { MutableHashMap.set(store, key, value) })
  const removeItemSpy = vi.fn((key: string) => { MutableHashMap.remove(store, key) })
  return { store, getItemSpy, setItemSpy, removeItemSpy }
}
