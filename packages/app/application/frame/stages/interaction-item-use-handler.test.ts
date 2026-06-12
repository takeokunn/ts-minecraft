import { describe, it, expect, vi } from 'vitest'
import { Effect, Option } from 'effect'
import { handleFoodConsumption, handleUnequipArmor } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler'
import { MAX_FOOD_LEVEL } from '@ts-minecraft/entity'

// ─── shared helpers ───────────────────────────────────────────────────────────

const makeHunger = (foodLevel: number) => ({ foodLevel, saturation: 5, exhaustion: 0 })

// Base mock factory — every service method starts as a vi.fn() returning safe
// defaults.  Individual tests override only the fields they care about.
const makeServices = () => ({
  hotbarService: {
    getSelectedBlockType: vi.fn(() => Effect.succeed(Option.none<string>())),
    getSelectedSlot: vi.fn(() => Effect.succeed(0)),
  },
  hungerService: {
    getHunger: vi.fn(() => Effect.succeed(makeHunger(10))),
    eat: vi.fn(() => Effect.void),
  },
  inventoryService: {
    removeBlock: vi.fn(() => Effect.void),
    addBlock: vi.fn(() => Effect.void),
    getSlot: vi.fn(() => Effect.succeed(Option.none<{ itemType: string; count: number }>())),
  },
  equipmentService: {
    getEquippedItem: vi.fn(() => Effect.succeed(Option.none())),
    equip: vi.fn(() => Effect.void),
    unequipSlot: vi.fn(() => Effect.succeed(Option.none())),
  },
  fishingService: {
    isFishing: vi.fn(() => Effect.succeed(false)),
    cast: vi.fn(() => Effect.void),
    cancel: vi.fn(() => Effect.void),
  },
  xpService: {
    getXP: vi.fn(() => Effect.succeed({ totalXP: 0, xpIntoLevel: 0, level: 0 })),
  },
  healthService: {
    heal: vi.fn(() => Effect.void),
  },
})

// ─── handleFoodConsumption ────────────────────────────────────────────────────

describe('handleFoodConsumption', () => {
  it('returns false when nothing is held', async () => {
    const s = makeServices()
    // default: getSelectedBlockType returns Option.none()
    expect(await Effect.runPromise(handleFoodConsumption(s as never))).toBe(false)
    expect(s.inventoryService.removeBlock).not.toHaveBeenCalled()
  })

  it('returns false for a non-food, non-armor item (STONE)', async () => {
    const s = makeServices()
    s.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('STONE')))
    expect(await Effect.runPromise(handleFoodConsumption(s as never))).toBe(false)
    expect(s.hungerService.eat).not.toHaveBeenCalled()
  })

  it('returns false when hunger bar is already full', async () => {
    const s = makeServices()
    s.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('APPLE')))
    s.hungerService.getHunger.mockReturnValue(Effect.succeed(makeHunger(MAX_FOOD_LEVEL)))
    expect(await Effect.runPromise(handleFoodConsumption(s as never))).toBe(false)
    expect(s.inventoryService.removeBlock).not.toHaveBeenCalled()
  })

  it('eats food when hungry: removes item, updates hunger, returns true', async () => {
    const s = makeServices()
    s.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('APPLE')))
    // hunger at 10 (< MAX_FOOD_LEVEL=20) — eating is allowed
    const ate = await Effect.runPromise(handleFoodConsumption(s as never))
    expect(ate).toBe(true)
    expect(s.inventoryService.removeBlock).toHaveBeenCalledWith('APPLE', 1, expect.anything())
    expect(s.hungerService.eat).toHaveBeenCalled()
    expect(s.healthService.heal).not.toHaveBeenCalled()
  })

  it('GOLDEN_APPLE also calls healthService.heal(4) in addition to eating', async () => {
    const s = makeServices()
    s.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('GOLDEN_APPLE')))
    const ate = await Effect.runPromise(handleFoodConsumption(s as never))
    expect(ate).toBe(true)
    expect(s.hungerService.eat).toHaveBeenCalled()
    expect(s.healthService.heal).toHaveBeenCalledWith(4)
  })

  it('FISHING_ROD while already fishing: cancels and returns true', async () => {
    const s = makeServices()
    s.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('FISHING_ROD')))
    s.fishingService.isFishing.mockReturnValue(Effect.succeed(true))
    const result = await Effect.runPromise(handleFoodConsumption(s as never))
    expect(result).toBe(true)
    expect(s.fishingService.cancel).toHaveBeenCalled()
    expect(s.fishingService.cast).not.toHaveBeenCalled()
  })

  it('FISHING_ROD while not fishing: casts and returns true', async () => {
    const s = makeServices()
    s.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('FISHING_ROD')))
    s.fishingService.isFishing.mockReturnValue(Effect.succeed(false))
    const result = await Effect.runPromise(handleFoodConsumption(s as never))
    expect(result).toBe(true)
    expect(s.fishingService.cast).toHaveBeenCalled()
    expect(s.fishingService.cancel).not.toHaveBeenCalled()
  })

  it('armor item (IRON_HELMET): equips to armor slot and returns true', async () => {
    const s = makeServices()
    const helmetStack = { itemType: 'IRON_HELMET', count: 1 }
    s.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('IRON_HELMET')))
    s.inventoryService.getSlot.mockReturnValue(Effect.succeed(Option.some(helmetStack)))
    // no existing helmet — displaced is null
    s.equipmentService.getEquippedItem.mockReturnValue(Effect.succeed(Option.none()))
    const result = await Effect.runPromise(handleFoodConsumption(s as never))
    expect(result).toBe(true)
    expect(s.inventoryService.removeBlock).toHaveBeenCalled()
    expect(s.equipmentService.equip).toHaveBeenCalledWith(helmetStack)
  })
})

// ─── handleUnequipArmor ───────────────────────────────────────────────────────

describe('handleUnequipArmor', () => {
  it('does nothing when all armor slots are empty', async () => {
    const s = makeServices()
    // default: unequipSlot always returns Option.none()
    await Effect.runPromise(handleUnequipArmor(s as never))
    expect(s.inventoryService.addBlock).not.toHaveBeenCalled()
    expect(s.equipmentService.equip).not.toHaveBeenCalled()
  })

  it('unequips the first occupied slot (HELMET) and adds it to inventory', async () => {
    const s = makeServices()
    const helmetStack = { itemType: 'IRON_HELMET', count: 1 }
    s.equipmentService.unequipSlot.mockImplementation((slot: string) =>
      Effect.succeed(slot === 'HELMET' ? Option.some(helmetStack) : Option.none()),
    )
    await Effect.runPromise(handleUnequipArmor(s as never))
    expect(s.inventoryService.addBlock).toHaveBeenCalledWith('IRON_HELMET', 1)
    expect(s.equipmentService.equip).not.toHaveBeenCalled()
  })

  it('skips empty slots and unequips the first occupied one (CHESTPLATE)', async () => {
    const s = makeServices()
    const chestStack = { itemType: 'IRON_CHESTPLATE', count: 1 }
    s.equipmentService.unequipSlot.mockImplementation((slot: string) =>
      Effect.succeed(slot === 'CHESTPLATE' ? Option.some(chestStack) : Option.none()),
    )
    await Effect.runPromise(handleUnequipArmor(s as never))
    expect(s.inventoryService.addBlock).toHaveBeenCalledWith('IRON_CHESTPLATE', 1)
  })

  it('re-equips armor when inventory is full (addBlock fails)', async () => {
    const s = makeServices()
    const helmetStack = { itemType: 'IRON_HELMET', count: 1 }
    s.equipmentService.unequipSlot.mockImplementation((slot: string) =>
      Effect.succeed(slot === 'HELMET' ? Option.some(helmetStack) : Option.none()),
    )
    s.inventoryService.addBlock.mockReturnValue(Effect.fail('inventory-full'))
    await Effect.runPromise(handleUnequipArmor(s as never))
    // rollback: armor is re-equipped after failed addBlock
    expect(s.equipmentService.equip).toHaveBeenCalledWith(helmetStack)
  })
})
