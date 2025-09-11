import * as S from "@effect/schema/Schema"
import { blockTypeNames } from '@/core/values/block-type'
import { Effect } from 'effect'

export const BlockDefinitionSchema = S.Struct({
  textures: S.Struct({
    top: S.optional(S.Tuple(S.Number, S.Number)),
    bottom: S.optional(S.Tuple(S.Number, S.Number)),
    side: S.Tuple(S.Number, S.Number),
  }),
  isTransparent: S.Boolean,
  isFluid: S.Boolean,
})
export type BlockDefinition = S.Schema.Type<typeof BlockDefinitionSchema>

const BlockDefinitionsSchema = S.Struct(
  Object.fromEntries(
    blockTypeNames.map((name) => [name, BlockDefinitionSchema]),
  ),
)
export type BlockDefinitions = S.Schema.Type<typeof BlockDefinitionsSchema>

export const blockDefinitions: BlockDefinitions = Effect.runSync(S.decodeUnknown(
  BlockDefinitionsSchema,
)({
  air: { textures: { side: [0, 0] }, isTransparent: true, isFluid: false }, // Note: air doesn't have a real texture
  grass: { textures: { top: [7, 0], bottom: [5, 0], side: [6, 0] }, isTransparent: false, isFluid: false },
  dirt: { textures: { side: [3, 0] }, isTransparent: false, isFluid: false },
  stone: { textures: { side: [15, 0] }, isTransparent: false, isFluid: false },
  cobblestone: { textures: { side: [1, 0] }, isTransparent: false, isFluid: false },
  oakLog: { textures: { top: [12, 0], bottom: [10, 0], side: [11, 0] }, isTransparent: false, isFluid: false },
  oakLeaves: { textures: { side: [8, 0] }, isTransparent: true, isFluid: false }, // Using non-transparent for now
  sand: { textures: { side: [14, 0] }, isTransparent: false, isFluid: false },
  water: { textures: { side: [9, 0] }, isTransparent: true, isFluid: true }, // Assuming water has a texture, placeholder
  glass: { textures: { side: [4, 0] }, isTransparent: true, isFluid: false },
  brick: { textures: { side: [0, 0] }, isTransparent: false, isFluid: false },
  plank: { textures: { side: [13, 0] }, isTransparent: false, isFluid: false },
} as const))
