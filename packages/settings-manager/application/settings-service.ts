import { Cause, Effect, Option, Ref, Schema } from 'effect'
import { GRAPHICS_PRESETS } from './settings-service.config'
import { SettingsError } from '@ts-minecraft/domain'
import { EnvironmentPort } from '../domain/environment-port'

// Replaces individual post-processing toggles; each level maps to a fixed combination of pass enable states via resolvePreset().
export const GraphicsQuality = Schema.Literal('low', 'medium', 'high', 'ultra')
export type GraphicsQuality = Schema.Schema.Type<typeof GraphicsQuality>

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
  refractionThrottleFrames: Schema.Number.pipe(Schema.int(), Schema.between(0, 5)),
  pixelRatioCap: Schema.Number.pipe(Schema.finite(), Schema.between(0.5, 2)),
})
export type ResolvedGraphics = Schema.Schema.Type<typeof ResolvedGraphicsSchema>

export const resolvePreset = (quality: GraphicsQuality): ResolvedGraphics =>
  GRAPHICS_PRESETS[quality]

// Old localStorage data with individual post-processing booleans (shadowsEnabled, ssaoEnabled etc.) is silently migrated —
// the booleans are ignored and graphicsQuality defaults to 'low'.
export const SettingsSchema = Schema.Struct({
  renderDistance: Schema.Number.pipe(Schema.finite(), Schema.between(2, 16)),
  mouseSensitivity: Schema.Number.pipe(Schema.finite(), Schema.between(0.1, 3.0)),
  dayLengthSeconds: Schema.Number.pipe(Schema.finite(), Schema.between(120, 1200)),
  graphicsQuality: Schema.optionalWith(GraphicsQuality, { default: () => 'low' as const }),
  adaptivePerformanceMode: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  // NOTE: audioEnabled defaults to false intentionally — do NOT change this to true.
  // Audio is disabled by default because it causes noise during development and testing.
  // Users can enable it via the settings UI.
  audioEnabled: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  masterVolume: Schema.optionalWith(Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)), { default: () => 0.8 }),
  sfxVolume: Schema.optionalWith(Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)), { default: () => 1.0 }),
  musicVolume: Schema.optionalWith(Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)), { default: () => 0.55 }),
})
export type Settings = Schema.Schema.Type<typeof SettingsSchema>

const DEFAULT_SETTINGS: Settings = {
  renderDistance: 2,
  mouseSensitivity: 0.5,
  dayLengthSeconds: 400,
  graphicsQuality: 'low',
  adaptivePerformanceMode: true,
  // NOTE: false intentionally — audio is disabled by default (see Schema comment above).
  audioEnabled: false,
  masterVolume: 0.8,
  sfxVolume: 1.0,
  musicVolume: 0.55,
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const clampNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

const clampInteger = (value: unknown, fallback: number, min: number, max: number): number =>
  Math.round(clampNumber(value, fallback, min, max))

const isGraphicsQuality = (value: unknown): value is GraphicsQuality =>
  value === 'low' || value === 'medium' || value === 'high' || value === 'ultra'

const sanitizeLegacySettings = (parsed: unknown): Settings => {
  const record = isRecord(parsed) ? parsed : {}

  return {
    renderDistance: clampInteger(record['renderDistance'], DEFAULT_SETTINGS.renderDistance, 2, 16),
    mouseSensitivity: clampNumber(record['mouseSensitivity'], DEFAULT_SETTINGS.mouseSensitivity, 0.1, 3),
    dayLengthSeconds: clampInteger(record['dayLengthSeconds'], DEFAULT_SETTINGS.dayLengthSeconds, 120, 1200),
    graphicsQuality: isGraphicsQuality(record['graphicsQuality']) ? record['graphicsQuality'] : DEFAULT_SETTINGS.graphicsQuality,
    adaptivePerformanceMode: typeof record['adaptivePerformanceMode'] === 'boolean' ? record['adaptivePerformanceMode'] : DEFAULT_SETTINGS.adaptivePerformanceMode,
    audioEnabled: typeof record['audioEnabled'] === 'boolean' ? record['audioEnabled'] : DEFAULT_SETTINGS.audioEnabled,
    masterVolume: clampNumber(record['masterVolume'], DEFAULT_SETTINGS.masterVolume, 0, 1),
    sfxVolume: clampNumber(record['sfxVolume'], DEFAULT_SETTINGS.sfxVolume, 0, 1),
    musicVolume: clampNumber(record['musicVolume'], DEFAULT_SETTINGS.musicVolume, 0, 1),
  }
}

const STORAGE_KEY = 'minecraft-settings'

const makeForceAudioOff = (isLocalhost: boolean) => (settings: Settings): Settings =>
  isLocalhost ? { ...settings, audioEnabled: false } : settings

// Schema.decodeUnknown returns Effect<Settings, ParseError> — no Effect.try wrapper needed
const loadFromStorage = (forceAudioOff: (settings: Settings) => Settings): Effect.Effect<Settings, never, never> =>
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
              Effect.mapError((e) => new SettingsError({ operation: 'load', cause: e })),
              Effect.map(forceAudioOff),
              Effect.catchAll(() =>
                Effect.sync(() => forceAudioOff(sanitizeLegacySettings(parsed))).pipe(
                  Effect.flatMap((settings) => saveToStorage(settings).pipe(Effect.as(settings)))
                )
              )
            ))
          ),
      })
    ),
    Effect.tapError((e) => Effect.logWarning(`Settings load failed, using defaults: ${e.message}`)),
    Effect.catchAllCause(() => Effect.succeed(forceAudioOff(DEFAULT_SETTINGS)))
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
    effect: Effect.flatMap(EnvironmentPort, (env) => env.isLocalhost).pipe(
      Effect.map(makeForceAudioOff),
      Effect.flatMap((forceAudioOff) => loadFromStorage(forceAudioOff)),
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
