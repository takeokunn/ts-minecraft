import { Effect, Option } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { SlotIndex } from '@ts-minecraft/core'
import { XP_ORB_PICKUP_DELAY_TICKS } from '@ts-minecraft/entity/domain/dropped-xp-orb'
import { selectedHotbarSlotIndex } from '../selected-hotbar-slot'
import { handleFishingCatch } from './fishing'

const makeSpawnXpOrb = () =>
  vi.fn(() =>
    Effect.succeed({
      id: 'test-fishing-xp-orb',
      amount: 1,
      position: { x: 0, y: 64, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      ageTicks: 0,
      pickupDelayTicks: 0,
    }),
  )

describe('physics-stage-survival/fishing', () => {
  it('adds caught items and plays a sound when fishing produces a catch', async () => {
    const addBlock = vi.fn(() => Effect.void)
    const damageSlot = vi.fn(() => Effect.void)
    const spawnXpOrb = makeSpawnXpOrb()
    const playEffect = vi.fn(() => Effect.void)
    const tick = vi.fn(() => Effect.succeed(Option.some({ item: 'COD' as never, experience: 4 })))
    const selectedSlot = SlotIndex.make(2)
    const getSelectedSlot = vi.fn(() => Effect.succeed(selectedSlot))
    const services = {
      fishingService: { tick },
      inventoryService: { addBlock, damageSlot },
      hotbarService: { getSelectedSlot },
      droppedXpOrbService: { spawn: spawnXpOrb },
      soundManager: { playEffect },
    }

    await Effect.runPromise(handleFishingCatch(services, { x: 4, y: 65, z: -2 }, 0.5))

    expect(tick).toHaveBeenCalledOnce()
    expect(addBlock).toHaveBeenCalledWith('COD', 1)
    expect(getSelectedSlot).toHaveBeenCalledOnce()
    expect(damageSlot).toHaveBeenCalledWith(selectedHotbarSlotIndex(selectedSlot), 1)
    expect(spawnXpOrb).toHaveBeenCalledWith({
      amount: 4,
      position: { x: 4, y: 65.5, z: -2 },
      pickupDelayTicks: XP_ORB_PICKUP_DELAY_TICKS,
    })
    expect(playEffect).toHaveBeenCalledWith('blockPlace', { position: { x: 4, y: 65, z: -2 } })
  })

  it('does nothing when fishing has no catch', async () => {
    const addBlock = vi.fn(() => Effect.void)
    const damageSlot = vi.fn(() => Effect.void)
    const spawnXpOrb = makeSpawnXpOrb()
    const playEffect = vi.fn(() => Effect.void)
    const tick = vi.fn(() => Effect.succeed(Option.none()))
    const getSelectedSlot = vi.fn(() => Effect.succeed(SlotIndex.make(2)))
    const services = {
      fishingService: { tick },
      inventoryService: { addBlock, damageSlot },
      hotbarService: { getSelectedSlot },
      droppedXpOrbService: { spawn: spawnXpOrb },
      soundManager: { playEffect },
    }

    await Effect.runPromise(handleFishingCatch(services, { x: 4, y: 65, z: -2 }, 0.5))

    expect(tick).toHaveBeenCalledOnce()
    expect(addBlock).not.toHaveBeenCalled()
    expect(getSelectedSlot).not.toHaveBeenCalled()
    expect(damageSlot).not.toHaveBeenCalled()
    expect(spawnXpOrb).not.toHaveBeenCalled()
    expect(playEffect).not.toHaveBeenCalled()
  })

  it('still damages the rod and spawns XP when the caught item cannot be added to inventory', async () => {
    const addBlock = vi.fn(() => Effect.fail(new Error('full')))
    const damageSlot = vi.fn(() => Effect.void)
    const spawnXpOrb = makeSpawnXpOrb()
    const playEffect = vi.fn(() => Effect.void)
    const tick = vi.fn(() => Effect.succeed(Option.some({ item: 'COD' as never, experience: 6 })))
    const selectedSlot = SlotIndex.make(4)
    const getSelectedSlot = vi.fn(() => Effect.succeed(selectedSlot))
    const services = {
      fishingService: { tick },
      inventoryService: { addBlock, damageSlot },
      hotbarService: { getSelectedSlot },
      droppedXpOrbService: { spawn: spawnXpOrb },
      soundManager: { playEffect },
    }

    await Effect.runPromise(handleFishingCatch(services, { x: 4, y: 65, z: -2 }, 0.5))

    expect(addBlock).toHaveBeenCalledWith('COD', 1)
    expect(damageSlot).toHaveBeenCalledWith(selectedHotbarSlotIndex(selectedSlot), 1)
    expect(spawnXpOrb).toHaveBeenCalledWith({
      amount: 6,
      position: { x: 4, y: 65.5, z: -2 },
      pickupDelayTicks: XP_ORB_PICKUP_DELAY_TICKS,
    })
    expect(playEffect).toHaveBeenCalledWith('blockPlace', { position: { x: 4, y: 65, z: -2 } })
  })
})
