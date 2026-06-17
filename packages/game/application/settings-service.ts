import { Cause, Effect, MutableRef, Option, Schema } from 'effect'
import { SettingsError } from '../domain/errors'
import { EnvironmentPort } from '@ts-minecraft/core'
import { GameDifficulty as GameDifficultySchema, GraphicsQuality, ResolvedGraphicsSchema, SettingsSchema } from './settings.schema'
import type { Settings } from './settings.schema'
import { applySettingsEnvironmentPolicy } from './settings-service-environment'
import { SettingsStoragePort } from '../domain/settings-storage-port'
export type { Settings }
export type { GameDifficulty, ResolvedGraphics } from './settings.schema'
export { GameDifficultySchema, GraphicsQuality, ResolvedGraphicsSchema, SettingsSchema }
export { resolvePreset } from './settings-service.config'

const DEFAULT_SETTINGS: Settings = {
  renderDistance: 3,
  mouseSensitivity: 0.5,
  dayLengthSeconds: 400,
  difficulty: 'normal',
  graphicsQuality: 'low',
  adaptivePerformanceMode: true,
  // NOTE: false intentionally — audio is disabled by default (see Schema comment above).
  audioEnabled: false,
  masterVolume: 0.8,
  sfxVolume: 1.0,
  musicVolume: 0.55,
}

const loadFromStorage = (storage: SettingsStoragePort, isLocalhost: boolean): Effect.Effect<Settings, never, never> =>
  Effect.gen(function* () {
    const storedSettings = yield* storage.loadSettings()
    if (Option.isNone(storedSettings)) return DEFAULT_SETTINGS
    const decoded = yield* Schema.decodeUnknown(SettingsSchema)(storedSettings.value).pipe(
      Effect.mapError((e) => new SettingsError({ operation: 'load', cause: e })),
    )
    return applySettingsEnvironmentPolicy(decoded, isLocalhost)
  }).pipe(
    Effect.tapError((e) => Effect.logWarning(`Settings load failed, using defaults: ${e.message}`)),
    Effect.catchAllCause(() => Effect.succeed(applySettingsEnvironmentPolicy(DEFAULT_SETTINGS, isLocalhost)))
  )

const saveToStorage = (storage: SettingsStoragePort, settings: Settings): Effect.Effect<void, never, never> =>
  storage.saveSettings(settings).pipe(Effect.catchAllCause(() => Effect.void))

export class SettingsService extends Effect.Service<SettingsService>()(
  '@minecraft/application/SettingsService',
  {
    effect: Effect.gen(function* () {
      const env = yield* EnvironmentPort
      const storage = yield* SettingsStoragePort
      const isLocalhost = yield* env.isLocalhost
      const initialSettings = yield* loadFromStorage(storage, isLocalhost)
      const settingsRef = MutableRef.make<Settings>(initialSettings)
      return {
        getSettings: () => Effect.sync(() => MutableRef.get(settingsRef)),

        // Schema.decodeUnknown returns Effect<Settings, ParseError> — no Effect.try wrapper needed
        updateSettings: (partial: Partial<Settings>) =>
          Effect.gen(function* () {
            const current = MutableRef.get(settingsRef)
            const merged = { ...current, ...partial }
            const result = yield* Schema.decodeUnknown(SettingsSchema)(merged).pipe(
              Effect.catchAllCause((cause) =>
                Effect.gen(function* () {
                  yield* Effect.logWarning(`Settings validation failed, keeping previous settings: ${Cause.pretty(cause)}`)
                  return current
                })
              ),
            )
            MutableRef.set(settingsRef, result)
            yield* saveToStorage(storage, result)
          }),

        resetToDefaults: () =>
          Effect.gen(function* () {
            MutableRef.set(settingsRef, DEFAULT_SETTINGS)
            yield* saveToStorage(storage, DEFAULT_SETTINGS)
          }),
      }
    }),
  }
) {}
