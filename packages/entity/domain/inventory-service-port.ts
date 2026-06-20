import { Effect, Option } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'
import type { InventoryError } from './errors'

type InventorySlot = Option.Option<{ readonly itemType: InventoryItem; readonly count: number }>

// Minimal port covering only the subset of InventoryService used by TradingService.
// The inventory package's InventoryService satisfies this interface; tests supply stubs.
export class InventoryServicePort extends Effect.Service<InventoryServicePort>()(
  '@minecraft/entity/domain/InventoryServicePort',
  {
    /* c8 ignore next */
    succeed: {
      /* c8 ignore next */
      getAllSlots: (): Effect.Effect<ReadonlyArray<InventorySlot>, never> =>
        Effect.succeed([]),
      /* c8 ignore next */
      removeBlock: (_itemType: InventoryItem, _count: number): Effect.Effect<void, InventoryError> =>
        Effect.void,
      /* c8 ignore next */
      addBlock: (_itemType: InventoryItem, _count: number): Effect.Effect<void, InventoryError> =>
        Effect.void,
    },
  },
) {}
