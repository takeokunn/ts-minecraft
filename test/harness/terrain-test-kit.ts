import { Effect } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'

const EMPTY_CHUNK_BLOCKS = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)

/** Creates a terrain block service fake for break/place operations. */
export const makeBlockService = () => ({
  breakBlock: (_pos: unknown) => Effect.void,
  placeBlock: (_pos: unknown, _type: unknown, _slot?: unknown) => Effect.void,
  forceSetBlock: (_pos: unknown, _type: unknown) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/world').BlockService>

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
