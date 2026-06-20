import { MutableHashMap, Option, Layer, Effect } from 'effect'
import { vi } from 'vitest'
import { SettingsService, SettingsStorageServiceLayer } from '@ts-minecraft/game'
import { EnvironmentPort } from '@ts-minecraft/core'

// Test EnvironmentPort: jsdom localhost is treated as local development.
// as localhost, which forces audioEnabled=false on load. Replicate that explicitly here.
export const EnvironmentTest = Layer.succeed(EnvironmentPort, { isLocalhost: Effect.succeed(true) })

export const SettingsServiceLayer = SettingsService.Default.pipe(
  Layer.provide(SettingsStorageServiceLayer),
  Layer.provide(EnvironmentTest),
)
export const SettingsServiceDefault = SettingsService.Default.pipe(
  Layer.provide(SettingsStorageServiceLayer),
  Layer.provide(EnvironmentTest),
)

export const SETTINGS_STORE_NAME = 'settings'
export const SETTINGS_RECORD_KEY = 'current'

export const DEFAULT_SETTINGS = {
  renderDistance: 3,
  mouseSensitivity: 0.5,
  dayLengthSeconds: 400,
  difficulty: 'normal',
  graphicsQuality: 'low',
  adaptivePerformanceMode: true,
  audioEnabled: false, // NOTE: false intentionally — must match settings-service.ts DEFAULT_SETTINGS
  masterVolume: 0.8,
  sfxVolume: 1.0,
  musicVolume: 0.55,
}

export type IndexedDbMock = {
  store: MutableHashMap.MutableHashMap<string, unknown>
  openSpy: ReturnType<typeof vi.fn>
  putSpy: ReturnType<typeof vi.fn>
  getSpy: ReturnType<typeof vi.fn>
}

const queueRequestSuccess = <A>(request: IDBRequest<A>, value: A): void => {
  Object.defineProperty(request, 'result', { configurable: true, get: () => value })
  queueMicrotask(() => request.onsuccess?.(new Event('success')))
}

export const makeIndexedDbMock = (): IndexedDbMock => {
  const store = MutableHashMap.empty<string, unknown>()
  const getSpy = vi.fn((key: string) => Option.getOrUndefined(MutableHashMap.get(store, key)))
  const putSpy = vi.fn((value: unknown, key: string) => {
    MutableHashMap.set(store, key, value)
    return key
  })

  const db = {
    objectStoreNames: {
      contains: (name: string) => name === SETTINGS_STORE_NAME,
    },
    createObjectStore: vi.fn(),
    transaction: vi.fn(() => ({
      objectStore: vi.fn(() => ({
        get: (key: string) => {
          const request = {} as IDBRequest<unknown>
          queueRequestSuccess(request, getSpy(key))
          return request
        },
        put: (value: unknown, key: string) => {
          const request = {} as IDBRequest<IDBValidKey>
          queueRequestSuccess(request, putSpy(value, key))
          return request
        },
      })),
    })),
    close: vi.fn(),
  } as unknown as IDBDatabase

  const openSpy = vi.fn(() => {
    const request = {} as IDBOpenDBRequest
    Object.defineProperty(request, 'result', { configurable: true, get: () => db })
    queueMicrotask(() => request.onsuccess?.(new Event('success')))
    return request
  })

  vi.stubGlobal('indexedDB', { open: openSpy })
  return { store, openSpy, putSpy, getSpy }
}
