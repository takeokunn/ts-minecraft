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
  Effect.gen(function* () {
    /* c8 ignore next */
    const rawOpt = yield* Effect.sync(() => Option.fromNullable(typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null))
    const rawStr = Option.getOrNull(rawOpt)
    if (rawStr === null) return DEFAULT_SETTINGS
    const parsed = yield* Effect.try({
      try: () => JSON.parse(rawStr),
      catch: (e) => new SettingsError({ operation: 'load', cause: e }),
    })
    // Merge stored values OVER defaults before decoding so a payload
    // written by an older app version (missing fields added since)
    // keeps the user's other settings instead of resetting everything.
    // decodeUnknown still validates: out-of-range or wrong-typed stored
    // values override the default, fail the schema, and fall through to
    // DEFAULT_SETTINGS below — same as before. Only the MISSING-field
    // case is rescued. Mirrors the merge in updateSettings. Non-object
    // payloads (string/number/array) bypass the merge so they fail decode.
    const decoded = yield* Schema.decodeUnknown(SettingsSchema)(
      /* c8 ignore next -- branches for null/array/non-object JSON; invalid-JSON test covers fallback */
      typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? { ...DEFAULT_SETTINGS, ...parsed }
        : parsed
    ).pipe(Effect.mapError((e) => new SettingsError({ operation: 'load', cause: e })))
    return forceAudioOff(decoded)
  }).pipe(
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
    effect: Effect.gen(function* () {
      const env = yield* EnvironmentPort
      const isLocalhost = yield* env.isLocalhost
      const forceAudioOff = makeForceAudioOff(isLocalhost)
      const initialSettings = yield* loadFromStorage(forceAudioOff)
      const settingsRef = yield* Ref.make<Settings>(initialSettings)
      return {
        getSettings: () => Ref.get(settingsRef),

        // Schema.decodeUnknown returns Effect<Settings, ParseError> — no Effect.try wrapper needed
        updateSettings: (partial: Partial<Settings>) =>
          Effect.gen(function* () {
            const current = yield* Ref.get(settingsRef)
            const merged = { ...current, ...partial }
            const result = yield* Schema.decodeUnknown(SettingsSchema)(merged).pipe(
              Effect.catchAllCause((cause) =>
                Effect.gen(function* () {
                  yield* Effect.logWarning(`Settings validation failed, keeping previous settings: ${Cause.pretty(cause)}`)
                  return current
                })
              ),
            )
            yield* Effect.all([
              Ref.set(settingsRef, result),
              saveToStorage(result),
            ], { concurrency: 'unbounded', discard: true })
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
