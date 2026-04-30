import { describe, expect, it } from '@effect/vitest'
import { Array as Arr, Effect, Layer, Option } from 'effect'
import { ChunkManagerService } from '@/application/chunk/chunk-manager-service'
import { ChunkService, ChunkServiceLive, blockIndex, blockTypeToIndex, setBlockInChunk } from '@/domain/chunk'
import { encodeFluidCell } from '@/domain/fluid'
import { FluidService, FluidServiceLive, resolveContact } from './fluid-service'

const makeChunkManager = (loadedChunks: ReadonlyArray<{ coord: { x: number; z: number }; blocks: Uint8Array; fluid: Option.Option<Uint8Array> }>) => {
  const dirtyCalls: Array<{ x: number; z: number }> = []
  const layer = Layer.succeed(ChunkManagerService, {
    getLoadedChunks: () => Effect.succeed(loadedChunks),
    markChunkDirty: (coord: { x: number; z: number }) => Effect.sync(() => {
      dirtyCalls.push(coord)
    }),
  } satisfies Pick<ChunkManagerService, 'getLoadedChunks' | 'markChunkDirty'> as ChunkManagerService)

  return { layer, dirtyCalls }
}

describe('application/fluid/fluid-service', () => {
  it.effect('seeds water blocks into loaded chunks', () =>
    Effect.gen(function* () {
      const chunkService = yield* ChunkService
      const chunk = yield* chunkService.createChunk({ x: 0, z: 0 })

      const { layer: chunkManagerLayer, dirtyCalls } = makeChunkManager([chunk])
      const blockIdx = yield* Effect.gen(function* () {
        const fluid = yield* FluidService
        yield* fluid.seedWater({ x: 4, y: 10, z: 4 })
        return Option.getOrElse(blockIndex(4, 10, 4), () => -1)
      }).pipe(Effect.provide(FluidServiceLive.pipe(Layer.provide(chunkManagerLayer))))

      expect(chunk.blocks[blockIdx]).toBe(blockTypeToIndex('WATER'))
      expect(dirtyCalls).toHaveLength(1)
      expect(dirtyCalls[0]).toEqual({ x: 0, z: 0 })
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('spreads a source downward on tick', () =>
    Effect.gen(function* () {
      const chunkService = yield* ChunkService
      let chunk = yield* chunkService.createChunk({ x: 0, z: 0 })
      yield* setBlockInChunk(chunk, 4, 10, 4, 'WATER')
      const sourceIdx = Option.getOrElse(blockIndex(4, 10, 4), () => -1)
      const fluidBuffer = new Uint8Array(chunk.blocks.length)
      if (sourceIdx >= 0) {
        fluidBuffer[sourceIdx] = encodeFluidCell({ level: 0, source: true, type: 'water' })
      }
      chunk = { ...chunk, fluid: Option.some(fluidBuffer) } as typeof chunk

      const { layer: chunkManagerLayer, dirtyCalls } = makeChunkManager([chunk])
      const blockIdx = yield* Effect.gen(function* () {
        const fluid = yield* FluidService
        yield* fluid.syncLoadedChunks([chunk])
        yield* fluid.tick()
        return Option.getOrElse(blockIndex(4, 9, 4), () => -1)
      }).pipe(Effect.provide(FluidServiceLive.pipe(Layer.provide(chunkManagerLayer))))

      expect(chunk.blocks[blockIdx]).toBe(blockTypeToIndex('WATER'))
      expect(dirtyCalls.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('seeds lava blocks into loaded chunks', () =>
    Effect.gen(function* () {
      const chunkService = yield* ChunkService
      const chunk = yield* chunkService.createChunk({ x: 0, z: 0 })

      const { layer: chunkManagerLayer, dirtyCalls } = makeChunkManager([chunk])
      const blockIdx = yield* Effect.gen(function* () {
        const fluid = yield* FluidService
        yield* fluid.seedLava({ x: 4, y: 10, z: 4 })
        return Option.getOrElse(blockIndex(4, 10, 4), () => -1)
      }).pipe(Effect.provide(FluidServiceLive.pipe(Layer.provide(chunkManagerLayer))))

      expect(chunk.blocks[blockIdx]).toBe(blockTypeToIndex('LAVA'))
      expect(dirtyCalls).toHaveLength(1)
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('lava propagates slower than water (water reaches farther in 1 tick)', () =>
    Effect.gen(function* () {
      const chunkService = yield* ChunkService
      const waterChunk = yield* chunkService.createChunk({ x: 0, z: 0 })
      const lavaChunk = yield* chunkService.createChunk({ x: 1, z: 0 })

      // Carve AIR around each source to give room to flow horizontally.
      // Stack the source on top of a STONE platform at y=5.
      yield* Effect.forEach(Arr.makeBy(16, (i) => i), (lx) =>
        Effect.all([
          setBlockInChunk(waterChunk, lx, 5, 4, 'STONE'),
          setBlockInChunk(lavaChunk, lx, 5, 4, 'STONE'),
        ], { concurrency: 'unbounded', discard: true })
      , { concurrency: 1, discard: true })
      yield* setBlockInChunk(waterChunk, 4, 6, 4, 'WATER')
      yield* setBlockInChunk(lavaChunk, 4, 6, 4, 'LAVA')

      const { layer: chunkManagerLayer } = makeChunkManager([waterChunk, lavaChunk])

      yield* Effect.gen(function* () {
        const fluid = yield* FluidService
        yield* fluid.syncLoadedChunks([waterChunk, lavaChunk])
        yield* fluid.seedWater({ x: 4, y: 6, z: 4 })
        yield* fluid.seedLava({ x: 16 + 4, y: 6, z: 4 })
        // After a single tick: water should flow horizontally because below is STONE.
        // Lava ticks only on every 3rd tick — so after 1 tick, lava should not have moved yet.
        yield* fluid.tick()
      }).pipe(Effect.provide(FluidServiceLive.pipe(Layer.provide(chunkManagerLayer))))

      // Water source was at world x=4 in chunk {0,0}: local (4,6,4). Neighbor at local (5,6,4) in same chunk.
      const waterNeighborIdx = Option.getOrElse(blockIndex(5, 6, 4), () => -1)
      // Lava source world x=20 maps to chunk {1,0} local x=4. Neighbor world x=21 -> local x=5.
      const lavaSourceIdx = Option.getOrElse(blockIndex(4, 6, 4), () => -1)
      const lavaNeighborIdx = Option.getOrElse(blockIndex(5, 6, 4), () => -1)
      expect(waterChunk.blocks[waterNeighborIdx]).toBe(blockTypeToIndex('WATER'))
      // Lava source is preserved after tick
      expect(lavaChunk.blocks[lavaSourceIdx]).toBe(blockTypeToIndex('LAVA'))
      // Lava should NOT yet have spread to its neighbor on the first tick
      expect(lavaChunk.blocks[lavaNeighborIdx]).not.toBe(blockTypeToIndex('LAVA'))
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  const resolveContactCases: ReadonlyArray<[string, Parameters<typeof resolveContact>, Option.Option<string>]> = [
    ['flowing lava + water source → COBBLESTONE',  [{ level: 1, source: false, type: 'lava' }, { level: 0, source: true,  type: 'water' }], Option.some('COBBLESTONE')],
    ['flowing lava + flowing water → COBBLESTONE', [{ level: 1, source: false, type: 'lava' }, { level: 2, source: false, type: 'water' }], Option.some('COBBLESTONE')],
    ['lava source + flowing water → OBSIDIAN',     [{ level: 0, source: true,  type: 'lava' }, { level: 2, source: false, type: 'water' }], Option.some('OBSIDIAN')],
    ['lava source + water source → OBSIDIAN',      [{ level: 0, source: true,  type: 'lava' }, { level: 0, source: true,  type: 'water' }], Option.some('OBSIDIAN')],
    ['two water cells → none',                     [{ level: 0, source: true,  type: 'water'}, { level: 0, source: true,  type: 'water' }], Option.none()],
    ['two lava cells → none',                      [{ level: 0, source: true,  type: 'lava' }, { level: 0, source: true,  type: 'lava'  }], Option.none()],
  ]

  Arr.forEach(resolveContactCases, ([label, [lava, water], expected]) => {
    it(`resolveContact — ${label}`, () => {
      expect(resolveContact(lava, water)).toEqual(expected)
    })
  })

  it.effect('lava adjacent to water converts to obsidian/cobblestone on tick depending on source state', () =>
    Effect.gen(function* () {
      const chunkService = yield* ChunkService
      const chunk = yield* chunkService.createChunk({ x: 0, z: 0 })
      // Platform at y=5 so fluids do not fall.
      yield* Effect.forEach(Arr.makeBy(16, (i) => i), (lx) =>
        Effect.forEach(Arr.makeBy(16, (i) => i), (lz) =>
          setBlockInChunk(chunk, lx, 5, lz, 'STONE'), { concurrency: 1, discard: true })
      , { concurrency: 1, discard: true })
      // Seed water source at (4,6,4) and lava source at (5,6,4) — adjacent.
      yield* setBlockInChunk(chunk, 4, 6, 4, 'WATER')
      yield* setBlockInChunk(chunk, 5, 6, 4, 'LAVA')

      const { layer: chunkManagerLayer } = makeChunkManager([chunk])
      yield* Effect.gen(function* () {
        const fluid = yield* FluidService
        yield* fluid.syncLoadedChunks([chunk])
        yield* fluid.seedWater({ x: 4, y: 6, z: 4 })
        // Make lava FLOWING by placing it as a flowing cell from a source
        yield* fluid.seedLava({ x: 5, y: 6, z: 4 })
        // Need to tick several times so lava propagates to a flowing state before touching water
        // (on tick 3, lava is active). Also run many ticks so contact eventually triggers.
        yield* Effect.forEach(Arr.makeBy(6, (i) => i), () => fluid.tick(), { concurrency: 1, discard: true })
      }).pipe(Effect.provide(FluidServiceLive.pipe(Layer.provide(chunkManagerLayer))))

      // Either the contact produced OBSIDIAN (source lava) or COBBLESTONE (flowing lava)
      const indices = Arr.makeBy(16, (i) => i)
      const hasConversion = Arr.some(indices, (lx) =>
        Arr.some(indices, (lz) => {
          const idx = Option.getOrElse(blockIndex(lx, 6, lz), () => -1)
          if (idx < 0) return false
          return chunk.blocks[idx] === blockTypeToIndex('OBSIDIAN') || chunk.blocks[idx] === blockTypeToIndex('COBBLESTONE')
        })
      )
      expect(hasConversion).toBe(true)
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('lava and water coexist at non-adjacent positions', () =>
    Effect.gen(function* () {
      const chunkService = yield* ChunkService
      const chunk = yield* chunkService.createChunk({ x: 0, z: 0 })
      // Place sources far apart (x=2 vs x=12) so they do not interact.
      yield* setBlockInChunk(chunk, 2, 10, 2, 'WATER')
      yield* setBlockInChunk(chunk, 12, 10, 12, 'LAVA')

      const { layer: chunkManagerLayer } = makeChunkManager([chunk])
      yield* Effect.gen(function* () {
        const fluid = yield* FluidService
        yield* fluid.syncLoadedChunks([chunk])
        yield* fluid.seedWater({ x: 2, y: 10, z: 2 })
        yield* fluid.seedLava({ x: 12, y: 10, z: 12 })
        yield* Effect.forEach(Arr.makeBy(5, (i) => i), () => fluid.tick(), { concurrency: 1, discard: true })
      }).pipe(Effect.provide(FluidServiceLive.pipe(Layer.provide(chunkManagerLayer))))

      const waterIdx = Option.getOrElse(blockIndex(2, 10, 2), () => -1)
      const lavaIdx = Option.getOrElse(blockIndex(12, 10, 12), () => -1)
      expect(chunk.blocks[waterIdx]).toBe(blockTypeToIndex('WATER'))
      expect(chunk.blocks[lavaIdx]).toBe(blockTypeToIndex('LAVA'))
    }).pipe(Effect.provide(ChunkServiceLive))
  )
})
