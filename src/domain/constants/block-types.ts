import * as S from 'effect/Schema'

export const BlockTypeSchema = S.Literal('air', 'grass', 'dirt', 'stone', 'cobblestone', 'oakLog', 'oakLeaves', 'sand', 'water', 'glass', 'brick', 'plank')
export type BlockType = S.Schema.Type<typeof BlockTypeSchema>
export const blockTypeNames: ReadonlyArray<BlockType> = BlockTypeSchema.literals
