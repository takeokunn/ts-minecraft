import { Effect, HashMap, Option } from 'effect'
import * as THREE from 'three'
import { DEFAULT_SETTINGS, type CameraMode, type CameraStateStub } from './shared'

/** Creates a furnace service fake with no active or nearby furnace state. */
export const makeFurnaceService = () => ({
  getState: () => Effect.succeed({ active: Option.none() }),
  getNearestFurnaceState: () => Effect.succeed(Option.none()),
  hasNearbyFurnace: () => Effect.succeed(false),
  setSelectedFurnace: (_position: unknown) => Effect.void,
  startSmelting: (_recipeId: unknown) => Effect.void,
  collectOutput: () => Effect.succeed(true),
  clearFurnace: (_position: unknown) => Effect.succeed([]),
  dismantleFurnace: (_position: unknown) => Effect.succeed(true),
  serialize: () => Effect.succeed([]),
  deserialize: (_serialized: unknown) => Effect.void,
  tick: (_deltaTime: unknown) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/inventory').FurnaceService>

export const makeChestService = () => ({
  getState: () => Effect.succeed({ chests: HashMap.empty(), selectedChestPosition: Option.none() }),
  getNearestChestState: () => Effect.succeed(Option.none()),
  hasNearbyChest: () => Effect.succeed(false),
  setSelectedChest: (_position: unknown) => Effect.void,
  moveInventoryStackToChestSlot: (_inventoryIndex: unknown, _chestIndex: unknown) => Effect.void,
  moveChestStackToInventorySlot: (_chestIndex: unknown, _inventoryIndex: unknown) => Effect.void,
  quickMoveInventoryToChest: (_inventoryIndex: unknown) => Effect.void,
  quickMoveChestToInventory: (_chestIndex: unknown) => Effect.void,
  clearChest: (_position: unknown) => Effect.succeed([]),
  dismantleChest: (_position: unknown) => Effect.succeed(true),
  serialize: () => Effect.succeed([]),
  deserialize: (_serialized: unknown) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/inventory').ChestService>

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
  tick: (_canRegen: unknown) => Effect.succeed('none' as const),
  reset: () => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/entity').HungerService>

/** Creates an XP service fake fixed at level zero. */
export const makeXPService = () => ({
  getXP: () => Effect.succeed({ totalXP: 0, level: 0, xpIntoLevel: 0, xpRequiredForNext: 7 }),
  addXP: (_amount: unknown) => Effect.succeed({ totalXP: 0, level: 0, xpIntoLevel: 0, xpRequiredForNext: 7 }),
  setTotalXP: (_totalXP: unknown) => Effect.void,
  spendLevels: (_levels: unknown) => Effect.succeed({ totalXP: 0, level: 0, xpIntoLevel: 0, xpRequiredForNext: 7 }),
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

/** Creates an empty dropped item service fake. */
export const makeDroppedItemService = () => ({
  spawn: (_input: unknown) => Effect.succeed({
    id: 'fake-dropped-item',
    itemType: 'DIRT',
    count: 1,
    position: { x: 0, y: 64, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    ageTicks: 0,
    pickupDelayTicks: 0,
  }),
  getAll: () => Effect.succeed([]),
  collectWithin: (_playerPosition: unknown) => Effect.succeed([]),
  tick: (_ageDeltaTicks?: unknown) => Effect.void,
  reset: () => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/entity').DroppedItemService>

/** Creates an empty dropped XP orb service fake. */
export const makeDroppedXpOrbService = () => ({
  spawn: (_input: unknown) => Effect.succeed({
    id: 'fake-dropped-xp-orb',
    amount: 1,
    position: { x: 0, y: 64, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    ageTicks: 0,
    pickupDelayTicks: 0,
  }),
  getAll: () => Effect.succeed([]),
  collectWithin: (_playerPosition: unknown) => Effect.succeed([]),
  tick: (_ageDeltaTicks?: unknown) => Effect.void,
  reset: () => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/entity').DroppedXpOrbService>

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
  getMoonPhase: () => Effect.succeed(0),
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

/** Creates an empty entity manager fake. */
export const makeEntityManager = () => ({
  addEntity: (_type: unknown, _position: unknown) => Effect.succeed('entity-1' as unknown),
  removeEntity: (_entityId: unknown) => Effect.succeed(false),
  getEntity: (_entityId: unknown) => Effect.succeed(Option.none()),
  getEntities: () => Effect.succeed([]),
  getEntityAIState: (_entityId: unknown) => Effect.succeed(Option.none()),
  getCount: () => Effect.succeed(0),
  getStructureVersion: () => Effect.succeed(0),
  drainBirths: () => Effect.succeed(0),
  drainExplosions: () => Effect.succeed([]),
  getPlayerContactDamage: (_playerPosition: unknown) => Effect.succeed(0),
  getPlayerRangedDamage: (_playerPosition: unknown, _isProjectileBlocked?: unknown) => Effect.succeed(0),
  update: (_deltaTime: unknown, _playerPosition: unknown) => Effect.void,
  applyDamage: (_entityId: unknown, _amount: unknown) => Effect.succeed(Option.none()),
  igniteEntity: (_entityId: unknown, _durationSecs: unknown) => Effect.succeed(false),
  applyKnockback: (_entityId: unknown, _impulse: unknown) => Effect.void,
  feedEntity: (_entityId: unknown) => Effect.succeed(false),
  shearEntity: (_entityId: unknown) => Effect.succeed(Option.none()),
  despawnAllEntities: () => Effect.succeed(0),
  despawnFarEntities: (_playerPosition: unknown, _maxDistance: unknown) => Effect.succeed(0),
  // Stub that exercises the collision-resolver callback (so isBlockSolid in entity-update-stage runs).
  // The resolver is the output-parameter form: (outPos, outVel, pos, vel) => isGrounded.
  applyPhysics: (_dt: unknown, resolver: unknown) => {
    const resolve = resolver as (
      outPos: { x: number; y: number; z: number },
      outVel: { x: number; y: number; z: number },
      pos: { x: number; y: number; z: number },
      vel: { x: number; y: number; z: number },
    ) => unknown
    resolve({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 64, z: 0 }, { x: 0, y: 0, z: 0 })
    return Effect.void
  },
}) as unknown as InstanceType<typeof import('@ts-minecraft/entity').EntityManager>

/** Creates a mob spawner fake that never spawns mobs. */
export const makeMobSpawner = () => ({
  trySpawn: (_playerPosition: unknown) => Effect.succeed(Option.none()),
  getSpawnBounds: () => Effect.succeed({ minDistance: 16, maxDistance: 40 }),
  getMaxPopulation: () => Effect.succeed(24),
}) as unknown as InstanceType<typeof import('@ts-minecraft/entity').MobSpawner>

/** Creates a village service fake with one generated village and no active villagers. */
export const makeVillageService = () => ({
  ensureVillageNear: (_playerPosition: unknown) => Effect.succeed({ villageId: 'village-1', center: { x: 0, y: 64, z: 0 }, structures: [], villagers: [] }),
  getVillages: () => Effect.succeed([]),
  getVillagers: () => Effect.succeed([]),
  getVillager: (_villagerId: unknown) => Effect.succeed(Option.none()),
  findNearestVillager: (_position: unknown, _maxDistance: unknown) => Effect.succeed(Option.none()),
  addVillagerExperience: (_villagerId: unknown, _amount: unknown) => Effect.succeed(Option.none()),
  update: (_playerPosition: unknown, _timeOfDay: unknown, _deltaTime: unknown) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/entity').VillageService>

/** Creates a redstone service fake with inactive wire defaults. */
export const makeRedstoneService = () => ({
  setComponent: (_position: unknown, _type: unknown) => Effect.succeed({ type: 'wire', position: { x: 0, y: 0, z: 0 }, state: { active: false, buttonTicksRemaining: 0, pistonExtended: false } }),
  removeComponent: (_position: unknown) => Effect.void,
  getComponent: (_position: unknown) => Effect.succeed(Option.none()),
  getComponents: () => Effect.succeed([]),
  toggleLever: (_position: unknown) => Effect.succeed(Option.none()),
  pressButton: (_position: unknown, _durationTicks?: unknown) => Effect.succeed(Option.none()),
  setPressurePlatePressed: (_position: unknown, _pressed: unknown) => Effect.succeed(Option.none()),
  toggleTorch: (_position: unknown) => Effect.succeed(Option.none()),
  getPowerAt: (_position: unknown) => Effect.succeed(0),
  getPowerSnapshot: () => Effect.succeed({ tick: 0, poweredPositions: [] }),
  tick: () => Effect.succeed({ tick: 0, poweredPositions: [] }),
}) as unknown as InstanceType<typeof import('@ts-minecraft/entity').RedstoneService>
