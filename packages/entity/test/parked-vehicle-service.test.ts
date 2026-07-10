import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Option } from 'effect'
import { ParkedVehicleService } from '@ts-minecraft/entity/application/parked-vehicle-service'

const run = <A>(f: (svc: ParkedVehicleService) => Effect.Effect<A, never>): Promise<A> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const svc = yield* ParkedVehicleService
      return yield* f(svc)
    }).pipe(Effect.provide(ParkedVehicleService.Default)),
  )

describe('ParkedVehicleService', () => {
  it('park assigns unique ids and getAll returns every parked vehicle', () =>
    run((svc) =>
      Effect.gen(function* () {
        const a = yield* svc.park('boat', { x: 0, y: 62, z: 0 }, 1.2)
        const b = yield* svc.park('minecart', { x: 5, y: 64, z: 5 })
        expect(a.id).not.toBe(b.id)
        expect(b.yaw).toBe(0)
        const all = yield* svc.getAll()
        expect(all).toHaveLength(2)
      }),
    ))

  it('claimNearest returns the closest vehicle in range and removes it atomically', () =>
    run((svc) =>
      Effect.gen(function* () {
        yield* svc.park('boat', { x: 0, y: 62, z: 0 })
        const near = yield* svc.park('boat', { x: 1, y: 62, z: 0 })
        const claimed = yield* svc.claimNearest({ x: 1.4, y: 62, z: 0 }, 2.5)
        expect(Option.getOrThrow(claimed).id).toBe(near.id)
        expect(yield* svc.getAll()).toHaveLength(1)
        // second claim from the same spot picks up the remaining one
        const second = yield* svc.claimNearest({ x: 1.4, y: 62, z: 0 }, 2.5)
        expect(Option.isSome(second)).toBe(true)
        const third = yield* svc.claimNearest({ x: 1.4, y: 62, z: 0 }, 2.5)
        expect(Option.isNone(third)).toBe(true)
      }),
    ))

  it('claimNearest respects the max distance', () =>
    run((svc) =>
      Effect.gen(function* () {
        yield* svc.park('minecart', { x: 10, y: 64, z: 10 })
        const claimed = yield* svc.claimNearest({ x: 0, y: 64, z: 0 }, 2.5)
        expect(Option.isNone(claimed)).toBe(true)
        expect(yield* svc.getAll()).toHaveLength(1)
      }),
    ))

  it('restore replaces state and future ids never collide with restored ones', () =>
    run((svc) =>
      Effect.gen(function* () {
        yield* svc.restore([
          { id: 'parked-vehicle-7', kind: 'boat', position: { x: 0, y: 62, z: 0 }, yaw: 0 },
        ])
        const fresh = yield* svc.park('minecart', { x: 3, y: 64, z: 3 })
        expect(fresh.id).toBe('parked-vehicle-8')
        expect(yield* svc.getAll()).toHaveLength(2)
      }),
    ))

  it('reset clears vehicles and the id counter', () =>
    run((svc) =>
      Effect.gen(function* () {
        yield* svc.park('boat', { x: 0, y: 62, z: 0 })
        yield* svc.reset()
        expect(yield* svc.getAll()).toHaveLength(0)
        const next = yield* svc.park('boat', { x: 0, y: 62, z: 0 })
        expect(next.id).toBe('parked-vehicle-1')
      }),
    ))
})
