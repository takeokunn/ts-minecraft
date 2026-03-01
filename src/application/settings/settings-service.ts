import { Effect, Context, Layer, Ref } from 'effect'

export interface Settings {
  readonly renderDistance: number    // 2-16, default 8
  readonly mouseSensitivity: number  // 0.1-3.0, default 0.5
  readonly dayLengthSeconds: number  // 120-1200, default 400
}

const DEFAULT_SETTINGS: Settings = {
  renderDistance: 8,
  mouseSensitivity: 0.5,
  dayLengthSeconds: 400,
}

const STORAGE_KEY = 'minecraft-settings'

const clampSettings = (s: Partial<Settings>): Settings => ({
  renderDistance: Math.max(2, Math.min(16, s.renderDistance ?? DEFAULT_SETTINGS.renderDistance)),
  mouseSensitivity: Math.max(0.1, Math.min(3.0, s.mouseSensitivity ?? DEFAULT_SETTINGS.mouseSensitivity)),
  dayLengthSeconds: Math.max(120, Math.min(1200, s.dayLengthSeconds ?? DEFAULT_SETTINGS.dayLengthSeconds)),
})

const loadFromStorage: Effect.Effect<Settings, never, never> =
  Effect.try({
    try: () => {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      if (!raw) return DEFAULT_SETTINGS
      return clampSettings(JSON.parse(raw) as Partial<Settings>)
    },
    catch: (e) => new Error(String(e)),
  }).pipe(Effect.catchAll(() => Effect.succeed(DEFAULT_SETTINGS)))

const saveToStorage = (settings: Settings): Effect.Effect<void, never, never> =>
  Effect.try({
    try: () => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      }
    },
    catch: (e) => new Error(String(e)),
  }).pipe(Effect.catchAll(() => Effect.void))

export interface SettingsService {
  readonly getSettings: () => Effect.Effect<Settings, never>
  readonly updateSettings: (partial: Partial<Settings>) => Effect.Effect<void, never>
  readonly resetToDefaults: () => Effect.Effect<void, never>
}

export const SettingsService = Context.GenericTag<SettingsService>('@minecraft/application/SettingsService')

export const SettingsServiceLive = Layer.effect(
  SettingsService,
  Effect.gen(function* () {
    const settingsRef = yield* Ref.make<Settings>(yield* loadFromStorage)

    return SettingsService.of({
      getSettings: () => Ref.get(settingsRef),

      updateSettings: (partial) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(settingsRef)
          const updated = clampSettings({ ...current, ...partial })
          yield* Ref.set(settingsRef, updated)
          yield* saveToStorage(updated)
        }),

      resetToDefaults: () =>
        Effect.gen(function* () {
          yield* Ref.set(settingsRef, DEFAULT_SETTINGS)
          yield* saveToStorage(DEFAULT_SETTINGS)
        }),
    })
  })
)
