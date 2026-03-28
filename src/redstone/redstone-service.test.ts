import { describe, expect, it } from 'vitest'
import { Effect, Option } from 'effect'
import { RedstoneComponentType } from '@/redstone/redstone-model'
import { RedstoneService, RedstoneServiceLive } from '@/redstone/redstone-service'

describe('redstone/redstone-service', () => {
  it('propagates signal with 1-step attenuation up to power distance limit', async () => {
    const program = Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Lever)
      yield* redstone.toggleLever({ x: 0, y: 64, z: 0 })

      for (let x = 1; x <= 15; x += 1) {
        yield* redstone.setComponent({ x, y: 64, z: 0 }, RedstoneComponentType.Wire)
      }

      yield* redstone.tick()

      return {
        sourcePower: yield* redstone.getPowerAt({ x: 0, y: 64, z: 0 }),
        nearPower: yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 }),
        edgePower: yield* redstone.getPowerAt({ x: 14, y: 64, z: 0 }),
        outOfRangePower: yield* redstone.getPowerAt({ x: 15, y: 64, z: 0 }),
      }
    }).pipe(Effect.provide(RedstoneServiceLive))

    const result = await Effect.runPromise(program)

    expect(result.sourcePower).toBe(15)
    expect(result.nearPower).toBe(14)
    expect(result.edgePower).toBe(1)
    expect(result.outOfRangePower).toBe(0)
  })

  it('button emits temporary power and decays deterministically by ticks', async () => {
    const program = Effect.gen(function* () {
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

      return { firstTickPower, secondTickPower, thirdTickPower }
    }).pipe(Effect.provide(RedstoneServiceLive))

    const result = await Effect.runPromise(program)

    expect(result.firstTickPower).toBe(14)
    expect(result.secondTickPower).toBe(14)
    expect(result.thirdTickPower).toBe(0)
  })

  it('piston abstraction extends when powered and retracts when unpowered', async () => {
    const program = Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Lever)
      yield* redstone.setComponent({ x: 1, y: 64, z: 0 }, RedstoneComponentType.Piston)

      yield* redstone.toggleLever({ x: 0, y: 64, z: 0 })
      yield* redstone.tick()
      const afterOn = yield* redstone.getComponent({ x: 1, y: 64, z: 0 })

      yield* redstone.toggleLever({ x: 0, y: 64, z: 0 })
      yield* redstone.tick()
      const afterOff = yield* redstone.getComponent({ x: 1, y: 64, z: 0 })

      return {
        extendedAfterOn: Option.match(afterOn, {
          onNone: () => false,
          onSome: (component) => component.state.pistonExtended,
        }),
        extendedAfterOff: Option.match(afterOff, {
          onNone: () => true,
          onSome: (component) => component.state.pistonExtended,
        }),
      }
    }).pipe(Effect.provide(RedstoneServiceLive))

    const result = await Effect.runPromise(program)

    expect(result.extendedAfterOn).toBe(true)
    expect(result.extendedAfterOff).toBe(false)
  })
})
