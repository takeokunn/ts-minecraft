import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import { NetherService } from '../application/nether-service'

describe('NetherService', () => {
  describe('getDimension', () => {
    it.effect('starts in overworld', () =>
      Effect.gen(function* () {
        const svc = yield* NetherService
        const dim = yield* svc.getDimension()
        expect(dim).toBe('overworld')
      }).pipe(Effect.provide(NetherService.Default)),
    )
  })

  describe('setDimension', () => {
    it.effect('can switch to nether', () =>
      Effect.gen(function* () {
        const svc = yield* NetherService
        yield* svc.setDimension('nether')
        const dim = yield* svc.getDimension()
        expect(dim).toBe('nether')
      }).pipe(Effect.provide(NetherService.Default)),
    )

    it.effect('can switch back to overworld', () =>
      Effect.gen(function* () {
        const svc = yield* NetherService
        yield* svc.setDimension('nether')
        yield* svc.setDimension('overworld')
        const dim = yield* svc.getDimension()
        expect(dim).toBe('overworld')
      }).pipe(Effect.provide(NetherService.Default)),
    )
  })

  describe('registerPortal / getPortals', () => {
    it.effect('registers a portal in overworld', () =>
      Effect.gen(function* () {
        const svc = yield* NetherService
        const pos = { x: 10, y: 64, z: 20 }
        yield* svc.registerPortal(pos, 'overworld')
        const portals = yield* svc.getPortals('overworld')
        expect(portals).toHaveLength(1)
        expect(portals[0]).toEqual(pos)
      }).pipe(Effect.provide(NetherService.Default)),
    )

    it.effect('registers portals in separate dimension buckets', () =>
      Effect.gen(function* () {
        const svc = yield* NetherService
        const overworldPos = { x: 10, y: 64, z: 20 }
        const netherPos = { x: 1, y: 64, z: 2 }
        yield* svc.registerPortal(overworldPos, 'overworld')
        yield* svc.registerPortal(netherPos, 'nether')
        const ow = yield* svc.getPortals('overworld')
        const nether = yield* svc.getPortals('nether')
        expect(ow).toHaveLength(1)
        expect(nether).toHaveLength(1)
        expect(ow[0]).toEqual(overworldPos)
        expect(nether[0]).toEqual(netherPos)
      }).pipe(Effect.provide(NetherService.Default)),
    )

    it.effect('deduplicates the same portal position', () =>
      Effect.gen(function* () {
        const svc = yield* NetherService
        const pos = { x: 10, y: 64, z: 20 }
        yield* svc.registerPortal(pos, 'overworld')
        yield* svc.registerPortal(pos, 'overworld')
        const portals = yield* svc.getPortals('overworld')
        expect(portals).toHaveLength(1)
      }).pipe(Effect.provide(NetherService.Default)),
    )

    it.effect('returns empty array for dimension with no portals', () =>
      Effect.gen(function* () {
        const svc = yield* NetherService
        const portals = yield* svc.getPortals('nether')
        expect(portals).toHaveLength(0)
      }).pipe(Effect.provide(NetherService.Default)),
    )

    it.effect('can register multiple distinct portals', () =>
      Effect.gen(function* () {
        const svc = yield* NetherService
        const p1 = { x: 10, y: 64, z: 20 }
        const p2 = { x: 100, y: 64, z: 200 }
        yield* svc.registerPortal(p1, 'overworld')
        yield* svc.registerPortal(p2, 'overworld')
        const portals = yield* svc.getPortals('overworld')
        expect(portals).toHaveLength(2)
      }).pipe(Effect.provide(NetherService.Default)),
    )
  })
})
