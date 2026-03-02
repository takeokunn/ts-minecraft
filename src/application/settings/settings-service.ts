import { Effect, Context, Layer, Ref, Schema } from 'effect'

/**
 * Schema for validating the structure of stored settings.
 * Value bounds are enforced by clampSettings after deserialization.
 */
export const SettingsSchema = Schema.Struct({
  /** Chunk render distance in chunks. Default: 8. Clamped to [2, 16] by clampSettings. */
  renderDistance: Schema.Number,
  /** Mouse sensitivity multiplier. Default: 0.5. Clamped to [0.1, 3.0] by clampSettings. */
  mouseSensitivity: Schema.Number,
  /** Day length in seconds. Default: 400. Clamped to [120, 1200] by clampSettings. */
  dayLengthSeconds: Schema.Number,
})
export type Settings = Schema.Schema.Type<typeof SettingsSchema>

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
      return clampSettings(Schema.decodeUnknownSync(SettingsSchema)(JSON.parse(raw)))
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
