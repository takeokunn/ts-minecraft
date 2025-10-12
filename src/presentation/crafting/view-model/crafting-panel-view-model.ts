/**
 * @fileoverview クラフティングパネルViewModel
 * レシピ検索とレイアウト更新をEffect並列実行で統合し、プレゼンテーション用Viewを生成する。
 */

import type { RecipeAggregate } from '@/domain/crafting/aggregate'
import { PatternMatchingService, RecipeDiscoveryService, RecipeRegistryService } from '@/domain/crafting/domain_service'
import type { CraftingGrid, ItemTag } from '@/domain/crafting/types'
import { Context, Effect, Fiber, Layer, Option } from 'effect'
import type { CraftingGridView, CraftingPanelView, CraftingResultView, CraftingSlotView } from '../types'

export interface CraftingPanelRenderParams {
  readonly grid: CraftingGrid
  readonly ownedTags?: ReadonlyArray<ItemTag>
}

export interface CraftingPanelViewModel {
  readonly render: (params: CraftingPanelRenderParams) => Effect.Effect<CraftingPanelView>
}

export const CraftingPanelViewModelTag = Context.GenericTag<CraftingPanelViewModel>(
  '@minecraft/presentation/crafting/CraftingPanelViewModel'
)

const emptyTags: ReadonlyArray<ItemTag> = []

const toSlotView = (slot: CraftingGrid['slots'][number]): CraftingSlotView =>
  slot._tag === 'OccupiedSlot'
    ? {
        coordinate: slot.coordinate,
        itemId: slot.stack.itemId,
        itemName: slot.stack.metadata?.displayName,
        quantity: Number(slot.stack.quantity),
      }
    : {
        coordinate: slot.coordinate,
      }

const toGridView = (grid: CraftingGrid): CraftingGridView => ({
  width: Number(grid.width),
  height: Number(grid.height),
  slots: grid.slots.map(toSlotView),
})

const highlightGrid = (grid: CraftingGridView): CraftingGridView => ({
  ...grid,
  slots: grid.slots.map((slot) =>
    typeof slot.itemId === 'string'
      ? {
          ...slot,
          highlighted: true,
        }
      : slot
  ),
})

const toResultView = (aggregate: RecipeAggregate): CraftingResultView => {
  const { recipe } = aggregate
  const result = recipe.result
  const description = recipe.description ?? aggregate.metadata.notes
  const base: CraftingResultView = {
    itemId: result.itemId,
    itemName: result.metadata?.displayName,
    quantity: Number(result.quantity),
  }
  return description ? { ...base, description } : base
}

export const CraftingPanelViewModelLive = Layer.effect(
  CraftingPanelViewModelTag,
  Effect.gen(function* () {
    const recipeRegistry = yield* RecipeRegistryService
    const recipeDiscovery = yield* RecipeDiscoveryService
    const patternMatching = yield* PatternMatchingService

    const render: CraftingPanelViewModel['render'] = ({ grid, ownedTags }) =>
      Effect.gen(function* () {
        const tags = ownedTags ?? emptyTags

        const recipeSearchEffect = Effect.gen(function* () {
          const registered = yield* recipeRegistry.list()
          const discoverable = yield* recipeDiscovery.discoverable(registered, tags)
          return yield* patternMatching.locateFirstMatch(discoverable, grid)
        })

        const layoutEffect = Effect.succeed(toGridView(grid))

        const recipeFiber = yield* Effect.fork(recipeSearchEffect)
        const layoutFiber = yield* Effect.fork(layoutEffect)

        const matchOutcome = yield* Fiber.join(recipeFiber)
        const baseGridView = yield* Fiber.join(layoutFiber)

        const aggregate = matchOutcome.aggregate
        const gridView = matchOutcome.matched ? highlightGrid(baseGridView) : baseGridView

        const panelView: CraftingPanelView = {
          grid: gridView,
          canCraft: matchOutcome.matched,
          recipeId: Option.match(aggregate, {
            onNone: () => undefined,
            onSome: (value) => value.id,
          }),
          result: Option.match(aggregate, {
            onNone: () => undefined,
            onSome: toResultView,
          }),
        }

        return panelView
      })

    return CraftingPanelViewModelTag.of({
      render,
    })
  })
)
