import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, Option } from 'effect'
import { SlotIndex } from '@ts-minecraft/core'
import { handleMinecartMount, type MinecartMountServices } from './minecart-mount'

const makeServices = (options: {
  readonly selected: string | null
  readonly feetBlock: string
  readonly minecarting?: boolean
  readonly boating?: boolean
  readonly removeFails?: boolean
}) => {
  const enterMinecart = vi.fn(() => Effect.void)
  const removeBlock = vi.fn(() =>
    options.removeFails === true ? Effect.fail('no item' as never) : Effect.void)
  const services = {
    hotbarService: {
      getSelectedBlockType: () => Effect.succeed(options.selected === null ? Option.none() : Option.some(options.selected)),
      getSelectedSlot: () => Effect.succeed(SlotIndex.make(0)),
    },
    inventoryService: { removeBlock },
    gameState: {
      isMinecarting: () => Effect.succeed(options.minecarting ?? false),
      isBoating: () => Effect.succeed(options.boating ?? false),
      enterMinecart,
      // Body-center y resting on a block top; y − VEHICLE_SURFACE_SAMPLE_OFFSET
      // (0.4) = 63.5 → rail cell 63, matching the per-frame dismount sampling.
      getPlayerPosition: () => Effect.succeed({ x: 0.5, y: 63.9, z: 0.5 }),
    },
    blockService: { getBlock: () => Effect.succeed(options.feetBlock) },
    soundManager: { playEffect: () => Effect.void },
  } as unknown as MinecartMountServices
  return { services, enterMinecart, removeBlock }
}

describe('handleMinecartMount', () => {
  it.effect('mounts when a MINECART is used while standing on a rail', () => {
    const { services, enterMinecart, removeBlock } = makeServices({ selected: 'MINECART', feetBlock: 'RAIL' })
    return handleMinecartMount(services).pipe(
      Effect.tap((handled) => Effect.sync(() => {
        expect(handled).toBe(true)
        expect(removeBlock).toHaveBeenCalled()
        expect(enterMinecart).toHaveBeenCalled()
      })),
    )
  })

  it.effect('mounts on a POWERED_RAIL too', () => {
    const { services, enterMinecart } = makeServices({ selected: 'MINECART', feetBlock: 'POWERED_RAIL' })
    return handleMinecartMount(services).pipe(
      Effect.tap((handled) => Effect.sync(() => {
        expect(handled).toBe(true)
        expect(enterMinecart).toHaveBeenCalled()
      })),
    )
  })

  it.effect('does nothing off the rail', () => {
    const { services, enterMinecart } = makeServices({ selected: 'MINECART', feetBlock: 'GRASS' })
    return handleMinecartMount(services).pipe(
      Effect.tap((handled) => Effect.sync(() => {
        expect(handled).toBe(false)
        expect(enterMinecart).not.toHaveBeenCalled()
      })),
    )
  })

  it.effect('does nothing when another item is selected', () => {
    const { services, enterMinecart } = makeServices({ selected: 'DIRT', feetBlock: 'RAIL' })
    return handleMinecartMount(services).pipe(
      Effect.tap((handled) => Effect.sync(() => {
        expect(handled).toBe(false)
        expect(enterMinecart).not.toHaveBeenCalled()
      })),
    )
  })

  it.effect('does not double-mount while already minecarting', () => {
    const { services, enterMinecart } = makeServices({ selected: 'MINECART', feetBlock: 'RAIL', minecarting: true })
    return handleMinecartMount(services).pipe(
      Effect.tap((handled) => Effect.sync(() => {
        expect(handled).toBe(false)
        expect(enterMinecart).not.toHaveBeenCalled()
      })),
    )
  })

  it.effect('does not mount while boating', () => {
    const { services, enterMinecart, removeBlock } = makeServices({ selected: 'MINECART', feetBlock: 'RAIL', boating: true })
    return handleMinecartMount(services).pipe(
      Effect.tap((handled) => Effect.sync(() => {
        expect(handled).toBe(false)
        expect(enterMinecart).not.toHaveBeenCalled()
        expect(removeBlock).not.toHaveBeenCalled()
      })),
    )
  })

  it.effect('a failed item consumption never mounts', () => {
    const { services, enterMinecart } = makeServices({ selected: 'MINECART', feetBlock: 'RAIL', removeFails: true })
    return handleMinecartMount(services).pipe(
      Effect.tap((handled) => Effect.sync(() => {
        expect(handled).toBe(false)
        expect(enterMinecart).not.toHaveBeenCalled()
      })),
    )
  })
})
