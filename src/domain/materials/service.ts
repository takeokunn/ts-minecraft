import { Context, Duration, Effect, Option } from 'effect'
import type { BlockId, BurnTime, ItemId, ItemStack, Material, MaterialError, MaterialEvent, Tool } from './types'

export interface MaterialService {
  readonly getMaterial: (blockId: BlockId) => Effect.Effect<Material, MaterialError>
  readonly canHarvest: (material: Material, tool: Option.Option<Tool>) => Effect.Effect<boolean, MaterialError>
  readonly miningTime: (
    material: Material,
    tool: Option.Option<Tool>
  ) => Effect.Effect<Duration.Duration, MaterialError>
  readonly drops: (
    material: Material,
    tool: Option.Option<Tool>,
    fortune: number
  ) => Effect.Effect<ReadonlyArray<ItemStack>, MaterialError>
  readonly burnTime: (itemId: ItemId) => Effect.Effect<Option.Option<BurnTime>, never>
  readonly harvest: (
    blockId: BlockId,
    tool: Option.Option<Tool>,
    fortune: number
  ) => Effect.Effect<MaterialEvent['Harvested'], MaterialError>
}

export const MaterialService = Context.GenericTag<MaterialService>('@minecraft/materials/MaterialService')
