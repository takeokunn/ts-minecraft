import { Array as Arr, Option, Schema } from 'effect'
import { TILE_MAP } from './block-texture-map.config'

export { TILE_MAP }
export const FaceDirSchema = Schema.Literal('top', 'bottom', 'side')
export type FaceDir = Schema.Schema.Type<typeof FaceDirSchema>

export const ATLAS_COLS = 16
export const ATLAS_SIZE = 512
export const HALF_TEXEL = 0.5 / ATLAS_SIZE

export const getTileIndex = (blockId: number, faceDir: FaceDir): number =>
  Option.getOrElse(Option.map(Arr.get(TILE_MAP, blockId), (entry) => entry[faceDir]), () => 0)

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
