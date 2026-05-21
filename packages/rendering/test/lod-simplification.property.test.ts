import { describe, expect, it } from 'vitest'
import * as fc from 'fast-check'
import { Array as Arr, Option } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/kernel'
import type { Chunk } from '@ts-minecraft/terrain'
import { greedyMeshChunk, simplifyMesh, lodForDistance } from '@ts-minecraft/rendering'

const DIRT_ID = blockTypeToIndex('DIRT')

const blocksFromCoords = (coords: ReadonlyArray<readonly [number, number, number]>): Uint8Array => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  Arr.forEach(coords, ([lx, y, lz]) => {
    blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE] = DIRT_ID
  })
  return blocks
}

const arbCoord = fc.tuple(
  fc.integer({ min: 0, max: CHUNK_SIZE - 1 }),
  fc.integer({ min: 0, max: 30 }), // keep Y modest to avoid huge meshes
  fc.integer({ min: 0, max: CHUNK_SIZE - 1 }),
)

const arbBlocks = fc.array(arbCoord, { minLength: 1, maxLength: 30 }).map(blocksFromCoords)

const makeChunk = (blocks: Uint8Array): Chunk => ({
  coord: { x: 0, z: 0 },
  blocks,
  fluid: Option.none(),
})

describe('simplifyMesh — properties', () => {
  it('LOD simplification never grows the buffer (positions / indices)', () => {
    fc.assert(
      fc.property(arbBlocks, fc.constantFrom(1 as const, 2 as const), (blocks, lod) => {
        const meshed = greedyMeshChunk(makeChunk(blocks), { wx: 0, wz: 0 }).toMeshed().opaque
        const simplified = simplifyMesh(meshed, lod)
        expect(simplified.positions.length).toBeLessThanOrEqual(meshed.positions.length)
        expect(simplified.indices.length).toBeLessThanOrEqual(meshed.indices.length)
      }),
      { numRuns: 30 },
    )
  })

  it('quad / vertex / index counts stay aligned (4 verts per quad, 6 indices per quad)', () => {
    fc.assert(
      fc.property(arbBlocks, fc.constantFrom(0 as const, 1 as const, 2 as const), (blocks, lod) => {
        const meshed = greedyMeshChunk(makeChunk(blocks), { wx: 0, wz: 0 }).toMeshed().opaque
        const simplified = simplifyMesh(meshed, lod)
        expect(simplified.positions.length % 12).toBe(0)
        expect(simplified.indices.length % 6).toBe(0)
        expect(simplified.indices.length / 6).toBe(simplified.positions.length / 12)
      }),
      { numRuns: 30 },
    )
  })

  it('lodForDistance is monotonically non-decreasing in distance', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 32, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: 0, max: 32, noNaN: true, noDefaultInfinity: true }),
        (a, b) => {
          if (a <= b) {
            expect(lodForDistance(a)).toBeLessThanOrEqual(lodForDistance(b))
          } else {
            expect(lodForDistance(b)).toBeLessThanOrEqual(lodForDistance(a))
          }
        },
      ),
      { numRuns: 50 },
    )
  })
})
