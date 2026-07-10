import type { InventoryItem } from '@ts-minecraft/core'
import type { Dimension } from '@ts-minecraft/world'
import type { EntityType } from '../mob/entity'

// Player lifetime counters — the raw material achievements evaluate against.
// Kept flat (no branded types) since these are cumulative tallies rather than
// domain identifiers, and per-type breakdowns are small (bounded by the
// BlockType/ItemType/EntityType literal unions).
export interface Statistics {
  readonly blocksMinedTotal: number
  readonly blocksMinedByType: Readonly<Partial<Record<InventoryItem, number>>>
  readonly mobsKilledTotal: number
  readonly mobsKilledByType: Readonly<Partial<Record<EntityType, number>>>
  readonly itemsCraftedTotal: number
  readonly itemsCraftedByType: Readonly<Partial<Record<InventoryItem, number>>>
  readonly dimensionsVisited: ReadonlyArray<Dimension>
}

export const INITIAL_STATISTICS: Statistics = {
  blocksMinedTotal: 0,
  blocksMinedByType: {},
  mobsKilledTotal: 0,
  mobsKilledByType: {},
  itemsCraftedTotal: 0,
  itemsCraftedByType: {},
  dimensionsVisited: [],
}

const incrementByType = <K extends string>(
  byType: Readonly<Partial<Record<K, number>>>,
  key: K,
): Readonly<Partial<Record<K, number>>> => ({
  ...byType,
  [key]: (byType[key] ?? 0) + 1,
})

export const recordBlockMined = (stats: Statistics, blockType: InventoryItem): Statistics => ({
  ...stats,
  blocksMinedTotal: stats.blocksMinedTotal + 1,
  blocksMinedByType: incrementByType(stats.blocksMinedByType, blockType),
})

export const recordMobKilled = (stats: Statistics, mobType: EntityType): Statistics => ({
  ...stats,
  mobsKilledTotal: stats.mobsKilledTotal + 1,
  mobsKilledByType: incrementByType(stats.mobsKilledByType, mobType),
})

export const recordItemCrafted = (stats: Statistics, itemType: InventoryItem): Statistics => ({
  ...stats,
  itemsCraftedTotal: stats.itemsCraftedTotal + 1,
  itemsCraftedByType: incrementByType(stats.itemsCraftedByType, itemType),
})

export const recordDimensionVisited = (stats: Statistics, dimension: Dimension): Statistics =>
  stats.dimensionsVisited.includes(dimension)
    ? stats
    : { ...stats, dimensionsVisited: [...stats.dimensionsVisited, dimension] }
