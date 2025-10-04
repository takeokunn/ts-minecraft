import { Effect, Layer } from 'effect'
import * as fc from 'effect/FastCheck'
import { describe, expect, it } from 'vitest'
import { provideLayers } from '../../testing/effect'
import { PlayerRepositoryLive } from '../repository'
import { PlayerDomainService, PlayerDomainServiceLive } from '../services'
import { PlayerClockLive } from '../time'
import { creationInputArb, vitalsArb } from './generators'

const liveLayer = Layer.mergeAll(PlayerRepositoryLive, PlayerClockLive, PlayerDomainServiceLive)

const runWithService = <A>(effect: Effect.Effect<A>) => Effect.runPromise(provideLayers(effect, liveLayer))

describe('PlayerDomainService', () => {
  it('spawnでプレイヤーを生成できる', async () => {
    await fc.assert(
      fc.asyncProperty(creationInputArb, async (input) => {
        const program = Effect.gen(function* () {
          const service = yield* PlayerDomainService
          return yield* service.spawn(input)
        })

        const aggregate = await runWithService(program)
        expect(aggregate.id).toStrictEqual(input.id)
      })
    )
  })

  it('issueCommandでVitals更新が適用される', async () => {
    await fc.assert(
      fc.asyncProperty(creationInputArb, vitalsArb, fc.integer({ min: 1, max: 2000 }), async (input, vitals, delta) => {
        const program = Effect.gen(function* () {
          const service = yield* PlayerDomainService
          const aggregate = yield* service.spawn(input)
          const updated = yield* service.issueCommand({
            _tag: 'UpdateVitals',
            id: aggregate.id,
            health: vitals.health,
            hunger: vitals.hunger,
            saturation: vitals.saturation,
            experienceLevel: vitals.experienceLevel,
            timestamp: aggregate.updatedAt + Math.abs(delta),
          })
          return updated
        })

        const updated = await runWithService(program)
        expect(updated.vitals.health).toBe(vitals.health)
      })
    )
  })

  it('snapshotでスナップショットを取得する', async () => {
    await fc.assert(
      fc.asyncProperty(creationInputArb, async (input) => {
        const program = Effect.gen(function* () {
          const service = yield* PlayerDomainService
          const aggregate = yield* service.spawn(input)
          return yield* service.snapshot(aggregate.id)
        })

        const snapshot = await runWithService(program)
        expect(snapshot.aggregate.id).toStrictEqual(input.id)
      })
    )
  })
})
