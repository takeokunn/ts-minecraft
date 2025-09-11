import { Effect, Context, Layer } from 'effect'
import { EntityDomainService } from '@domain/services/entity-domain.service'
import { WorldDomainService } from '@domain/services/world-domain.service'
import { PerformanceMonitorPort } from '@domain/ports/performance-monitor.port'

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

export const UIUpdateWorkflowLive = Layer.effect(
  UIUpdateWorkflow,
  Effect.gen(function* (_) {
    const performanceMonitor = yield* _(PerformanceMonitorPort)

    return {
      updatePlayerUI: (playerId) =>
        Effect.gen(function* (_) {
          yield* _(performanceMonitor.startSystem('ui-player-update'))

          const entityService = yield* _(EntityDomainService)

          try {
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

            yield* _(performanceMonitor.recordMetric('execution_time', 'ui-player-update', 1, 'update'))
            yield* _(Effect.log(`Player UI updated for ${playerId}`))
          } finally {
            yield* _(performanceMonitor.endSystem('ui-player-update'))
          }
        }),

      updateWorldUI: () =>
        Effect.gen(function* (_) {
          yield* _(performanceMonitor.startSystem('ui-world-update'))

          const worldService = yield* _(WorldDomainService)

          try {
            // Get world statistics for UI display
            const loadedChunks = yield* _(worldService.getLoadedChunks())

            yield* _(performanceMonitor.recordMetric('execution_time', 'ui-world-update', loadedChunks.length, 'chunks'))
            yield* _(Effect.log(`World UI updated: ${loadedChunks.length} chunks loaded`))
          } finally {
            yield* _(performanceMonitor.endSystem('ui-world-update'))
          }
        }),

      updateHotbar: (playerId) =>
        Effect.gen(function* (_) {
          yield* _(performanceMonitor.startSystem('ui-hotbar-update'))

          const entityService = yield* _(EntityDomainService)

          try {
            // Get player inventory for hotbar
            const inventory = yield* _(entityService.getEntityInventory(playerId))

            if (!inventory) {
              yield* _(Effect.log(`No inventory found for player ${playerId}`))
              return
            }

            // Extract hotbar items (first 9 items typically)
            const hotbarItems = inventory.slice(0, 9)

            yield* _(performanceMonitor.recordMetric('execution_time', 'ui-hotbar-update', hotbarItems.length, 'items'))
            yield* _(Effect.log(`Hotbar updated for player ${playerId} with ${hotbarItems.length} items`))
          } finally {
            yield* _(performanceMonitor.endSystem('ui-hotbar-update'))
          }
        }),

      updateHealthBar: (playerId) =>
        Effect.gen(function* (_) {
          yield* _(performanceMonitor.startSystem('ui-health-update'))

          const entityService = yield* _(EntityDomainService)

          try {
            // Get player health
            const health = yield* _(entityService.getEntityHealth(playerId))

            if (health === undefined) {
              yield* _(Effect.log(`No health found for player ${playerId}`))
              return
            }

            yield* _(performanceMonitor.recordMetric('execution_time', 'ui-health-update', health, 'health'))
            yield* _(Effect.log(`Health bar updated for player ${playerId}: ${health}`))
          } finally {
            yield* _(performanceMonitor.endSystem('ui-health-update'))
          }
        }),
    }
  }),
)

/**
 * Create UI update workflow factory function to maintain compatibility
 */
export const createUIUpdateWorkflow = () =>
  Effect.gen(function* (_) {
    const workflow = yield* _(UIUpdateWorkflow)
    return workflow
  })
