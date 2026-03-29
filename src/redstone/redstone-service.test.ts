import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Option } from 'effect'
import { RedstoneComponentType } from '@/redstone/redstone-model'
import { RedstoneService, RedstoneServiceLive } from '@/redstone/redstone-service'

describe('redstone/redstone-service', () => {
  it.effect('propagates signal with 1-step attenuation up to power distance limit', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Lever)
      yield* redstone.toggleLever({ x: 0, y: 64, z: 0 })

      yield* Effect.forEach(Arr.makeBy(15, i => i + 1), (x) => redstone.setComponent({ x, y: 64, z: 0 }, RedstoneComponentType.Wire), { concurrency: 1 })

      yield* redstone.tick()

      const sourcePower = yield* redstone.getPowerAt({ x: 0, y: 64, z: 0 })
      const nearPower = yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 })
      const edgePower = yield* redstone.getPowerAt({ x: 14, y: 64, z: 0 })
      const outOfRangePower = yield* redstone.getPowerAt({ x: 15, y: 64, z: 0 })

      expect(sourcePower).toBe(15)
      expect(nearPower).toBe(14)
      expect(edgePower).toBe(1)
      expect(outOfRangePower).toBe(0)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  it.effect('button emits temporary power and decays deterministically by ticks', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Button)
      yield* redstone.setComponent({ x: 1, y: 64, z: 0 }, RedstoneComponentType.Wire)
      yield* redstone.pressButton({ x: 0, y: 64, z: 0 }, 2)

      yield* redstone.tick()
      const firstTickPower = yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 })

      yield* redstone.tick()
      const secondTickPower = yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 })

      yield* redstone.tick()
      const thirdTickPower = yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 })

      expect(firstTickPower).toBe(14)
      expect(secondTickPower).toBe(14)
      expect(thirdTickPower).toBe(0)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  it.effect('piston abstraction extends when powered and retracts when unpowered', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Lever)
      yield* redstone.setComponent({ x: 1, y: 64, z: 0 }, RedstoneComponentType.Piston)

      yield* redstone.toggleLever({ x: 0, y: 64, z: 0 })
      yield* redstone.tick()
      const afterOn = yield* redstone.getComponent({ x: 1, y: 64, z: 0 })

      yield* redstone.toggleLever({ x: 0, y: 64, z: 0 })
      yield* redstone.tick()
      const afterOff = yield* redstone.getComponent({ x: 1, y: 64, z: 0 })

      const extendedAfterOn = Option.match(afterOn, {
        onNone: () => false,
        onSome: (component) => component.state.pistonExtended,
      })
      const extendedAfterOff = Option.match(afterOff, {
        onNone: () => true,
        onSome: (component) => component.state.pistonExtended,
      })

      expect(extendedAfterOn).toBe(true)
      expect(extendedAfterOff).toBe(false)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )
})
