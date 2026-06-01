import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Option } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import type { MeshedChunk } from '@ts-minecraft/rendering'
import { greedyMeshChunk } from '@ts-minecraft/rendering'
import { createFluidBuffer, encodeFluidCell } from '@ts-minecraft/world'
import type { FluidCell } from '@ts-minecraft/world'
import {
  countFacesByNormal,
  findFirstFaceVertexWithNormal,
  makeChunkWithBlock,
  makeChunkWithBlocks,
  ZERO_COORD,
  ZERO_OFFSET,
} from './greedy-meshing-test-utils'

const WATER_BLOCK_ID = blockTypeToIndex('WATER')
const TRANSPARENT_IDS = new Set([WATER_BLOCK_ID])

const fluidIndex = (lx: number, y: number, lz: number): number =>
  y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

const setFluidCell = (
  fluid: Uint8Array,
  lx: number,
  y: number,
  lz: number,
  cell: FluidCell,
): void => {
  fluid[fluidIndex(lx, y, lz)] = encodeFluidCell(cell)
}

const topFaceHeights = (meshed: MeshedChunk): ReadonlyArray<number> => {
  const topFaceVertex = findFirstFaceVertexWithNormal(meshed.normals, 0, 1, 0)
  expect(topFaceVertex).toBeGreaterThanOrEqual(0)
  const baseIndex = topFaceVertex * 3
  return [
    meshed.positions[baseIndex + 1] ?? -1,
    meshed.positions[baseIndex + 4] ?? -1,
    meshed.positions[baseIndex + 7] ?? -1,
    meshed.positions[baseIndex + 10] ?? -1,
  ]
}

describe('greedyMeshChunk fluid-aware heights', () => {
  it('lowers flowing water top vertices from the full-height fallback', () => {
    const baseChunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'WATER')
    const fluid = createFluidBuffer()
    fluid[0] = encodeFluidCell({ level: 4, source: false, type: 'water' })
    const chunk = { ...baseChunk, fluid: Option.some(fluid) }

    const meshed = greedyMeshChunk(chunk, ZERO_OFFSET, TRANSPARENT_IDS).toMeshed()

    expect(meshed.water.positions.length).toBeGreaterThan(0)
    expect(countFacesByNormal(meshed.water.normals, 0, -1, 0)).toBe(0)
    topFaceHeights(meshed.water).forEach((height) => {
      expect(height).toBeCloseTo(0.5)
    })
  })

  it('keeps water at full height when no fluid byte is available', () => {
    const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'WATER')

    const meshed = greedyMeshChunk(chunk, ZERO_OFFSET, TRANSPARENT_IDS).toMeshed()

    topFaceHeights(meshed.water).forEach((height) => {
      expect(height).toBeCloseTo(1)
    })
  })

  it('keeps lava in the opaque mesh while applying fluid-aware height', () => {
    const baseChunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 0, 'LAVA')
    const fluid = createFluidBuffer()
    fluid[0] = encodeFluidCell({ level: 2, source: false, type: 'lava' })
    const chunk = { ...baseChunk, fluid: Option.some(fluid) }

    const meshed = greedyMeshChunk(chunk, ZERO_OFFSET, TRANSPARENT_IDS).toMeshed()

    expect(meshed.water.positions.length).toBe(0)
    expect(meshed.opaque.positions.length).toBeGreaterThan(0)
    expect(countFacesByNormal(meshed.opaque.normals, 0, -1, 0)).toBe(0)
    topFaceHeights(meshed.opaque).forEach((height) => {
      expect(height).toBeCloseTo(0.5)
    })
  })

  it('slopes a water top quad when an adjacent same-type cell is lower', () => {
    const baseChunk = makeChunkWithBlocks(ZERO_COORD, [
      { lx: 0, y: 0, lz: 0, blockType: 'WATER' },
      { lx: 1, y: 0, lz: 0, blockType: 'WATER' },
    ])
    const fluid = createFluidBuffer()
    setFluidCell(fluid, 1, 0, 0, { level: 4, source: false, type: 'water' })
    const chunk = { ...baseChunk, fluid: Option.some(fluid) }

    const meshed = greedyMeshChunk(chunk, ZERO_OFFSET, TRANSPARENT_IDS).toMeshed()
    const heights = topFaceHeights(meshed.water)

    expect(heights[0]).toBeCloseTo(1)
    expect(heights[1]).toBeCloseTo(1)
    expect(heights[2]).toBeCloseTo(0.75)
    expect(heights[3]).toBeCloseTo(0.75)
    expect(Math.min(...heights)).toBeLessThan(Math.max(...heights))
  })

  it('treats a same-type fluid column with fluid above as full height when averaging corners', () => {
    const baseChunk = makeChunkWithBlocks(ZERO_COORD, [
      { lx: 0, y: 0, lz: 0, blockType: 'WATER' },
      { lx: 1, y: 0, lz: 0, blockType: 'WATER' },
      { lx: 1, y: 1, lz: 0, blockType: 'WATER' },
    ])
    const fluid = createFluidBuffer()
    setFluidCell(fluid, 0, 0, 0, { level: 4, source: false, type: 'water' })
    setFluidCell(fluid, 1, 0, 0, { level: 4, source: false, type: 'water' })
    const chunk = { ...baseChunk, fluid: Option.some(fluid) }

    const meshed = greedyMeshChunk(chunk, ZERO_OFFSET, TRANSPARENT_IDS).toMeshed()
    const heights = topFaceHeights(meshed.water)

    expect(heights[0]).toBeCloseTo(0.5)
    expect(heights[1]).toBeCloseTo(0.5)
    expect(heights[2]).toBeCloseTo(0.75)
    expect(heights[3]).toBeCloseTo(0.75)
  })
})
