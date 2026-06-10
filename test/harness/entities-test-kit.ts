import { Effect, Option } from 'effect'

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
  getPlayerContactDamage: (_playerPosition: unknown) => Effect.succeed(0),
  update: (_deltaTime: unknown, _playerPosition: unknown) => Effect.void,
  applyDamage: (_entityId: unknown, _amount: unknown) => Effect.succeed(Option.none()),
  applyKnockback: (_entityId: unknown, _impulse: unknown) => Effect.void,
  despawnAllEntities: () => Effect.succeed(0),
  // Stub that exercises the collision-resolver callback (so isBlockSolid in entity-update-stage runs)
  applyPhysics: (_dt: unknown, resolver: unknown) => {
    const resolve = resolver as (pos: { x: number; y: number; z: number }, vel: { x: number; y: number; z: number }) => unknown
    resolve({ x: 0, y: 64, z: 0 }, { x: 0, y: 0, z: 0 })
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
  toggleTorch: (_position: unknown) => Effect.succeed(Option.none()),
  getPowerAt: (_position: unknown) => Effect.succeed(0),
  getPowerSnapshot: () => Effect.succeed({ tick: 0, poweredPositions: [] }),
  tick: () => Effect.succeed({ tick: 0, poweredPositions: [] }),
}) as unknown as InstanceType<typeof import('@ts-minecraft/entity').RedstoneService>
