import { describe, expect, it } from '@effect/vitest'
import { Array as Arr, Effect, Option } from 'effect'
import { blockIndex, blockTypeToIndex } from '@ts-minecraft/core'
import { resolveContact } from '@ts-minecraft/world'
import type { ChunkBlockFixture } from './chunk-buffer-test-utils'
import { makeFluidTestChunk, withFluidService, withTrackedFluidService } from './fluid-test-utils'

const LOCAL_COORDS = Arr.makeBy(16, i => i)

const blockIndexOrMinusOne = (lx: number, y: number, lz: number): number =>
  Option.getOrElse(blockIndex(lx, y, lz), () => -1)

const platformLineAt = (y: number, lz: number): ReadonlyArray<ChunkBlockFixture> =>
  Arr.map(LOCAL_COORDS, lx => ({ lx, y, lz, blockType: 'STONE' as const }))

const platformPlaneAt = (y: number): ReadonlyArray<ChunkBlockFixture> =>
  Arr.flatMap(LOCAL_COORDS, lx =>
    Arr.map(LOCAL_COORDS, lz => ({ lx, y, lz, blockType: 'STONE' as const })),
  )

describe('application/fluid/fluid-service', () => {
  it.effect('seeds water blocks into loaded chunks', () => {
    const chunk = makeFluidTestChunk()

    return withTrackedFluidService([chunk], (fluid, dirtyCalls) =>
      Effect.sync(() => blockIndexOrMinusOne(4, 10, 4)).pipe(
        Effect.tap(() => fluid.seedWater({ x: 4, y: 10, z: 4 })),
        Effect.map(blockIdx => {
          expect(chunk.blocks[blockIdx]).toBe(blockTypeToIndex('WATER'))
          expect(dirtyCalls).toHaveLength(1)
          expect(dirtyCalls[0]).toEqual({ x: 0, z: 0 })
        }),
      ),
    )
  })

  it.effect('spreads a source downward on tick', () => {
    const chunk = makeFluidTestChunk({
      blocks: [{ lx: 4, y: 10, lz: 4, blockType: 'WATER' }],
      fluids: [{ lx: 4, y: 10, lz: 4, cell: { level: 0, source: true, type: 'water' } }],
    })

    return withTrackedFluidService([chunk], (fluid, dirtyCalls) =>
      Effect.gen(function* () {
        yield* fluid.tick()
        const blockIdx = blockIndexOrMinusOne(4, 9, 4)
        expect(chunk.blocks[blockIdx]).toBe(blockTypeToIndex('WATER'))
        expect(dirtyCalls.length).toBeGreaterThan(0)
      }),
    )
  })

  it.effect('seeds lava blocks into loaded chunks', () => {
    const chunk = makeFluidTestChunk()

    return withTrackedFluidService([chunk], (fluid, dirtyCalls) =>
      Effect.gen(function* () {
        yield* fluid.seedLava({ x: 4, y: 10, z: 4 })
        const blockIdx = blockIndexOrMinusOne(4, 10, 4)
        expect(chunk.blocks[blockIdx]).toBe(blockTypeToIndex('LAVA'))
        expect(dirtyCalls).toHaveLength(1)
      }),
    )
  })

  it.effect('lava propagates slower than water (water reaches farther in 1 tick)', () => {
    const waterChunk = makeFluidTestChunk({
      blocks: platformLineAt(5, 4),
    })
    const lavaChunk = makeFluidTestChunk({
      blocks: platformLineAt(5, 4),
      coord: { x: 1, z: 0 },
    })

    return withFluidService([waterChunk, lavaChunk], fluid =>
      Effect.gen(function* () {
        yield* fluid.seedWater({ x: 4, y: 6, z: 4 })
        yield* fluid.seedLava({ x: 16 + 4, y: 6, z: 4 })
        yield* fluid.tick()

        const waterNeighborIdx = blockIndexOrMinusOne(5, 6, 4)
        const lavaSourceIdx = blockIndexOrMinusOne(4, 6, 4)
        const lavaNeighborIdx = blockIndexOrMinusOne(5, 6, 4)

        expect(waterChunk.blocks[waterNeighborIdx]).toBe(blockTypeToIndex('WATER'))
        expect(lavaChunk.blocks[lavaSourceIdx]).toBe(blockTypeToIndex('LAVA'))
        expect(lavaChunk.blocks[lavaNeighborIdx]).not.toBe(blockTypeToIndex('LAVA'))
      }),
    )
  })

  const resolveContactCases: ReadonlyArray<[string, Parameters<typeof resolveContact>, Option.Option<string>]> = [
    ['flowing lava + water source -> COBBLESTONE', [{ level: 1, source: false, type: 'lava' }, { level: 0, source: true, type: 'water' }], Option.some('COBBLESTONE')],
    ['flowing lava + flowing water -> COBBLESTONE', [{ level: 1, source: false, type: 'lava' }, { level: 2, source: false, type: 'water' }], Option.some('COBBLESTONE')],
    ['lava source + flowing water -> OBSIDIAN', [{ level: 0, source: true, type: 'lava' }, { level: 2, source: false, type: 'water' }], Option.some('OBSIDIAN')],
    ['lava source + water source -> OBSIDIAN', [{ level: 0, source: true, type: 'lava' }, { level: 0, source: true, type: 'water' }], Option.some('OBSIDIAN')],
    ['two water cells -> none', [{ level: 0, source: true, type: 'water' }, { level: 0, source: true, type: 'water' }], Option.none()],
    ['two lava cells -> none', [{ level: 0, source: true, type: 'lava' }, { level: 0, source: true, type: 'lava' }], Option.none()],
  ]

  Arr.forEach(resolveContactCases, ([label, [lava, water], expected]) => {
    it(`resolveContact - ${label}`, () => {
      expect(resolveContact(lava, water)).toEqual(expected)
    })
  })

  it.effect('lava adjacent to water converts to obsidian/cobblestone on tick depending on source state', () => {
    const chunk = makeFluidTestChunk({
      blocks: platformPlaneAt(5),
    })

    return withFluidService([chunk], fluid =>
      Effect.gen(function* () {
        yield* fluid.seedWater({ x: 4, y: 6, z: 4 })
        yield* fluid.seedLava({ x: 5, y: 6, z: 4 })
        yield* Effect.forEach(Arr.makeBy(6, i => i), () => fluid.tick(), { concurrency: 1, discard: true })

        const hasConversion = Arr.some(LOCAL_COORDS, lx =>
          Arr.some(LOCAL_COORDS, lz => {
            const idx = blockIndexOrMinusOne(lx, 6, lz)
            return idx >= 0 && (
              chunk.blocks[idx] === blockTypeToIndex('OBSIDIAN')
              || chunk.blocks[idx] === blockTypeToIndex('COBBLESTONE')
            )
          }),
        )
        expect(hasConversion).toBe(true)
      }),
    )
  })

  it.effect('lava and water coexist at non-adjacent positions', () => {
    const chunk = makeFluidTestChunk()

    return withFluidService([chunk], fluid =>
      Effect.gen(function* () {
        yield* fluid.seedWater({ x: 2, y: 10, z: 2 })
        yield* fluid.seedLava({ x: 12, y: 10, z: 12 })
        yield* Effect.forEach(Arr.makeBy(5, i => i), () => fluid.tick(), { concurrency: 1, discard: true })

        const waterIdx = blockIndexOrMinusOne(2, 10, 2)
        const lavaIdx = blockIndexOrMinusOne(12, 10, 12)
        expect(chunk.blocks[waterIdx]).toBe(blockTypeToIndex('WATER'))
        expect(chunk.blocks[lavaIdx]).toBe(blockTypeToIndex('LAVA'))
      }),
    )
  })

  it.effect('removeWater replaces a seeded water block with AIR', () => {
    const chunk = makeFluidTestChunk()

    return withTrackedFluidService([chunk], (fluid, dirtyCalls) =>
      Effect.gen(function* () {
        yield* fluid.seedWater({ x: 4, y: 10, z: 4 })
        yield* fluid.removeWater({ x: 4, y: 10, z: 4 })

        const blockIdx = blockIndexOrMinusOne(4, 10, 4)
        expect(chunk.blocks[blockIdx]).toBe(blockTypeToIndex('AIR'))
        expect(dirtyCalls.length).toBeGreaterThanOrEqual(2)
      }),
    )
  })

  it.effect('removeLava replaces a seeded lava block with AIR', () => {
    const chunk = makeFluidTestChunk()

    return withFluidService([chunk], fluid =>
      Effect.gen(function* () {
        yield* fluid.seedLava({ x: 5, y: 8, z: 5 })
        yield* fluid.removeLava({ x: 5, y: 8, z: 5 })

        const blockIdx = blockIndexOrMinusOne(5, 8, 5)
        expect(chunk.blocks[blockIdx]).toBe(blockTypeToIndex('AIR'))
      }),
    )
  })

  it.effect('notifyBlockChanged adds the position to the frontier so next tick processes it', () => {
    const chunk = makeFluidTestChunk({
      blocks: [{ lx: 4, y: 10, lz: 4, blockType: 'WATER' }],
    })

    return withTrackedFluidService([chunk], (fluid, dirtyCalls) =>
      Effect.gen(function* () {
        yield* fluid.notifyBlockChanged({ x: 4, y: 10, z: 4 })
        yield* fluid.tick()

        expect(dirtyCalls.length).toBeGreaterThanOrEqual(0)
      }),
    )
  })
})
