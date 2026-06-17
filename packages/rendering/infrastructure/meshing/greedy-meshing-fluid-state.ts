import { Option } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/core'
import {
  decodeFluidByte,
  maxLevelFor,
  type FluidCell,
  type FluidType,
} from '@ts-minecraft/block'
import { AIR } from './greedy-meshing-types'
import { getBlock } from './greedy-meshing-ao'
import { dequantLight } from './greedy-meshing-passes'

const WATER_BLOCK_ID = blockTypeToIndex('WATER')
const LAVA_BLOCK_ID = blockTypeToIndex('LAVA')
type FluidRenderState = Readonly<{
  readonly blockId: number
  readonly type: FluidType
  readonly height: number
}>

export const isFluidBlockId = (blockId: number): boolean => blockId === WATER_BLOCK_ID || blockId === LAVA_BLOCK_ID

const fluidTypeForBlockId = (blockId: number): FluidType => blockId === LAVA_BLOCK_ID ? 'lava' : 'water'

const fluidArrayIndex = (lx: number, y: number, lz: number): number =>
  y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

const fluidHeightForCell = (cell: FluidCell): number => {
  if (cell.source) return 1
  const maxLevel = maxLevelFor(cell.type)
  return Math.max(1 / (maxLevel + 1), 1 - cell.level / (maxLevel + 1))
}

export const resolveFluidState = (
  blocks: Readonly<Uint8Array>,
  fluid: Readonly<Uint8Array<ArrayBufferLike>>,
  lx: number,
  y: number,
  lz: number,
): FluidRenderState | null => {
  if (lx < 0 || lx >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) {
    return null
  }

  const blockId = getBlock(blocks, lx, y, lz)
  if (!isFluidBlockId(blockId)) {
    return null
  }

  const type = fluidTypeForBlockId(blockId)
  const cell = Option.getOrNull(decodeFluidByte(fluid[fluidArrayIndex(lx, y, lz)] as number))
  if (cell === null || cell.type !== type) {
    return null
  }

  return {
    blockId,
    type,
    height: fluidHeightForCell(cell),
  }
}

const fluidSurfaceHeightForColumn = (
  blocks: Readonly<Uint8Array>,
  fluid: Readonly<Uint8Array<ArrayBufferLike>>,
  type: FluidType,
  lx: number,
  y: number,
  lz: number,
): number | null => {
  const here = resolveFluidState(blocks, fluid, lx, y, lz)
  if (here === null || here.type !== type) return null

  const above = resolveFluidState(blocks, fluid, lx, y + 1, lz)
  return above !== null && above.type === type ? 1 : here.height
}

const fluidCornerHeightForCell = (
  blocks: Readonly<Uint8Array>,
  fluid: Readonly<Uint8Array<ArrayBufferLike>>,
  current: FluidRenderState,
  lx: number,
  y: number,
  lz: number,
  cornerX: 0 | 1,
  cornerZ: 0 | 1,
): number => {
  let heightSum = 0
  let sampleCount = 0

  for (let sx = lx + cornerX - 1; sx <= lx + cornerX; sx++) {
    for (let sz = lz + cornerZ - 1; sz <= lz + cornerZ; sz++) {
      const height = fluidSurfaceHeightForColumn(blocks, fluid, current.type, sx, y, sz)
      if (height !== null) {
        heightSum += height
        sampleCount++
      }
    }
  }

  return heightSum / sampleCount
}

export const fluidTopCornerYsForCell = (
  blocks: Readonly<Uint8Array>,
  fluid: Readonly<Uint8Array<ArrayBufferLike>>,
  current: FluidRenderState,
  lx: number,
  y: number,
  lz: number,
): readonly [number, number, number, number] => [
  y + fluidCornerHeightForCell(blocks, fluid, current, lx, y, lz, 0, 0),
  y + fluidCornerHeightForCell(blocks, fluid, current, lx, y, lz, 0, 1),
  y + fluidCornerHeightForCell(blocks, fluid, current, lx, y, lz, 1, 1),
  y + fluidCornerHeightForCell(blocks, fluid, current, lx, y, lz, 1, 0),
]

// A neighbour occludes a fluid face only when it is TRULY opaque — not air, not
// another fluid, and not a transparent-solid block (GLASS/LEAVES). Water behind
// glass (aquariums) must still show its surface and sides, so glass/leaves are
// not occluders here. Mirrors isSolidFaceExposed on the solid-block side.
export const isFluidFaceOccluder = (blockId: number, transparentSolidLookup: Uint8Array): boolean =>
  blockId !== AIR && !isFluidBlockId(blockId) && transparentSolidLookup[blockId] === 0

// Face exposure for the six solid passes (opaque + transparent-solid sources).
// A face is exposed when the neighbour is AIR. Additionally, an OPAQUE source
// block exposes its face through a transparent-solid neighbour (GLASS, LEAVES):
// otherwise the opaque surface behind the glass/leaves would show a see-through
// hole. Transparent-solid SOURCE blocks keep air-only exposure, so adjacent
// same-type panes still cull their shared face (no internal double faces /
// z-fighting). Fluid neighbours are deliberately treated as occluders here —
// fluid surfaces are meshed by the dedicated fluid pass, which owns that
// boundary, so routing opaque faces through them would double-render.
export const isSolidFaceExposed = (
  blocks: Readonly<Uint8Array>,
  sourceBlockId: number,
  transparentSolidLookup: Uint8Array,
  nx: number,
  ny: number,
  nz: number,
): boolean => {
  const neighborId = getBlock(blocks, nx, ny, nz)
  if (neighborId === AIR) return true
  if (transparentSolidLookup[sourceBlockId] !== 0) return false
  return transparentSolidLookup[neighborId] !== 0
}

export const decodeFaceLighting = (
  c0: number,
  c1: number,
  c2: number,
  c3: number,
): Readonly<{
  readonly sky: readonly [number, number, number, number]
  readonly block: readonly [number, number, number, number]
}> => ({
  sky: [
    dequantLight((c0 >> 6) & 0x3),
    dequantLight((c1 >> 6) & 0x3),
    dequantLight((c2 >> 6) & 0x3),
    dequantLight((c3 >> 6) & 0x3),
  ],
  block: [
    dequantLight((c0 >> 2) & 0x3),
    dequantLight((c1 >> 2) & 0x3),
    dequantLight((c2 >> 2) & 0x3),
    dequantLight((c3 >> 2) & 0x3),
  ],
})
