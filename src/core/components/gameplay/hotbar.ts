import * as S from 'effect/Schema'
import { BlockTypeSchema } from '@/domain/block-types'

/**
 * Hotbar Component - Player's hotbar inventory
 */

export const HotbarComponent = S.Struct({
  slots: S.Array(BlockTypeSchema),
  selectedIndex: S.Int.pipe(S.clamp(0, 8)), // 9 slots (0-8)
})

export type HotbarComponent = S.Schema.Type<typeof HotbarComponent>