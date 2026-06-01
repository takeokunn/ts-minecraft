import { Effect } from 'effect'

/** Creates a terrain block service fake for break/place operations. */
export const makeBlockService = () => ({
  breakBlock: (_pos: unknown) => Effect.void,
  placeBlock: (_pos: unknown, _type: unknown, _slot?: unknown) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/world').BlockService>

/** Creates a chunk manager fake with no loaded or dirty chunks by default. */
export const makeChunkManagerService = () => ({
  loadChunksAroundPlayer: (_pos: unknown) => Effect.void,
  getLoadedChunks: () => Effect.succeed([]),
  drainRenderDirtyChunks: () => Effect.succeed([]),
  // FR-4.2: AABB-aware drain — defaults to empty so existing tests behave unchanged.
  drainRenderDirtyChunkEntries: () => Effect.succeed([]),
  getChunk: (_coord: unknown) => Effect.succeed({ coord: { x: 0, z: 0 }, blocks: new Uint8Array(0), dirty: false }),
}) as unknown as InstanceType<typeof import('@ts-minecraft/world').ChunkManagerService>

/** Creates an inert fluid simulation service fake. */
export const makeFluidService = () => ({
  notifyBlockChanged: (_position: unknown) => Effect.void,
  seedWater: (_position: unknown) => Effect.void,
  removeWater: (_position: unknown) => Effect.void,
  syncLoadedChunks: (_chunks: unknown) => Effect.void,
  tick: () => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/world').FluidService>
