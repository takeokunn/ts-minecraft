import { describe, it, expect, vi } from 'vitest'
import { Effect, Option } from 'effect'
import type { FrameUnequipArmorInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types/unequip-armor'
import { handleUnequipArmor } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler/unequip-armor'

const makeServices = (): FrameUnequipArmorInteractionServices => ({
  inventoryService: {
    addBlock: vi.fn(() => Effect.void),
  },
  equipmentService: {
    unequipSlot: vi.fn(() => Effect.succeed(Option.none())),
    equip: vi.fn(() => Effect.void),
  },
})

describe('handleUnequipArmor', () => {
  it('does nothing when all armor slots are empty', async () => {
    const s = makeServices()
    await Effect.runPromise(handleUnequipArmor(s))
    expect(s.inventoryService.addBlock).not.toHaveBeenCalled()
    expect(s.equipmentService.equip).not.toHaveBeenCalled()
  })

  it('unequips the first occupied slot (HELMET) and adds it to inventory', async () => {
    const s = makeServices()
    const helmetStack = { itemType: 'IRON_HELMET', count: 1 }
    s.equipmentService.unequipSlot.mockImplementation((slot: string) =>
      Effect.succeed(slot === 'HELMET' ? Option.some(helmetStack) : Option.none()),
    )
    await Effect.runPromise(handleUnequipArmor(s))
    expect(s.inventoryService.addBlock).toHaveBeenCalledWith('IRON_HELMET', 1)
    expect(s.equipmentService.equip).not.toHaveBeenCalled()
  })

  it('skips empty slots and unequips the first occupied one (CHESTPLATE)', async () => {
    const s = makeServices()
    const chestStack = { itemType: 'IRON_CHESTPLATE', count: 1 }
    s.equipmentService.unequipSlot.mockImplementation((slot: string) =>
      Effect.succeed(slot === 'CHESTPLATE' ? Option.some(chestStack) : Option.none()),
    )
    await Effect.runPromise(handleUnequipArmor(s))
    expect(s.inventoryService.addBlock).toHaveBeenCalledWith('IRON_CHESTPLATE', 1)
  })

  it('re-equips armor when inventory is full (addBlock fails)', async () => {
    const s = makeServices()
    const helmetStack = { itemType: 'IRON_HELMET', count: 1 }
    s.equipmentService.unequipSlot.mockImplementation((slot: string) =>
      Effect.succeed(slot === 'HELMET' ? Option.some(helmetStack) : Option.none()),
    )
    s.inventoryService.addBlock.mockReturnValue(Effect.fail('inventory-full'))
    await Effect.runPromise(handleUnequipArmor(s))
    expect(s.equipmentService.equip).toHaveBeenCalledWith(helmetStack)
  })
})
