import { Cause, Effect, Option, Ref, Schema } from 'effect'
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
  /** Bloom (glow) post-processing. Default: true. */
  bloomEnabled: Schema.Boolean,
  /** Physical sky (Three.Sky Preetham model). Default: true. */
  skyEnabled: Schema.Boolean,
  /** Screen-space reflections on water. Default: true. */
  ssrEnabled: Schema.Boolean,
  /** Depth of field (bokeh). Default: true. */
  dofEnabled: Schema.Boolean,
  /** God rays (crepuscular light shafts). Default: true. */
  godRaysEnabled: Schema.Boolean,
  /** SMAA anti-aliasing. Default: true. */
  smaaEnabled: Schema.Boolean,
  /** Audio global enable toggle (optional in stored data; defaults to true for backward compatibility). */
  audioEnabled: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Master audio volume in [0,1] (optional in stored data; defaults to 0.8 for backward compatibility). */
  masterVolume: Schema.optionalWith(Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)), { default: () => 0.8 }),
  /** Sound effect volume in [0,1] (optional in stored data; defaults to 1.0 for backward compatibility). */
  sfxVolume: Schema.optionalWith(Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)), { default: () => 1.0 }),
  /** Music volume in [0,1] (optional in stored data; defaults to 0.55 for backward compatibility). */
  musicVolume: Schema.optionalWith(Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)), { default: () => 0.55 }),
})
export type Settings = Schema.Schema.Type<typeof SettingsSchema>

const DEFAULT_SETTINGS: Settings = {
  renderDistance: 8,
  mouseSensitivity: 0.5,
  dayLengthSeconds: 400,
  shadowsEnabled: true,
  ssaoEnabled: true,
  bloomEnabled: true,
  skyEnabled: true,
  ssrEnabled: false,
  dofEnabled: false,
  godRaysEnabled: false,
  smaaEnabled: true,
  audioEnabled: true,
  masterVolume: 0.8,
  sfxVolume: 1.0,
  musicVolume: 0.55,
}

const STORAGE_KEY = 'minecraft-settings'

// Schema.decodeUnknown returns Effect<Settings, ParseError> — no Effect.try wrapper needed
const loadFromStorage: Effect.Effect<Settings, never, never> =
  Effect.gen(function* () {
    const rawOpt = Option.fromNullable(typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null)
    return yield* Option.match(rawOpt, {
      onNone: () => Effect.succeed(DEFAULT_SETTINGS),
      onSome: (rawStr) => Effect.gen(function* () {
        const parsed = yield* Effect.try({
          try: () => JSON.parse(rawStr) as unknown,
          catch: (e) => new SettingsError({ operation: 'load', cause: e }),
        })
        return yield* Schema.decodeUnknown(SettingsSchema)(parsed).pipe(
          Effect.mapError((e) => new SettingsError({ operation: 'load', cause: e }))
        )
      }),
    })
  }).pipe(
    Effect.tapError((e) => Effect.logWarning(`Settings load failed, using defaults: ${e.message}`)),
    Effect.catchAllCause(() => Effect.succeed(DEFAULT_SETTINGS))
  )

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

        // Schema.decodeUnknown returns Effect<Settings, ParseError> — no Effect.try wrapper needed
        updateSettings: (partial: Partial<Settings>) =>
          Effect.gen(function* () {
            const current = yield* Ref.get(settingsRef)
            const merged = { ...current, ...partial }
            const result = yield* Schema.decodeUnknown(SettingsSchema)(merged).pipe(
              Effect.catchAllCause((cause) =>
                Effect.logWarning(`Settings validation failed, keeping previous settings: ${Cause.pretty(cause)}`).pipe(
                  Effect.as(current)
                )
              )
            )
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
