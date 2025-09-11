import * as S from 'effect/Schema'
import { RegisterComponent } from '../registry'

/**
 * TerrainBlock Component - Marks entity as a terrain block
 */

export const TerrainBlockComponent = RegisterComponent({
  id: 'terrainBlock',
  category: 'world',
  priority: 3,
})(S.Struct({}))

export type TerrainBlockComponent = S.Schema.Type<typeof TerrainBlockComponent>

/**
 * TargetBlock Component - Marks entity as a targetable block
 */
export const TargetBlockComponent = RegisterComponent({
  id: 'targetBlock',
  category: 'world',
  priority: 3,
})(S.Struct({}))

export type TargetBlockComponent = S.Schema.Type<typeof TargetBlockComponent>
