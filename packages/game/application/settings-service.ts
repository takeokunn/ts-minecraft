import { Cause, Effect, Option, Ref, Schema } from 'effect'
import { SettingsError } from '../domain/errors'
import { EnvironmentPort } from '@ts-minecraft/core'
import { GraphicsQuality, ResolvedGraphicsSchema, SettingsSchema } from './settings.schema'
import type { Settings } from './settings.schema'

export type { Settings }
export type { ResolvedGraphics } from './settings.schema'
export { GraphicsQuality, ResolvedGraphicsSchema, SettingsSchema }
export { resolvePreset } from './settings-service.config'

const DEFAULT_SETTINGS: Settings = {
  renderDistance: 4,
  mouseSensitivity: 0.5,
  dayLengthSeconds: 400,
  graphicsQuality: 'medium',
  adaptivePerformanceMode: true,
  // NOTE: false intentionally — audio is disabled by default (see Schema comment above).
  audioEnabled: false,
  masterVolume: 0.8,
  sfxVolume: 1.0,
  musicVolume: 0.55,
}

const STORAGE_KEY = 'minecraft-settings'

const makeForceAudioOff = (isLocalhost: boolean) => (settings: Settings): Settings =>
  /* c8 ignore next */
  isLocalhost ? { ...settings, audioEnabled: false } : settings

// Schema.decodeUnknown returns Effect<Settings, ParseError> — no Effect.try wrapper needed
const loadFromStorage = (forceAudioOff: (settings: Settings) => Settings): Effect.Effect<Settings, never, never> =>
  /* c8 ignore next */
  Effect.sync(() => Option.fromNullable(typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null)).pipe(
    Effect.flatMap((rawOpt) =>
      Option.match(rawOpt, {
        onNone: () => Effect.succeed(DEFAULT_SETTINGS),
        onSome: (rawStr) =>
          Effect.try({
            try: () => JSON.parse(rawStr),
            catch: (e) => new SettingsError({ operation: 'load', cause: e }),
          }).pipe(
            // Merge stored values OVER defaults before decoding so a payload
            // written by an older app version (missing fields added since)
            // keeps the user's other settings instead of resetting everything.
            // decodeUnknown still validates: out-of-range or wrong-typed stored
            // values override the default, fail the schema, and fall through to
            // DEFAULT_SETTINGS below — same as before. Only the MISSING-field
            // case is rescued. Mirrors the merge in updateSettings. Non-object
            // payloads (string/number/array) bypass the merge so they fail decode.
            Effect.flatMap((parsed) => Schema.decodeUnknown(SettingsSchema)(
              /* c8 ignore next -- branches for null/array/non-object JSON; invalid-JSON test covers fallback */
              typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
                ? { ...DEFAULT_SETTINGS, ...parsed }
                : parsed
            ).pipe(
              Effect.mapError((e) => new SettingsError({ operation: 'load', cause: e })),
              Effect.map(forceAudioOff),
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
