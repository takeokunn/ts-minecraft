import { Effect, Exit } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  addItem,
  canAcceptItem,
  createDisplayName,
  createDurability,
  createEnchantment,
  createItemId,
  createItemMetadata,
  createPlayerInventory,
  createSlot,
  createSlotConstraint,
  createSlotId,
  createSlotPosition,
  createStackSize,
  getSlotSection,
  gridToPosition,
  positionToGrid,
  SlotState,
} from '../index'

describe('Inventory Value Objects Integration Tests', () => {
  describe('Complete Slot with Item Integration', () => {
    it('should create a complete slot with item and verify operations', async () => {
      const program = Effect.gen(function* () {
        // Create slot components
        const slotId = yield* createSlotId(5)
        const slotConstraint = yield* createSlotConstraint(64, ['minecraft:stone', 'minecraft:cobblestone'])
        const emptyState = SlotState.Empty({})

        // Create slot
        const slot = yield* createSlot(slotId, emptyState, slotConstraint, { row: 0, column: 5 })

        // Create item
        const itemId = yield* createItemId('minecraft:stone')
        const stackSize = yield* createStackSize(32)

        // Test acceptance
        const acceptance = yield* canAcceptItem(slot, itemId, stackSize as number)
        expect(acceptance._tag).toBe('Accepted')

        // Add item to slot
        const slotWithItem = yield* addItem(slot, itemId, stackSize as number)

        // Verify slot state
        expect(slotWithItem.state._tag).toBe('Occupied')
        if (slotWithItem.state._tag === 'Occupied') {
          expect(slotWithItem.state.itemId).toBe('minecraft:stone')
          expect(slotWithItem.state.quantity).toBe(32)
        }

        return { slot: slotWithItem, itemId, stackSize }
      })

      const result = await Effect.runPromise(program)
      expect(result).toBeDefined()
    })

    it('should reject incompatible items', async () => {
      const program = Effect.gen(function* () {
        const slotId = yield* createSlotId(0)
        const slotConstraint = yield* createSlotConstraint(64, ['minecraft:wood']) // Only wood allowed
        const emptyState = SlotState.Empty({})

        const slot = yield* createSlot(slotId, emptyState, slotConstraint, { row: 0, column: 0 })
        const itemId = yield* createItemId('minecraft:stone') // Stone not allowed
        const stackSize = yield* createStackSize(10)

        const acceptance = yield* canAcceptItem(slot, itemId, stackSize as number)
        expect(acceptance._tag).toBe('Rejected')

        return acceptance
      })

      const result = await Effect.runPromise(program)
      expect(result._tag).toBe('Rejected')
    })
  })

  describe('Item with Metadata Integration', () => {
    it('should create item with enchantments and durability', async () => {
      const program = Effect.gen(function* () {
        // Create basic item
        const itemId = yield* createItemId('minecraft:diamond_sword')

        // Create enchantment
        const sharpness = yield* createEnchantment('minecraft:sharpness', 3)

        // Create durability
        const durability = yield* createDurability(1200, 1561) // Damaged diamond sword

        // Create display name
        const displayName = yield* createDisplayName('Legendary Blade')

        // Create metadata
        const metadata = yield* createItemMetadata({
          display: {
            name: displayName,
          },
          enchantments: [sharpness],
          durability,
        })

        expect(metadata.display?.name).toBe('Legendary Blade')
        expect(metadata.enchantments).toHaveLength(1)
        expect(metadata.durability?.current).toBe(1200)
        expect(metadata.durability?.max).toBe(1561)

        return { itemId, metadata }
      })

      const result = await Effect.runPromise(program)
      expect(result).toBeDefined()
    })
  })

  describe('Position and Grid Conversion Integration', () => {
    it('should convert positions correctly', async () => {
      const program = Effect.gen(function* () {
        // Test various position conversions
        const position5 = yield* createSlotPosition(5) // Row 0, Column 5
        const grid5 = yield* positionToGrid(position5)
        expect(grid5.row).toBe(0)
        expect(grid5.column).toBe(5)

        const position27 = yield* createSlotPosition(27) // Row 3, Column 0
        const grid27 = yield* positionToGrid(position27)
        expect(grid27.row).toBe(3)
        expect(grid27.column).toBe(0)

        // Convert back
        const backToPosition = yield* gridToPosition(grid5)
        expect(backToPosition).toBe(5)

        return { position5, grid5, position27, grid27 }
      })

      const result = await Effect.runPromise(program)
      expect(result).toBeDefined()
    })

    it('should identify slot sections correctly', async () => {
      const program = Effect.gen(function* () {
        // Hotbar slot
        const hotbarPos = yield* createSlotPosition(3)
        const hotbarSection = getSlotSection(hotbarPos)
        expect(hotbarSection._tag).toBe('Hotbar')

        // Main inventory slot
        const mainPos = yield* createSlotPosition(15)
        const mainSection = getSlotSection(mainPos)
        expect(mainSection._tag).toBe('MainInventory')

        return { hotbarSection, mainSection }
      })

      const result = await Effect.runPromise(program)
      expect(result).toBeDefined()
    })
  })

  describe('Inventory Type and Capacity Integration', () => {
    it('should create player inventory with correct capacity', async () => {
      const program = Effect.gen(function* () {
        const playerInventory = yield* createPlayerInventory()

        expect(playerInventory._tag).toBe('Player')
        if (playerInventory._tag === 'Player') {
          expect(playerInventory.slots).toBe(36)
          expect(playerInventory.hotbarSlots).toBe(9)
          expect(playerInventory.armorSlots).toBe(4)
          expect(playerInventory.offhandSlots).toBe(1)
        }

        return playerInventory
      })

      const result = await Effect.runPromise(program)
      expect(result).toBeDefined()
    })
  })

  describe('Stack Operations Integration', () => {
    it('should handle stack operations with constraints', async () => {
      const program = Effect.gen(function* () {
        // Create stackable item
        const itemId = yield* createItemId('minecraft:cobblestone')
        const stack1 = yield* createStackSize(40)
        const stack2 = yield* createStackSize(30)
        const maxSize = yield* createStackSize(64)

        // Test stacking
        const result = yield* addToStack(stack1, stack2, maxSize)

        if (result._tag === 'Overflow') {
          expect(result.maxSize).toBe(64)
          expect(result.overflow).toBe(6) // 40 + 30 - 64 = 6
        } else if (result._tag === 'Success') {
          expect(result.newSize).toBe(70)
        }

        return result
      })

      const result = await Effect.runPromise(program)
      expect(result).toBeDefined()
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle invalid slot positions gracefully', async () => {
      const program = Effect.gen(function* () {
        // Try to create invalid position
        const invalidPosition = createSlotPosition(50) // Out of range (0-35)

        const exit = yield* Effect.exit(invalidPosition)
        expect(Exit.isFailure(exit)).toBe(true)

        if (Exit.isFailure(exit)) {
          expect(exit.cause._tag).toBe('Fail')
          if (exit.cause._tag === 'Fail') {
            expect(exit.cause.error._tag).toBe('PositionOutOfRange')
          }
        }

        return exit
      })

      const result = await Effect.runPromise(program)
      expect(result).toBeDefined()
    })

    it('should handle invalid item IDs gracefully', async () => {
      const program = Effect.gen(function* () {
        // Try to create invalid item ID
        const invalidItemId = createItemId('invalid-format') // Missing namespace

        const exit = yield* Effect.exit(invalidItemId)
        expect(Exit.isFailure(exit)).toBe(true)

        if (Exit.isFailure(exit)) {
          expect(exit.cause._tag).toBe('Fail')
          if (exit.cause._tag === 'Fail') {
            expect(exit.cause.error._tag).toBe('InvalidFormat')
          }
        }

        return exit
      })

      const result = await Effect.runPromise(program)
      expect(result).toBeDefined()
    })
  })

  describe('Complex Scenarios Integration', () => {
    it('should handle a complete inventory scenario', async () => {
      const program = Effect.gen(function* () {
        // Create player inventory
        const inventoryType = yield* createPlayerInventory()

        // Create multiple slots with different items
        const slots = []

        // Hotbar slot with sword
        const swordSlotId = yield* createSlotId(0)
        const swordConstraint = yield* createSlotConstraint(1, [], false, true) // Tools don't stack
        const swordState = SlotState.Occupied({
          itemId: 'minecraft:diamond_sword',
          quantity: 1,
        })
        const swordSlot = yield* createSlot(swordSlotId, swordState, swordConstraint, { row: 0, column: 0 })
        slots.push(swordSlot)

        // Main inventory slot with blocks
        const blockSlotId = yield* createSlotId(15)
        const blockConstraint = yield* createSlotConstraint(64, ['minecraft:stone', 'minecraft:cobblestone'])
        const blockState = SlotState.Occupied({
          itemId: 'minecraft:stone',
          quantity: 45,
        })
        const blockSlot = yield* createSlot(blockSlotId, blockState, blockConstraint, { row: 1, column: 6 })
        slots.push(blockSlot)

        // Verify slots
        expect(slots).toHaveLength(2)
        expect(slots[0].constraint.isHotbar).toBe(true)
        expect(slots[1].constraint.maxStackSize).toBe(64)

        return { inventoryType, slots }
      })

      const result = await Effect.runPromise(program)
      expect(result.slots).toHaveLength(2)
    })
  })
})
