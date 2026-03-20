import { Schema } from 'effect'

export const FaceDirSchema = Schema.Literal('top', 'bottom', 'side')
export type FaceDir = Schema.Schema.Type<typeof FaceDirSchema>

export const ATLAS_COLS = 16
export const ATLAS_SIZE = 512
export const HALF_TEXEL = 0.5 / ATLAS_SIZE

// Atlas tile index per blockId per face direction.
// Tile layout (16x16 grid, 16px tiles):
//   0: dirt       1: stone      2: wood_side  3: wood_top
//   4: grass_top  5: grass_side 6: sand       7: water
//   8: leaves     9: glass      10: snow      11: gravel
//   12: cobblestone
const TILE_MAP: ReadonlyArray<Readonly<Record<FaceDir, number>>> = [
  { top: 0, bottom: 0, side: 0 },    // 0: AIR (unused)
  { top: 0, bottom: 0, side: 0 },    // 1: DIRT
  { top: 1, bottom: 1, side: 1 },    // 2: STONE
  { top: 3, bottom: 3, side: 2 },    // 3: WOOD (log: top=rings, side=bark)
  { top: 4, bottom: 0, side: 5 },    // 4: GRASS (top=green, bottom=dirt, sides=grass_side)
  { top: 6, bottom: 6, side: 6 },    // 5: SAND
  { top: 7, bottom: 7, side: 7 },    // 6: WATER
  { top: 8, bottom: 8, side: 8 },    // 7: LEAVES
  { top: 9, bottom: 9, side: 9 },    // 8: GLASS
  { top: 10, bottom: 10, side: 10 }, // 9: SNOW
  { top: 11, bottom: 11, side: 11 }, // 10: GRAVEL
  { top: 12, bottom: 12, side: 12 }, // 11: COBBLESTONE
]

export const getTileIndex = (blockId: number, faceDir: FaceDir): number => {
  const entry = TILE_MAP[blockId]
  if (!entry) return 0
  return entry[faceDir]
}

export const getTileUVs = (
  tileIndex: number
): { u0: number; v0: number; u1: number; v1: number } => {
  const col = tileIndex % ATLAS_COLS
  const row = Math.floor(tileIndex / ATLAS_COLS)
  return {
    u0: col / ATLAS_COLS + HALF_TEXEL,
    v0: 1 - (row + 1) / ATLAS_COLS + HALF_TEXEL,
    u1: (col + 1) / ATLAS_COLS - HALF_TEXEL,
    v1: 1 - row / ATLAS_COLS - HALF_TEXEL,
  }
}
