import { Cause, Effect, Match, Option, Ref, Schema } from 'effect'
import { SettingsError } from '@/domain/errors'

/**
 * Graphics quality preset — replaces individual post-processing toggles.
 * Each level maps to a fixed combination of pass enable states via resolvePreset().
 */
export const GraphicsQuality = Schema.Literal('low', 'medium', 'high', 'ultra')
export type GraphicsQuality = Schema.Schema.Type<typeof GraphicsQuality>

/**
 * Resolved graphics settings derived from a quality preset.
 * Used by frame-handler and main.ts to configure post-processing passes.
 */
export const ResolvedGraphicsSchema = Schema.Struct({
  shadowsEnabled: Schema.Boolean,
  ssaoEnabled: Schema.Boolean,
  bloomEnabled: Schema.Boolean,
  smaaEnabled: Schema.Boolean,
  skyEnabled: Schema.Boolean,
  dofEnabled: Schema.Boolean,
  godRaysEnabled: Schema.Boolean,
  godRaysSamples: Schema.Number.pipe(Schema.int(), Schema.between(0, 40)),
  bloomStrength: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  refractionThrottleFrames: Schema.Number.pipe(Schema.int(), Schema.between(0, 3)),
})
export type ResolvedGraphics = Schema.Schema.Type<typeof ResolvedGraphicsSchema>

/**
 * Map a quality preset to individual pass enable states.
 *
 * - low:    sky + smaa only (maximum performance)
 * - medium: + shadows + bloom (balanced)
 * - high:   + ssao (matches original defaults — good quality)
 * - ultra:  + god rays + dof (maximum quality)
 */
export const resolvePreset = (quality: GraphicsQuality): ResolvedGraphics =>
  Match.value(quality).pipe(
    Match.when('low', () => ({ shadowsEnabled: false, ssaoEnabled: false, bloomEnabled: false, smaaEnabled: true, skyEnabled: true, dofEnabled: false, godRaysEnabled: false, godRaysSamples: 0, bloomStrength: 0, refractionThrottleFrames: 0 })),
    Match.when('medium', () => ({ shadowsEnabled: true, ssaoEnabled: false, bloomEnabled: true, smaaEnabled: true, skyEnabled: true, dofEnabled: false, godRaysEnabled: false, godRaysSamples: 25, bloomStrength: 0.2, refractionThrottleFrames: 3 })),
    Match.when('high', () => ({ shadowsEnabled: true, ssaoEnabled: true, bloomEnabled: true, smaaEnabled: true, skyEnabled: true, dofEnabled: false, godRaysEnabled: false, godRaysSamples: 25, bloomStrength: 0.25, refractionThrottleFrames: 2 })),
    Match.when('ultra', () => ({ shadowsEnabled: true, ssaoEnabled: true, bloomEnabled: true, smaaEnabled: true, skyEnabled: true, dofEnabled: true, godRaysEnabled: true, godRaysSamples: 40, bloomStrength: 0.3, refractionThrottleFrames: 1 })),
    Match.exhaustive,
  )

/**
 * Schema for validating the structure of stored settings.
 * Numeric fields are validated as finite and must be within their valid ranges (out-of-range values are rejected).
 *
 * graphicsQuality replaces individual post-processing booleans (shadowsEnabled, ssaoEnabled, etc.).
 * Old localStorage data with individual booleans is silently migrated — the booleans are ignored
 * and graphicsQuality defaults to 'high' (matching the original default pass configuration).
 */
export const SettingsSchema = Schema.Struct({
  /** Chunk render distance in chunks. Default: 8. Must be in [2, 16]. */
  renderDistance: Schema.Number.pipe(Schema.finite(), Schema.between(2, 16)),
  /** Mouse sensitivity multiplier. Default: 0.5. Must be in [0.1, 3.0]. */
  mouseSensitivity: Schema.Number.pipe(Schema.finite(), Schema.between(0.1, 3.0)),
  /** Day length in seconds. Default: 400. Must be in [120, 1200]. */
  dayLengthSeconds: Schema.Number.pipe(Schema.finite(), Schema.between(120, 1200)),
  /** Graphics quality preset. Replaces individual post-processing toggles. Default: 'high'. */
  graphicsQuality: Schema.optionalWith(GraphicsQuality, { default: () => 'high' as const }),
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
  graphicsQuality: 'high',
  audioEnabled: true,
  masterVolume: 0.8,
  sfxVolume: 1.0,
  musicVolume: 0.55,
}

const STORAGE_KEY = 'minecraft-settings'

// Schema.decodeUnknown returns Effect<Settings, ParseError> — no Effect.try wrapper needed
const loadFromStorage: Effect.Effect<Settings, never, never> =
  Effect.sync(() => Option.fromNullable(typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null)).pipe(
    Effect.flatMap((rawOpt) =>
      Option.match(rawOpt, {
        onNone: () => Effect.succeed(DEFAULT_SETTINGS),
        onSome: (rawStr) =>
          Effect.try({
            try: () => JSON.parse(rawStr),
            catch: (e) => new SettingsError({ operation: 'load', cause: e }),
          }).pipe(
            Effect.flatMap((parsed) => Schema.decodeUnknown(SettingsSchema)(parsed).pipe(
              Effect.mapError((e) => new SettingsError({ operation: 'load', cause: e }))
            ))
          ),
      })
    ),
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
    effect: loadFromStorage.pipe(
      Effect.flatMap((initialSettings) => Ref.make<Settings>(initialSettings)),
      Effect.map((settingsRef) => ({
        getSettings: () => Ref.get(settingsRef),

        // Schema.decodeUnknown returns Effect<Settings, ParseError> — no Effect.try wrapper needed
        updateSettings: (partial: Partial<Settings>) =>
          Ref.get(settingsRef).pipe(
            Effect.flatMap((current) => {
              const merged = { ...current, ...partial }
              return Schema.decodeUnknown(SettingsSchema)(merged).pipe(
                Effect.catchAllCause((cause) =>
                  Effect.logWarning(`Settings validation failed, keeping previous settings: ${Cause.pretty(cause)}`).pipe(
                    Effect.as(current)
                  )
                ),
                Effect.flatMap((result) =>
                  Effect.all([
                    Ref.set(settingsRef, result),
                    saveToStorage(result),
                  ], { concurrency: 'unbounded', discard: true })
                )
              )
            })
          ),

        resetToDefaults: () =>
          Ref.set(settingsRef, DEFAULT_SETTINGS).pipe(
            Effect.andThen(saveToStorage(DEFAULT_SETTINGS))
          ),
    }))),
  }
) {}

export const SettingsServiceLive = SettingsService.Default
