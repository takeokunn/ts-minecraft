import { Context, Duration, Effect, Option } from 'effect'
import { BlockId, BurnTime, ItemId, ItemStack, Material, MaterialNotFoundError, Tool } from './types'

export interface MaterialService {
  readonly getMaterial: (blockId: BlockId) => Effect.Effect<Material, MaterialNotFoundError>

  readonly calculateMiningTime: (
    material: Material,
    tool: Option.Option<Tool>
  ) => Effect.Effect<Duration.Duration, never>

  readonly getDrops: (
    material: Material,
    tool: Option.Option<Tool>,
    fortuneLevel: number
  ) => Effect.Effect<ReadonlyArray<ItemStack>, never>

  readonly canHarvest: (material: Material, tool: Option.Option<Tool>) => Effect.Effect<boolean, never>

  readonly getBurnTime: (itemId: ItemId) => Effect.Effect<Option.Option<BurnTime>, never>
}

export const MaterialService = Context.GenericTag<MaterialService>('@minecraft/domain/MaterialService')
