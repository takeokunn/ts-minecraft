import * as S from 'effect/Schema'

/**
 * TerrainBlock Component - Marks entity as a terrain block
 */

export const TerrainBlockComponent = S.Struct({})

export type TerrainBlockComponent = S.Schema.Type<typeof TerrainBlockComponent>

/**
 * TargetBlock Component - Marks entity as a targetable block
 */
export const TargetBlockComponent = S.Struct({})

export type TargetBlockComponent = S.Schema.Type<typeof TargetBlockComponent>