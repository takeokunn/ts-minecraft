import { describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { Effect } from 'effect'
import { addExperienceWithMending } from './xp-mending'

// ─── addExperienceWithMending ─────────────────────────────────────────────────

const makeServices = (inventoryRemaining: number, equipmentRemaining: number) => ({
  inventoryService: {
    repairMendingItemsWithXP: vi.fn(() => Effect.succeed(inventoryRemaining)),
  },
  equipmentService: {
    repairMendingItemsWithXP: vi.fn(() => Effect.succeed(equipmentRemaining)),
  },
  xpService: {
    addXP: vi.fn(() => Effect.succeed(undefined)),
  },
})

describe('addExperienceWithMending', () => {
  it('passes full amount to inventory first', async () => {
    const services = makeServices(10, 10)
    await Effect.runPromise(addExperienceWithMending(15, services))
    expect(services.inventoryService.repairMendingItemsWithXP).toHaveBeenCalledWith(15)
  })

  it('passes inventory remainder to equipment', async () => {
    const services = makeServices(8, 8) // inventory uses 7, leaves 8
    await Effect.runPromise(addExperienceWithMending(15, services))
    expect(services.equipmentService.repairMendingItemsWithXP).toHaveBeenCalledWith(8)
  })

  it('adds leftover XP to xpService when equipment has remainder', async () => {
    const services = makeServices(5, 3) // equipment uses 2, leaves 3
    await Effect.runPromise(addExperienceWithMending(10, services))
    expect(services.xpService.addXP).toHaveBeenCalledWith(3)
  })

  it('does not call addXP when equipment consumes all remaining XP', async () => {
    const services = makeServices(5, 0) // equipment uses all remaining 5, leaves 0
    await Effect.runPromise(addExperienceWithMending(10, services))
    expect(services.xpService.addXP).not.toHaveBeenCalled()
  })

  it('skips all calls when amount is 0', async () => {
    const services = makeServices(0, 0)
    await Effect.runPromise(addExperienceWithMending(0, services))
    expect(services.inventoryService.repairMendingItemsWithXP).toHaveBeenCalledWith(0)
    // With amount=0, inventory gets 0, returns 0; equipment gets 0, returns 0; no addXP
    expect(services.xpService.addXP).not.toHaveBeenCalled()
  })
})
