import { describe, expect, it, vi } from 'vitest'
import { Effect, Option } from 'effect'
import { handleParkedVehicleEnter, type VehicleEnterServices } from './vehicle-enter'

type Overrides = {
  readonly parked?: ReadonlyArray<{ id: string; kind: 'boat' | 'minecart'; position: { x: number; y: number; z: number }; yaw: number }>
  readonly claimed?: { id: string; kind: 'boat' | 'minecart'; position: { x: number; y: number; z: number }; yaw: number } | null
  readonly sneaking?: boolean
  readonly standingBlock?: string | null
  readonly boating?: boolean
  readonly addFails?: boolean
}

const makeHarness = (overrides: Overrides = {}) => {
  const enterBoat = vi.fn(() => Effect.void)
  const enterMinecart = vi.fn(() => Effect.void)
  const park = vi.fn(() => Effect.succeed({} as never))
  const addBlock = vi.fn(() =>
    overrides.addFails === true ? Effect.fail('full' as never) : Effect.void,
  )
  const services = {
    gameState: {
      isBoating: () => Effect.succeed(overrides.boating ?? false),
      isMinecarting: () => Effect.succeed(false),
      getPlayerPosition: () => Effect.succeed({ x: 0, y: 62, z: 0 }),
      enterBoat,
      enterMinecart,
    },
    parkedVehicleService: {
      getAll: () => Effect.succeed(overrides.parked ?? []),
      claimNearest: () => Effect.succeed(Option.fromNullable(overrides.claimed ?? null)),
      park,
    },
    inventoryService: { addBlock },
    blockService: { getBlock: () => Effect.succeed(overrides.standingBlock ?? null) },
    soundManager: { playEffect: vi.fn(() => Effect.void) },
    inputService: { isKeyPressed: () => Effect.succeed(overrides.sneaking ?? false) },
    multiplayer: Option.none(),
  } as unknown as VehicleEnterServices
  return { services, enterBoat, enterMinecart, park, addBlock }
}

const boatAt = (x: number) => ({ id: 'parked-vehicle-1', kind: 'boat' as const, position: { x, y: 62, z: 0 }, yaw: 0 })

describe('handleParkedVehicleEnter', () => {
  it('returns false with no parked vehicles (cheap pre-check)', async () => {
    const { services } = makeHarness()
    expect(await Effect.runPromise(handleParkedVehicleEnter(services))).toBe(false)
  })

  it('mounts a nearby boat when standing in water', async () => {
    const { services, enterBoat } = makeHarness({
      parked: [boatAt(1)],
      claimed: boatAt(1),
      standingBlock: 'WATER',
    })
    expect(await Effect.runPromise(handleParkedVehicleEnter(services))).toBe(true)
    expect(enterBoat).toHaveBeenCalledOnce()
  })

  it('re-parks untouched when the environment does not allow mounting', async () => {
    const { services, enterBoat, park } = makeHarness({
      parked: [boatAt(1)],
      claimed: boatAt(1),
      standingBlock: 'GRASS',
    })
    expect(await Effect.runPromise(handleParkedVehicleEnter(services))).toBe(false)
    expect(enterBoat).not.toHaveBeenCalled()
    expect(park).toHaveBeenCalledWith('boat', { x: 1, y: 62, z: 0 }, 0)
  })

  it('sneak-click picks the vehicle up into the inventory', async () => {
    const { services, addBlock, enterBoat } = makeHarness({
      parked: [boatAt(1)],
      claimed: boatAt(1),
      sneaking: true,
    })
    expect(await Effect.runPromise(handleParkedVehicleEnter(services))).toBe(true)
    expect(addBlock).toHaveBeenCalledWith('BOAT', 1)
    expect(enterBoat).not.toHaveBeenCalled()
  })

  it('a full inventory re-parks instead of destroying the vehicle', async () => {
    const { services, park } = makeHarness({
      parked: [boatAt(1)],
      claimed: boatAt(1),
      sneaking: true,
      addFails: true,
    })
    expect(await Effect.runPromise(handleParkedVehicleEnter(services))).toBe(false)
    expect(park).toHaveBeenCalledOnce()
  })

  it('does nothing while already riding', async () => {
    const { services, enterBoat } = makeHarness({
      parked: [boatAt(1)],
      claimed: boatAt(1),
      standingBlock: 'WATER',
      boating: true,
    })
    expect(await Effect.runPromise(handleParkedVehicleEnter(services))).toBe(false)
    expect(enterBoat).not.toHaveBeenCalled()
  })
})
