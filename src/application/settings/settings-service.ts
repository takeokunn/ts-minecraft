import { Effect, Ref, Schema } from 'effect'
import { SettingsError } from '@/domain/errors'

/**
 * Schema for validating the structure of stored settings.
 * Numeric fields are validated as finite and must be within their valid ranges (out-of-range values are rejected).
 */
export const SettingsSchema = Schema.Struct({
  /** Chunk render distance in chunks. Default: 8. Must be in [2, 16]. */
  renderDistance: Schema.Number.pipe(Schema.finite(), Schema.between(2, 16)),
  /** Mouse sensitivity multiplier. Default: 0.5. Must be in [0.1, 3.0]. */
  mouseSensitivity: Schema.Number.pipe(Schema.finite(), Schema.between(0.1, 3.0)),
  /** Day length in seconds. Default: 400. Must be in [120, 1200]. */
  dayLengthSeconds: Schema.Number.pipe(Schema.finite(), Schema.between(120, 1200)),
  /** Real-time shadow maps enabled. Default: true. */
  shadowsEnabled: Schema.Boolean,
  /** Screen-space ambient occlusion enabled. Default: true. */
  ssaoEnabled: Schema.Boolean,
})
export type Settings = Schema.Schema.Type<typeof SettingsSchema>

const DEFAULT_SETTINGS: Settings = {
  renderDistance: 8,
  mouseSensitivity: 0.5,
  dayLengthSeconds: 400,
  shadowsEnabled: true,
  ssaoEnabled: true,
}

const STORAGE_KEY = 'minecraft-settings'

const loadFromStorage: Effect.Effect<Settings, never, never> =
  Effect.try({
    try: () => {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      if (!raw) return DEFAULT_SETTINGS
      return Schema.decodeUnknownSync(SettingsSchema)(JSON.parse(raw))
    },
    catch: (e) => new SettingsError({ operation: 'load', cause: e }),
  }).pipe(Effect.catchAllCause(() => Effect.succeed(DEFAULT_SETTINGS)))

const saveToStorage = (settings: Settings): Effect.Effect<void, never, never> =>
  Effect.try({
    try: () => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      }
    },
    catch: (e) => new SettingsError({ operation: 'save', cause: e }),
  }).pipe(Effect.catchAllCause(() => Effect.void))

export class SettingsService extends Effect.Service<SettingsService>()(
  '@minecraft/application/SettingsService',
  {
    effect: Effect.gen(function* () {
      const settingsRef = yield* Ref.make<Settings>(yield* loadFromStorage)

      return {
        getSettings: () => Ref.get(settingsRef),

        updateSettings: (partial: Partial<Settings>) =>
          Effect.gen(function* () {
            const current = yield* Ref.get(settingsRef)
            const merged = { ...current, ...partial }
            let result: Settings
            try {
              result = Schema.decodeUnknownSync(SettingsSchema)(merged)
            } catch {
              result = DEFAULT_SETTINGS
            }
            yield* Ref.set(settingsRef, result)
            yield* saveToStorage(result)
          }),

        resetToDefaults: () =>
          Effect.gen(function* () {
            yield* Ref.set(settingsRef, DEFAULT_SETTINGS)
            yield* saveToStorage(DEFAULT_SETTINGS)
          }),
      }
    }),
  }
) {}

export const SettingsServiceLive = SettingsService.Default
