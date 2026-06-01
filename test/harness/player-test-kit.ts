import { Effect, Option } from 'effect'
import * as THREE from 'three'
import type { CameraMode, CameraStateStub } from './shared-test-kit'

/** Creates a mutable player camera state fake and exposes its backing state for assertions. */
export const makeCameraState = (initialMode: CameraMode = 'firstPerson') => {
  const state: CameraStateStub = { mode: initialMode }

  const service = {
    getRotation: () => Effect.succeed({ yaw: 0, pitch: 0 }),
    getMode: () => Effect.sync(() => state.mode),
    setYaw: (_yaw: number) => Effect.void,
    setPitch: (_pitch: number) => Effect.void,
    addYaw: (_delta: number) => Effect.void,
    addPitch: (_delta: number) => Effect.void,
    setMode: (mode: CameraMode) => Effect.sync(() => { state.mode = mode }),
    toggleMode: () => Effect.sync(() => { state.mode = state.mode === 'firstPerson' ? 'thirdPerson' : 'firstPerson' }),
    reset: () => Effect.sync(() => { state.mode = 'firstPerson' }),
  } as unknown as InstanceType<typeof import('@ts-minecraft/entity').PlayerCameraStateService>

  return { service, state }
}

/** Creates a no-op first-person camera updater fake. */
export const makeFirstPersonCamera = () => ({
  update: (_cam: unknown) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/entity').FirstPersonCameraService>

/** Creates a third-person camera updater fake that preserves the original positioning behavior. */
export const makeThirdPersonCamera = () => ({
  update: (camera: THREE.PerspectiveCamera, playerPos: { x: number; y: number; z: number }, eyeLevelOffset = 0.72) =>
    Effect.sync(() => {
      const distance = 4
      const shoulderHeight = 1.5
      const eyeY = playerPos.y + eyeLevelOffset
      camera.position.set(playerPos.x, eyeY + shoulderHeight, playerPos.z - distance)
      camera.lookAt(playerPos.x, eyeY, playerPos.z)
    }),
}) as unknown as InstanceType<typeof import('@ts-minecraft/entity').ThirdPersonCameraService>

/** Creates a stable full-health player health service fake. */
export const makeHealthService = () => ({
  getHealth: () => Effect.succeed({ current: 20, max: 20, invincibilityTicks: 0 }),
  applyDamage: (_amount: unknown) => Effect.void,
  heal: (_amount: unknown) => Effect.void,
  isDead: () => Effect.succeed(false),
  tick: () => Effect.void,
  processFallDamage: (_y: unknown, _grounded: unknown) => Effect.succeed(0),
  reset: () => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/entity').HealthService>

/** Creates a neutral hunger service fake that never starves or regenerates incidentally. */
export const makeHungerService = () => ({
  getHunger: () => Effect.succeed({ foodLevel: 20, saturation: 5, exhaustion: 0 }),
  addExhaustion: (_amount: unknown) => Effect.void,
  eat: (_food: unknown, _saturationModifier: unknown) => Effect.void,
  tick: () => Effect.succeed('none' as const),
  reset: () => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/entity').HungerService>

/** Creates an XP service fake fixed at level zero. */
export const makeXPService = () => ({
  getXP: () => Effect.succeed({ totalXP: 0, level: 0, xpIntoLevel: 0, xpRequiredForNext: 7 }),
  addXP: (_amount: unknown) => Effect.succeed({ totalXP: 0, level: 0, xpIntoLevel: 0, xpRequiredForNext: 7 }),
  setTotalXP: (_totalXP: unknown) => Effect.void,
  reset: () => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/entity').XPService>

/** Creates an inert fishing service fake. */
export const makeFishingService = () => ({
  cast: (_seed: unknown) => Effect.void,
  tick: (_deltaSecs: unknown) => Effect.succeed(Option.none()),
  cancel: () => Effect.void,
  isFishing: () => Effect.succeed(false),
  getProgress: () => Effect.succeed(0),
  reset: () => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/entity').FishingService>
