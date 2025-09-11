import { Effect, Context, Layer } from 'effect'
import { EntityDomainService } from '/services/entity-domain.service'
import { WorldDomainService } from '/services/world-domain.service'

/**
 * UI Update Workflow Service
 * UI要素の更新を担当するワークフロー
 * Application層でUIの更新ロジックを管理
 */
export class UIUpdateWorkflow extends Context.Tag('UIUpdateWorkflow')<
  UIUpdateWorkflow,
  {
    readonly updatePlayerUI: (playerId: string) => Effect.Effect<void, Error>
    readonly updateWorldUI: () => Effect.Effect<void, Error>
    readonly updateHotbar: (playerId: string) => Effect.Effect<void, Error>
    readonly updateHealthBar: (playerId: string) => Effect.Effect<void, Error>
  }
>() {}

export const UIUpdateWorkflowLive = Layer.succeed(UIUpdateWorkflow, {
  updatePlayerUI: (playerId) =>
    Effect.gen(function* (_) {
      const entityService = yield* _(EntityDomainService)

      // Get player data
      const player = yield* _(entityService.getEntity(playerId))
      const position = yield* _(entityService.getEntityPosition(playerId))

      if (!player || !position) {
        yield* _(Effect.log(`Player ${playerId} not found for UI update`))
        return
      }

      // Update various UI components
      yield* _(UIUpdateWorkflow.updateHotbar(playerId))
      yield* _(UIUpdateWorkflow.updateHealthBar(playerId))

      yield* _(Effect.log(`Player UI updated for ${playerId}`))
    }),

  updateWorldUI: () =>
    Effect.gen(function* (_) {
      const worldService = yield* _(WorldDomainService)

      // Get world statistics for UI display
      const loadedChunks = yield* _(worldService.getLoadedChunks())

      // Update world statistics display
      yield* _(Effect.log(`World UI updated: ${loadedChunks.length} chunks loaded`))
    }),

  updateHotbar: (playerId) =>
    Effect.gen(function* (_) {
      const entityService = yield* _(EntityDomainService)

      // Get player inventory for hotbar
      const inventory = yield* _(entityService.getEntityInventory(playerId))

      if (!inventory) {
        yield* _(Effect.log(`No inventory found for player ${playerId}`))
        return
      }

      // Extract hotbar items (first 9 items typically)
      const hotbarItems = inventory.slice(0, 9)

      yield* _(Effect.log(`Hotbar updated for player ${playerId} with ${hotbarItems.length} items`))
    }),

  updateHealthBar: (playerId) =>
    Effect.gen(function* (_) {
      const entityService = yield* _(EntityDomainService)

      // Get player health
      const health = yield* _(entityService.getEntityHealth(playerId))

      if (health === undefined) {
        yield* _(Effect.log(`No health found for player ${playerId}`))
        return
      }

      yield* _(Effect.log(`Health bar updated for player ${playerId}: ${health}`))
    }),
})

/**
 * Create UI update workflow factory function to maintain compatibility
 */
export const createUIUpdateWorkflow = () =>
  Effect.gen(function* (_) {
    const workflow = yield* _(UIUpdateWorkflow)
    return workflow
  })
