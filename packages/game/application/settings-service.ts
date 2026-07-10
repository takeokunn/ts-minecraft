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

const DEFAULT_SETTINGS: Settings = {
  // Vanilla look: distance 3 puts the fog wall ~50 blocks out and washes the
  // whole scene milky; 5 matches the perf floor measured in the parity doc.
  renderDistance: 5,
  mouseSensitivity: 0.5,
  // Vanilla parity: a full Minecraft day/night cycle is 20 minutes. The old
  // 400s default hit dusk 100 seconds after a noon boot — brand-new players
  // met the night-mob roster before they had tools.
  dayLengthSeconds: 1200,
  difficulty: 'normal',
  reducedMotion: false,
  uiScale: 1,
  keyBindings: {},
  fov: 75,
  // 'low' renders at HALF resolution (pixelRatioCap 0.5) with no sky and no
  // shadows — a permanently blurry first impression. Medium is the balanced
  // default; adaptive mode still steps down on weak hardware.
  graphicsQuality: 'medium',
  adaptivePerformanceMode: true,
  // NOTE: false intentionally — audio is disabled by default (see Schema comment above).
  audioEnabled: false,
  masterVolume: 0.8,
  sfxVolume: 1.0,
  musicVolume: 0.55,
}

// Fresh-user defaults, seeded with the OS reduced-motion preference. Only
// applied when nothing is stored (or a decode fails) — once a user saves any
// settings, their explicit reducedMotion choice persists and wins over the OS.
const freshDefaults = (isLocalhost: boolean, prefersReducedMotion: boolean): Settings =>
  applySettingsEnvironmentPolicy(
    { ...DEFAULT_SETTINGS, reducedMotion: DEFAULT_SETTINGS.reducedMotion || prefersReducedMotion },
    isLocalhost,
  )

const loadFromStorage = (
  storage: SettingsStoragePort,
  isLocalhost: boolean,
  prefersReducedMotion: boolean,
): Effect.Effect<Settings, never, never> =>
  Effect.gen(function* () {
    const storedSettings = yield* storage.loadSettings()
    if (Option.isNone(storedSettings)) return freshDefaults(isLocalhost, prefersReducedMotion)
    const decoded = yield* Schema.decodeUnknown(SettingsSchema)(storedSettings.value).pipe(
      Effect.mapError((e) => new SettingsError({ operation: 'load', cause: e })),
    )
    return applySettingsEnvironmentPolicy(decoded, isLocalhost)
  }).pipe(
    Effect.tapError((e) => Effect.logWarning(`Settings load failed, using defaults: ${e.message}`)),
    Effect.catchAllCause(() => Effect.succeed(freshDefaults(isLocalhost, prefersReducedMotion)))
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
      const prefersReducedMotion = yield* env.prefersReducedMotion
      const initialSettings = yield* loadFromStorage(storage, isLocalhost, prefersReducedMotion)
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
