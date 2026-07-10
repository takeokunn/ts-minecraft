import type { InventoryItem } from '@ts-minecraft/core'

export type EntityDrop = {
  readonly blockType: InventoryItem
  readonly count: number
  // Optional drop probability in (0,1]. Absent → always drops. The kill handler
  // rolls Math.random() per drop and skips it when the roll exceeds `chance`.
  readonly chance?: number
  // Optional upper bound for a uniform count..maxCount roll at kill time.
  readonly maxCount?: number
}

// Pure predicate: should this drop be included given a random roll in [0,1)?
// Drops without a `chance` always pass; chance-gated drops pass when roll < chance.
export const dropPasses = (drop: EntityDrop, roll: number): boolean =>
  drop.chance === undefined || roll < drop.chance
