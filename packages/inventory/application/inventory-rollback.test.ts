import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Option } from 'effect'
import { tryInventoryRollbackTransaction } from './inventory-rollback'

const makeRollbackInventory = (options?: { readonly failOnAction?: boolean }) => {
  let value = 'initial'

  return {
    getValue: () => value,
    service: {
      serialize: () => Effect.sync(() => value),
      deserialize: (snapshot: string) =>
        Effect.sync(() => {
          value = snapshot
        }),
      run: () =>
        Effect.suspend(() => {
          if (options?.failOnAction) {
            return Effect.fail(new Error('action failed'))
          }

          value = 'mutated'
          return Effect.void
        }),
    },
  }
}

describe('inventory rollback helper', () => {
  it.effect('returns none and keeps the mutation when the action succeeds', () =>
    Effect.gen(function* () {
      const inventory = makeRollbackInventory()

      const failure = yield* tryInventoryRollbackTransaction(inventory.service, inventory.service.run())

      expect(Option.isNone(failure)).toBe(true)
      expect(inventory.getValue()).toBe('mutated')
    }))

  it.effect('restores the snapshot and reports failure when the action fails', () =>
    Effect.gen(function* () {
      const inventory = makeRollbackInventory({ failOnAction: true })

      const failure = yield* tryInventoryRollbackTransaction(inventory.service, inventory.service.run())

      expect(Option.isSome(failure)).toBe(true)
      expect(Option.getOrThrow(failure).message).toBe('action failed')
      expect(inventory.getValue()).toBe('initial')
    }))
})
