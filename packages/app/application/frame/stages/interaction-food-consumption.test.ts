import { describe, it, expect, vi } from 'vitest'
import { Effect, Option } from 'effect'
import { handleFoodConsumption } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler/food-consumption'
import { MAX_FOOD_LEVEL } from '@ts-minecraft/entity/application/hunger-service.config'

// Base mock factory — every service method starts as a vi.fn() returning safe
// defaults. Individual tests override only the fields they care about.
const makeServices = () => ({
  hotbarService: {
    getSelectedBlockType: vi.fn(() => Effect.succeed(Option.none<string>())),
    getSelectedSlot: vi.fn(() => Effect.succeed(0)),
  },
  hungerService: {
    getHunger: vi.fn(() => Effect.succeed({ foodLevel: 10, saturation: 5, exhaustion: 0 })),
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

describe('handleFoodConsumption', () => {
  it('returns false when nothing is held', async () => {
    const s = makeServices()
    expect(await Effect.runPromise(handleFoodConsumption(s as never))).toBe(false)
    expect(s.inventoryService.removeBlock).not.toHaveBeenCalled()
  })

  it('returns false for a non-food, non-armor item (STONE)', async () => {
    const s = makeServices()
    s.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('STONE')))
    expect(await Effect.runPromise(handleFoodConsumption(s as never))).toBe(false)
    expect(s.hungerService.eat).not.toHaveBeenCalled()
  })

  it('returns false for a valid item that is not food or equipment', async () => {
    const s = makeServices()
    s.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('COAL')))
    expect(await Effect.runPromise(handleFoodConsumption(s as never))).toBe(false)
    expect(s.hungerService.eat).not.toHaveBeenCalled()
  })

  it('returns false for an unknown held item', async () => {
    const s = makeServices()
    s.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('NOT_AN_ITEM')))
    expect(await Effect.runPromise(handleFoodConsumption(s as never))).toBe(false)
    expect(s.hungerService.getHunger).not.toHaveBeenCalled()
  })

  it('returns false when hunger bar is already full', async () => {
    const s = makeServices()
    s.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('APPLE')))
    s.hungerService.getHunger.mockReturnValue(Effect.succeed({ foodLevel: MAX_FOOD_LEVEL, saturation: 5, exhaustion: 0 }))
    expect(await Effect.runPromise(handleFoodConsumption(s as never))).toBe(false)
    expect(s.inventoryService.removeBlock).not.toHaveBeenCalled()
  })

  it('eats food when hungry: removes item, updates hunger, returns true', async () => {
    const s = makeServices()
    s.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('APPLE')))
    const ate = await Effect.runPromise(handleFoodConsumption(s as never))
    expect(ate).toBe(true)
    expect(s.inventoryService.removeBlock).toHaveBeenCalledWith('APPLE', 1, expect.anything())
    expect(s.hungerService.eat).toHaveBeenCalled()
    expect(s.healthService.heal).not.toHaveBeenCalled()
  })

  it('still handles food when inventory removal fails', async () => {
    const s = makeServices()
    s.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('APPLE')))
    s.inventoryService.removeBlock.mockReturnValue(Effect.fail('slot-empty'))
    expect(await Effect.runPromise(handleFoodConsumption(s as never))).toBe(true)
    expect(s.hungerService.eat).not.toHaveBeenCalled()
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

  it('passes fishing rod XP and enchantment levels into cast', async () => {
    const s = makeServices()
    s.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('FISHING_ROD')))
    s.xpService.getXP.mockReturnValue(Effect.succeed({ totalXP: 12, xpIntoLevel: 5, level: 2 }))
    s.inventoryService.getSlot.mockReturnValue(Effect.succeed(Option.some({
      itemType: 'FISHING_ROD',
      count: 1,
      enchantments: [
        { type: 'LURE', level: 2 },
        { type: 'LUCK_OF_THE_SEA', level: 3 },
      ],
    })))
    const result = await Effect.runPromise(handleFoodConsumption(s as never))
    expect(result).toBe(true)
    expect(s.fishingService.cast).toHaveBeenCalledWith(17, 2, 3)
  })

  it('armor item (IRON_HELMET): equips to armor slot and returns true', async () => {
    const s = makeServices()
    const helmetStack = { itemType: 'IRON_HELMET', count: 1 }
    s.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('IRON_HELMET')))
    s.inventoryService.getSlot.mockReturnValue(Effect.succeed(Option.some(helmetStack)))
    s.equipmentService.getEquippedItem.mockReturnValue(Effect.succeed(Option.none()))
    const result = await Effect.runPromise(handleFoodConsumption(s as never))
    expect(result).toBe(true)
    expect(s.inventoryService.removeBlock).toHaveBeenCalled()
    expect(s.equipmentService.equip).toHaveBeenCalledWith(helmetStack)
  })

  it('returns false when selected armor is not present in the selected hotbar slot', async () => {
    const s = makeServices()
    s.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('IRON_HELMET')))
    s.inventoryService.getSlot.mockReturnValue(Effect.succeed(Option.none()))
    expect(await Effect.runPromise(handleFoodConsumption(s as never))).toBe(false)
    expect(s.equipmentService.equip).not.toHaveBeenCalled()
  })

  it('returns false when the selected armor slot read fails', async () => {
    const s = makeServices()
    s.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('IRON_HELMET')))
    s.inventoryService.getSlot.mockReturnValue(Effect.fail('read-failed'))
    expect(await Effect.runPromise(handleFoodConsumption(s as never))).toBe(false)
    expect(s.equipmentService.equip).not.toHaveBeenCalled()
  })

  it('returns false when selected armor does not match the hotbar stack', async () => {
    const s = makeServices()
    s.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('IRON_HELMET')))
    s.inventoryService.getSlot.mockReturnValue(Effect.succeed(Option.some({ itemType: 'STONE', count: 1 })))
    expect(await Effect.runPromise(handleFoodConsumption(s as never))).toBe(false)
    expect(s.equipmentService.equip).not.toHaveBeenCalled()
  })

  it('moves displaced armor back to inventory when equipping from the hotbar', async () => {
    const s = makeServices()
    const helmetStack = { itemType: 'IRON_HELMET', count: 1 }
    const displacedStack = { itemType: 'LEATHER_HELMET', count: 1 }
    s.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('IRON_HELMET')))
    s.inventoryService.getSlot.mockReturnValue(Effect.succeed(Option.some(helmetStack)))
    s.equipmentService.getEquippedItem.mockReturnValue(Effect.succeed(Option.some(displacedStack)))
    expect(await Effect.runPromise(handleFoodConsumption(s as never))).toBe(true)
    expect(s.inventoryService.addBlock).toHaveBeenCalledWith('LEATHER_HELMET', 1)
  })

  it('still handles armor interaction when equip side effects fail', async () => {
    const s = makeServices()
    s.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('IRON_HELMET')))
    s.inventoryService.getSlot.mockReturnValue(Effect.succeed(Option.some({ itemType: 'IRON_HELMET', count: 1 })))
    s.inventoryService.removeBlock.mockReturnValue(Effect.fail('remove-failed'))
    expect(await Effect.runPromise(handleFoodConsumption(s as never))).toBe(true)
    expect(s.equipmentService.equip).not.toHaveBeenCalled()
  })
})
