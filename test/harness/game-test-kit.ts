import { Effect, Option } from 'effect'
import { DEFAULT_SETTINGS } from './shared-test-kit'

/** Creates a survival game mode service fake. */
export const makeGameMode = () => ({
  get: () => Effect.succeed('survival' as const),
  set: (_mode: unknown) => Effect.void,
  isCreative: () => Effect.succeed(false),
  isSurvival: () => Effect.succeed(true),
  isSpectator: () => Effect.succeed(false),
}) as unknown as InstanceType<typeof import('@ts-minecraft/game').GameModeService>

/** Creates a game state service fake with the player at the default spawn height. */
export const makeGameState = () => ({
  getPlayerPosition: (_id: unknown) => Effect.succeed({ x: 0, y: 64, z: 0 }),
  update: (_dt: unknown) => Effect.void,
  respawn: (_position: unknown) => Effect.void,
  isPlayerGrounded: () => Effect.succeed(true),
}) as unknown as InstanceType<typeof import('@ts-minecraft/game').GameStateService>

/** Creates a time service fake pinned to midday using default settings. */
export const makeTimeService = () => ({
  advanceTick: (_dt: unknown) => Effect.void,
  getTimeOfDay: () => Effect.succeed(0.5),
  isNight: () => Effect.succeed(false),
  getDayLength: () => Effect.succeed(DEFAULT_SETTINGS.dayLengthSeconds),
  setDayLength: (_seconds: unknown) => Effect.void,
  setTimeOfDay: (_time: unknown) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/game').TimeService>

/** Creates a settings service fake backed by the default settings snapshot. */
export const makeSettingsService = () => ({
  getSettings: () => Effect.succeed({ ...DEFAULT_SETTINGS }),
  updateSettings: (_patch: unknown) => Effect.void,
  resetToDefaults: () => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/game').SettingsService>

/** Creates an enabled sound manager fake with default listener state. */
export const makeSoundManager = () => ({
  applySettings: (_settings: unknown) => Effect.void,
  setListenerPosition: (_position: unknown) => Effect.void,
  playEffect: (_effect: unknown, _options?: unknown) => Effect.void,
  getState: () => Effect.succeed({ enabled: true, masterVolume: 0.8, sfxVolume: 1, listenerPosition: { x: 0, y: 64, z: 0 } }),
}) as unknown as InstanceType<typeof import('@ts-minecraft/game').SoundManager>

/** Creates an enabled music manager fake with no current environment. */
export const makeMusicManager = () => ({
  applySettings: (_settings: unknown) => Effect.void,
  setEnvironment: (_environment: unknown) => Effect.void,
  updateFromContext: (_context: unknown) => Effect.void,
  stop: () => Effect.void,
  getCurrentEnvironment: () => Effect.succeed(Option.none()),
  getState: () => Effect.succeed({ enabled: true, masterVolume: 0.8, musicVolume: 0.55 }),
}) as unknown as InstanceType<typeof import('@ts-minecraft/game').MusicManager>
