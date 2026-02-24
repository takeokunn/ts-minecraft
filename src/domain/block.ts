import { Schema } from 'effect'
import { BlockIdSchema } from '@/shared/kernel'

export { BlockIdSchema }

export const BlockTypeSchema = Schema.Literal(
  'AIR',
  'DIRT',
  'STONE',
  'WOOD',
  'GRASS',
  'SAND'
)
export type BlockType = Schema.Schema.Type<typeof BlockTypeSchema>

export const BlockPropertiesSchema = Schema.Struct({
  hardness: Schema.Number.pipe(Schema.between(0, 100)),
  transparency: Schema.Boolean,
  solid: Schema.Boolean,
  emissive: Schema.Boolean,
  friction: Schema.Number.pipe(Schema.between(0, 1)),
})
export type BlockProperties = Schema.Schema.Type<typeof BlockPropertiesSchema>

export const BlockFaceSchema = Schema.Struct({
  top: Schema.Boolean,
  bottom: Schema.Boolean,
  north: Schema.Boolean,
  south: Schema.Boolean,
  east: Schema.Boolean,
  west: Schema.Boolean,
})
export type BlockFace = Schema.Schema.Type<typeof BlockFaceSchema>

export const BlockSchema = Schema.Struct({
  id: BlockIdSchema,
  type: BlockTypeSchema,
  properties: BlockPropertiesSchema,
  faces: BlockFaceSchema,
})
export type Block = Schema.Schema.Type<typeof BlockSchema>
