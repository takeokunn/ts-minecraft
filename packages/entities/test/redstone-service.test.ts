import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Option } from 'effect'
import { RedstoneComponentType } from '@ts-minecraft/entities'
import { RedstoneService, RedstoneServiceLive } from '@ts-minecraft/entities'

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

      expect(Option.getOrThrow(afterOn).state.pistonExtended).toBe(true)
      expect(Option.getOrThrow(afterOff).state.pistonExtended).toBe(false)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  // --- removeComponent ---

  it.effect('removeComponent: getComponent returns none after removal', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Wire)
      const beforeRemoval = yield* redstone.getComponent({ x: 0, y: 64, z: 0 })

      yield* redstone.removeComponent({ x: 0, y: 64, z: 0 })
      const afterRemoval = yield* redstone.getComponent({ x: 0, y: 64, z: 0 })

      expect(Option.isSome(beforeRemoval)).toBe(true)
      expect(Option.isNone(afterRemoval)).toBe(true)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  it.effect('removeComponent: removing a non-existent position is a no-op', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      // Should not throw — no component was ever set at this position
      yield* redstone.removeComponent({ x: 99, y: 64, z: 99 })

      const result = yield* redstone.getComponent({ x: 99, y: 64, z: 99 })
      expect(Option.isNone(result)).toBe(true)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  // --- getComponents ---

  it.effect('getComponents: returns empty array when no components exist', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      const components = yield* redstone.getComponents()
      expect(components).toHaveLength(0)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  it.effect('getComponents: returns all components sorted by position key', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 5, y: 64, z: 0 }, RedstoneComponentType.Wire)
      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Lever)
      yield* redstone.setComponent({ x: 2, y: 64, z: 0 }, RedstoneComponentType.Button)

      const components = yield* redstone.getComponents()

      expect(components).toHaveLength(3)
      // Sorted by position key — x=0 < x=2 < x=5 at same y/z
      const types = Arr.map(components, c => c.type)
      expect(types).toEqual([RedstoneComponentType.Lever, RedstoneComponentType.Button, RedstoneComponentType.Wire])
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  // --- toggleTorch ---

  it.effect('toggleTorch: returns none when no Torch exists at position', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      const result = yield* redstone.toggleTorch({ x: 0, y: 64, z: 0 })
      expect(Option.isNone(result)).toBe(true)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  it.effect('toggleTorch: returns none when a non-Torch component exists at position', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Lever)
      const result = yield* redstone.toggleTorch({ x: 0, y: 64, z: 0 })
      expect(Option.isNone(result)).toBe(true)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  it.effect('toggleTorch: toggles Torch active from true to false and back', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      // Torch defaults to active=true (matches makeDefaultState)
      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Torch)
      const initialComp = yield* redstone.getComponent({ x: 0, y: 64, z: 0 })
      expect(Option.getOrThrow(initialComp).state.active).toBe(true)

      // Toggle off
      const afterFirstToggle = yield* redstone.toggleTorch({ x: 0, y: 64, z: 0 })
      expect(Option.isSome(afterFirstToggle)).toBe(true)
      expect(Option.getOrThrow(afterFirstToggle).state.active).toBe(false)

      // Toggle back on
      const afterSecondToggle = yield* redstone.toggleTorch({ x: 0, y: 64, z: 0 })
      expect(Option.isSome(afterSecondToggle)).toBe(true)
      expect(Option.getOrThrow(afterSecondToggle).state.active).toBe(true)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  // --- toggleLever: non-existent position ---

  it.effect('toggleLever: returns none when no Lever exists at position', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      const result = yield* redstone.toggleLever({ x: 0, y: 64, z: 0 })
      expect(Option.isNone(result)).toBe(true)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  it.effect('toggleLever: returns none when a non-Lever component exists at position', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Wire)
      const result = yield* redstone.toggleLever({ x: 0, y: 64, z: 0 })
      expect(Option.isNone(result)).toBe(true)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  // --- pressButton: non-existent position ---

  it.effect('pressButton: returns none when no Button exists at position', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      const result = yield* redstone.pressButton({ x: 0, y: 64, z: 0 })
      expect(Option.isNone(result)).toBe(true)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  it.effect('pressButton: returns none when a non-Button component exists at position', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Lever)
      const result = yield* redstone.pressButton({ x: 0, y: 64, z: 0 })
      expect(Option.isNone(result)).toBe(true)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  // --- getPowerSnapshot ---

  it.effect('getPowerSnapshot: returns tick=0 and empty poweredPositions on fresh service', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      const snapshot = yield* redstone.getPowerSnapshot()
      expect(snapshot.tick).toBe(0)
      expect(snapshot.poweredPositions).toHaveLength(0)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  it.effect('getPowerSnapshot: contains lever position in poweredPositions after toggle and tick', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Lever)
      yield* redstone.toggleLever({ x: 0, y: 64, z: 0 })
      yield* redstone.tick()

      const snapshot = yield* redstone.getPowerSnapshot()
      expect(snapshot.tick).toBe(1)

      const powered = Arr.map(snapshot.poweredPositions, e => e.position)
      const leverPowered = Arr.some(powered, p => p.x === 0 && p.y === 64 && p.z === 0)
      expect(leverPowered).toBe(true)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  // --- Tick cache reuse ---

  it.effect('tick: second tick with no changes reuses cached snapshot without corrupting power state', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Lever)
      yield* redstone.setComponent({ x: 1, y: 64, z: 0 }, RedstoneComponentType.Wire)
      yield* redstone.toggleLever({ x: 0, y: 64, z: 0 })

      // First tick: dirty=true, propagation runs, cachedSnapshot is populated
      yield* redstone.tick()
      const firstPower = yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 })

      // Second tick: dirty=false, no buttons active, cache path is taken
      yield* redstone.tick()
      const secondPower = yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 })

      // Power must be identical — cache reuse must not corrupt state
      expect(firstPower).toBe(14)
      expect(secondPower).toBe(14)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  it.effect('tick: snapshot tick counter increments on every tick regardless of cache', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Lever)
      yield* redstone.toggleLever({ x: 0, y: 64, z: 0 })

      const snap1 = yield* redstone.tick()
      const snap2 = yield* redstone.tick()
      const snap3 = yield* redstone.tick()

      expect(snap1.tick).toBe(1)
      expect(snap2.tick).toBe(2)
      expect(snap3.tick).toBe(3)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  // --- anyButtonJustExpired path ---

  it.effect('tick: button that just expired clears power on subsequent tick', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Button)
      yield* redstone.setComponent({ x: 1, y: 64, z: 0 }, RedstoneComponentType.Wire)

      // Press with 1 tick duration
      yield* redstone.pressButton({ x: 0, y: 64, z: 0 }, 1)

      // Tick 1: button is active (ticks=1 before decay → anyButtonActive=true),
      //         propagation runs, wire gets power, button decays to ticks=0
      yield* redstone.tick()
      const powerAfterFirstTick = yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 })

      // Tick 2: button ticks=0 but still in powerByPosition → anyButtonJustExpired=true,
      //         propagation runs again with inactive button → wire power cleared
      yield* redstone.tick()
      const powerAfterSecondTick = yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 })

      // Tick 3: button ticks=0 and no longer in powerByPosition → cache path,
      //         wire stays at 0
      yield* redstone.tick()
      const powerAfterThirdTick = yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 })

      expect(powerAfterFirstTick).toBe(14)
      expect(powerAfterSecondTick).toBe(0)
      expect(powerAfterThirdTick).toBe(0)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )

  // --- Torch signal propagation ---

  it.effect('torch: active torch powers adjacent wire; toggling off removes power', () =>
    Effect.gen(function* () {
      const redstone = yield* RedstoneService

      // Torch defaults to active=true
      yield* redstone.setComponent({ x: 0, y: 64, z: 0 }, RedstoneComponentType.Torch)
      yield* redstone.setComponent({ x: 1, y: 64, z: 0 }, RedstoneComponentType.Wire)

      yield* redstone.tick()
      const powerWhileActive = yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 })

      // Toggle torch off and tick again
      yield* redstone.toggleTorch({ x: 0, y: 64, z: 0 })
      yield* redstone.tick()
      const powerAfterToggleOff = yield* redstone.getPowerAt({ x: 1, y: 64, z: 0 })

      expect(powerWhileActive).toBe(14)
      expect(powerAfterToggleOff).toBe(0)
    }).pipe(Effect.provide(RedstoneServiceLive))
  )
})
