import { Match } from 'effect'
import type { BlockId, ItemId, MaterialCategory } from './types'

export const getToolHarvestLevel = (material: MaterialCategory): number =>
  Match.value(material).pipe(
    Match.when('wood', () => 0),
    Match.when('stone', () => 1),
    Match.when('iron', () => 2),
    Match.when('gold', () => 0), // ゴールドは特殊
    Match.when('diamond', () => 3),
    Match.when('netherite', () => 4),
    Match.orElse(() => 0)
  )

export const blockIdToItemId = (blockId: BlockId): ItemId => blockId as unknown as ItemId // 実際にはより適切な変換が必要
