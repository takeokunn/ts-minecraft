import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, Option } from 'effect'
import { SlotIndex } from '@ts-minecraft/core'
import { handleBoatMount, type BoatMountServices } from './boat-mount'

const makeServices = (options: {
  readonly selected: string | null
  readonly feetBlock: string
  readonly boating?: boolean
  readonly removeFails?: boolean
}) => {
  const enterBoat = vi.fn(() => Effect.void)
  const removeBlock = vi.fn(() =>
    options.removeFails === true ? Effect.fail('no item' as never) : Effect.void)
  const services = {
    hotbarService: {
      getSelectedBlockType: () => Effect.succeed(options.selected === null ? Option.none() : Option.some(options.selected)),
      getSelectedSlot: () => Effect.succeed(SlotIndex.make(0)),
    },
    inventoryService: { removeBlock },
    gameState: {
      isBoating: () => Effect.succeed(options.boating ?? false),
      enterBoat,
      getPlayerPosition: () => Effect.succeed({ x: 0.5, y: 63.4, z: 0.5 }),
    },
    blockService: { getBlock: () => Effect.succeed(options.feetBlock) },
    soundManager: { playEffect: () => Effect.void },
  } as unknown as BoatMountServices
  return { services, enterBoat, removeBlock }
}

describe('handleBoatMount', () => {
  it.effect('mounts when a BOAT is used while standing in water', () => {
    const { services, enterBoat, removeBlock } = makeServices({ selected: 'BOAT', feetBlock: 'WATER' })
    return handleBoatMount(services).pipe(
      Effect.tap((handled) => Effect.sync(() => {
        expect(handled).toBe(true)
        expect(removeBlock).toHaveBeenCalled()
        expect(enterBoat).toHaveBeenCalled()
      })),
    )
  })

  it.effect('does nothing on land', () => {
    const { services, enterBoat } = makeServices({ selected: 'BOAT', feetBlock: 'GRASS' })
    return handleBoatMount(services).pipe(
      Effect.tap((handled) => Effect.sync(() => {
        expect(handled).toBe(false)
        expect(enterBoat).not.toHaveBeenCalled()
      })),
    )
  })

  it.effect('does nothing when another item is selected', () => {
    const { services, enterBoat } = makeServices({ selected: 'DIRT', feetBlock: 'WATER' })
    return handleBoatMount(services).pipe(
      Effect.tap((handled) => Effect.sync(() => {
        expect(handled).toBe(false)
        expect(enterBoat).not.toHaveBeenCalled()
      })),
    )
  })

  it.effect('does not double-mount while already boating', () => {
    const { services, enterBoat } = makeServices({ selected: 'BOAT', feetBlock: 'WATER', boating: true })
    return handleBoatMount(services).pipe(
      Effect.tap((handled) => Effect.sync(() => {
        expect(handled).toBe(false)
        expect(enterBoat).not.toHaveBeenCalled()
      })),
    )
  })

  it.effect('a failed item consumption never mounts', () => {
    const { services, enterBoat } = makeServices({ selected: 'BOAT', feetBlock: 'WATER', removeFails: true })
    return handleBoatMount(services).pipe(
      Effect.tap((handled) => Effect.sync(() => {
        expect(handled).toBe(false)
        expect(enterBoat).not.toHaveBeenCalled()
      })),
    )
  })
})
