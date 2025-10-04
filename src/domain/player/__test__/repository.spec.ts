import { describe, expect, it } from 'vitest'
import * as fc from 'fast-check'
import { Effect } from 'effect'
import { PlayerRepository, PlayerRepositoryLive } from '../repository'
import { aggregateArb } from './generators'

const runWithRepository = <A>(effect: Effect.Effect<A>) =>
  Effect.runPromise(
    Effect.scoped(Effect.provideLayer(effect, PlayerRepositoryLive))
  )

describe('PlayerRepository', () => {
  it('upsert後にfindByIdで同じ集約を取得できる', async () => {
    await fc.assert(
      fc.asyncProperty(aggregateArb, async (aggregate) => {
        const program = Effect.gen(function* () {
          const repo = yield* PlayerRepository
          yield* repo.upsert(aggregate)
          return yield* repo.findById(aggregate.id)
        })

        const loaded = await runWithRepository(program)
        expect(loaded).toStrictEqual(aggregate)
      })
    )
  })

  it('remove後はexistsがfalseになる', async () => {
    await fc.assert(
      fc.asyncProperty(aggregateArb, async (aggregate) => {
        const program = Effect.gen(function* () {
          const repo = yield* PlayerRepository
          yield* repo.upsert(aggregate)
          const removed = yield* repo.remove(aggregate.id)
          const exists = yield* repo.exists(aggregate.id)
          return [removed, exists] as const
        })

        const [removed, exists] = await runWithRepository(program)
        expect(removed).toBe(true)
        expect(exists).toBe(false)
      })
    )
  })
})
