import { Effect, Option } from 'effect'
import * as THREE from 'three'

/** Creates an empty inventory service fake. */
export const makeInventoryService = () => ({
  getAllSlots: () => Effect.succeed([]),
  getSlot: (_index: unknown) => Effect.succeed(Option.none()),
  setSlot: (_index: unknown, _stack: unknown) => Effect.void,
  damageSlot: (_index: unknown, _amount?: unknown) => Effect.void,
  repairMendingItemsWithXP: (amount: number) => Effect.succeed(amount),
  moveStack: (_from: unknown, _to: unknown) => Effect.void,
  addBlock: (_type: unknown, _count: unknown) => Effect.succeed(true),
  removeBlock: (_type: unknown, _count: unknown, _slot?: unknown) => Effect.succeed(true),
  getHotbarSlots: () => Effect.succeed([]),
  serialize: () => Effect.succeed({ slots: [] }),
  deserialize: (_data: unknown) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/inventory').InventoryService>

/** Creates an empty hotbar service fake with slot zero selected. */
export const makeHotbarService = () => ({
  update: () => Effect.void,
  getSlots: () => Effect.succeed([]),
  getSelectedSlot: () => Effect.succeed(0),
  getSelectedBlockType: () => Effect.succeed({ _tag: 'None' }),
}) as unknown as InstanceType<typeof import('@ts-minecraft/inventory').HotbarService>

/** Creates an equipment service fake with no equipped armor. */
export const makeEquipmentService = () => ({
  equip: (_stack: unknown) => Effect.succeed(false),
  unequipSlot: (_slot: unknown) => Effect.succeed(Option.none()),
  getEquippedItem: (_slot: unknown) => Effect.succeed(Option.none()),
  getAll: () => Effect.succeed({ HELMET: Option.none(), CHESTPLATE: Option.none(), LEGGINGS: Option.none(), BOOTS: Option.none() }),
  getTotalArmorPoints: () => Effect.succeed(0),
  getTotalProtectionReduction: () => Effect.succeed(0),
  getTotalProjectileProtectionReduction: () => Effect.succeed(0),
  getTotalBlastProtectionReduction: () => Effect.succeed(0),
  damageArmorSlot: (_slot: unknown, _amount?: unknown) => Effect.void,
  repairMendingItemsWithXP: (amount: number) => Effect.succeed(amount),
  serialize: () => Effect.succeed({}),
  deserialize: (_saved: unknown) => Effect.void,
  reset: () => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/inventory').EquipmentService>

/** Creates a world renderer fake with inert scene and water operations. */
export const makeWorldRendererService = () => ({
  syncChunksToScene: (_chunks: unknown, _scene: unknown) => Effect.succeed(true as boolean),
  applyFrustumCulling: (_camera: unknown) => Effect.void,
  updateChunkInScene: (_chunk: unknown, _scene: unknown) => Effect.void,
  clearScene: (_scene: unknown) => Effect.void,
  doRefractionPrePass: (_renderer: unknown, _scene: unknown, _camera: unknown) => Effect.void,
  updateWaterUniforms: (_time: number, _cameraPosition: unknown) => Effect.void,
  updateWaterResolution: (_width: number, _height: number) => Effect.void,
  resizeRefractionRT: (_width: number, _height: number) => Effect.void,
  resizeRefractionCamera: (_aspect: number) => Effect.void,
  getWaterMeshes: () => Effect.succeed([] as THREE.Mesh[]),
  getSceneVersion: () => Effect.succeed(0),
  setRefractionValid: (_valid: boolean) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/rendering').WorldRendererService>

/** Creates an entity renderer fake that tracks no scene groups. */
export const makeEntityRenderer = () => ({
  syncEntities: (_entities: unknown, _scene: unknown) => Effect.void,
  updateEntityTransforms: (_entities: unknown, _total: unknown, _delta: unknown) => Effect.void,
  clearScene: (_scene: unknown) => Effect.void,
  _getTrackedGroup: (_id: unknown) => Effect.succeed(Option.none()),
}) as unknown as InstanceType<typeof import('@ts-minecraft/rendering').EntityRendererService>

/** Creates a chunk mesh service fake for sunlight updates. */
export const makeChunkMeshService = () => ({
  setSunIntensity: (_value: number) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/rendering').ChunkMeshService>

/** Creates an inert particle system fake that avoids real InstancedMesh and texture setup. */
export const makeParticleSystem = () => ({
  attach: (_scene: unknown) => Effect.void,
  spawnBurst: (_x: number, _y: number, _z: number, _u: number, _v: number, _count?: number) => Effect.void,
  update: (_dtSecs: number) => Effect.void,
  getActiveCount: () => Effect.succeed(0),
}) as unknown as InstanceType<typeof import('@ts-minecraft/rendering').ParticleSystemService>

/** Creates a no-op performance HUD fake. */
export const makePerfHud = () => ({
  recordFrame: (_dtSecs: number) => Effect.void,
  setWorkerQueueDepth: (_n: number) => Effect.void,
  setChunkCount: (_n: number) => Effect.void,
  setDrawCalls: (_n: number) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/rendering').PerfHudService>

/** Creates a terrain block service fake for break/place operations. */
export const makeBlockService = () => ({
  breakBlock: (_pos: unknown) => Effect.void,
  placeBlock: (_pos: unknown, _type: unknown, _slot?: unknown) => Effect.void,
  forceSetBlock: (_pos: unknown, _type: unknown) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/world').BlockService>

const EMPTY_CHUNK_BLOCKS = new Uint8Array(16 * 16 * 256)

/** Creates a chunk manager fake with no loaded or dirty chunks by default. */
export const makeChunkManagerService = () => ({
  loadChunksAroundPlayer: (_pos: unknown) => Effect.void,
  getLoadedChunks: () => Effect.succeed([]),
  drainRenderDirtyChunks: () => Effect.succeed([]),
  // FR-4.2: AABB-aware drain — defaults to empty so existing tests behave unchanged.
  drainRenderDirtyChunkEntries: () => Effect.succeed([]),
  getChunk: (_coord: unknown) => Effect.succeed({ coord: { x: 0, z: 0 }, blocks: EMPTY_CHUNK_BLOCKS, dirty: false }),
  setActiveWorldId: (_worldId: unknown) => Effect.void,
  setActiveDimension: (_dim: unknown) => Effect.void,
  markChunkDirty: (_coord: unknown) => Effect.void,
  saveDirtyChunks: () => Effect.void,
  unloadChunk: (_coord: unknown) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/world').ChunkManagerService>

/** Creates an inert fluid simulation service fake. */
export const makeFluidService = () => ({
  notifyBlockChanged: (_position: unknown) => Effect.void,
  seedWater: (_position: unknown) => Effect.void,
  removeWater: (_position: unknown) => Effect.void,
  syncLoadedChunks: (_chunks: unknown) => Effect.void,
  tick: () => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/world').FluidService>

/** Creates an inert weather service fake for tests. */
export const makeWeatherService = () => ({
  getWeather: () => Effect.succeed('clear' as const),
  setWeather: (_w: unknown) => Effect.void,
  tick: (_dt: unknown) => Effect.succeed('clear' as const),
}) as unknown as InstanceType<typeof import('@ts-minecraft/game').WeatherService>

/** Creates an inert nether service fake for tests that don't exercise portal logic. */
export const makeNetherService = () => ({
  getDimension: () => Effect.succeed('overworld' as const),
  setDimension: (_dim: unknown) => Effect.void,
  registerPortal: (_pos: unknown, _dim: unknown) => Effect.void,
  getPortals: (_dim: unknown) => Effect.succeed([]),
}) as unknown as InstanceType<typeof import('@ts-minecraft/world').NetherService>

/** Creates an inert crop growth service fake (all crops unknown → ripe by default). */
export const makeCropGrowthService = () => ({
  plant: (_pos: unknown) => Effect.void,
  harvest: (_pos: unknown) => Effect.succeed(true),
  tickAll: () => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/world').CropGrowthService>
