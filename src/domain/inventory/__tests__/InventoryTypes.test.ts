/**
 * InventoryTypes テスト
 *
 * 型定義とSchemaのバリデーションテスト
 */

import { describe, it, expect } from 'vitest'
import { Effect, pipe, Either, Exit } from 'effect'
import { Schema } from '@effect/schema'
import {
  PlayerId,
  ItemId,
  ItemStack,
  Inventory,
  createEmptyInventory,
  validateInventory,
  ItemMetadata,
} from '../InventoryTypes'

describe('InventoryTypes', () => {
  describe('Basic Types', () => {
    it('should create valid PlayerId', () => {
      const playerIdSchema = Schema.String.pipe(Schema.fromBrand(PlayerId))
      const result = Schema.decodeEither(playerIdSchema)('player123')
      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right).toBe('player123')
      }
    })

    it('should reject invalid PlayerId', () => {
      const playerIdSchema = Schema.String.pipe(Schema.fromBrand(PlayerId))
      const result = Schema.decodeEither(playerIdSchema)(123 as any) // number instead of string
      expect(Either.isLeft(result)).toBe(true)
    })

    it('should create valid ItemId', () => {
      const itemIdSchema = Schema.String.pipe(Schema.fromBrand(ItemId))
      const result = Schema.decodeEither(itemIdSchema)('minecraft:diamond')
      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right).toBe('minecraft:diamond')
      }
    })
  })

  describe('ItemStack', () => {
    it('should create valid ItemStack', () => {
      const itemStack = {
        itemId: 'minecraft:stone' as ItemId,
        count: 64,
        metadata: {
          damage: 10,
          customName: 'Special Stone',
        },
      }

      const result = Schema.decodeEither(ItemStack)(itemStack)
      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right.itemId).toBe('minecraft:stone')
        expect(result.right.count).toBe(64)
        expect(result.right.metadata?.damage).toBe(10)
      }
    })

    it('should reject ItemStack with invalid count', () => {
      const itemStack = {
        itemId: 'minecraft:stone',
        count: -1,
      }

      const result = Schema.decodeEither(ItemStack)(itemStack)
      expect(Either.isLeft(result)).toBe(true)
    })

    it('should accept ItemStack without metadata', () => {
      const itemStack = {
        itemId: 'minecraft:stone',
        count: 32,
      }

      const result = Schema.decodeEither(ItemStack)(itemStack)
      expect(Either.isRight(result)).toBe(true)
    })
  })

  describe('Inventory', () => {
    it('should create empty inventory', () => {
      const playerId = 'player1' as PlayerId
      const inventory = createEmptyInventory(playerId)

      expect(inventory.playerId).toBe(playerId)
      expect(inventory.slots).toHaveLength(36)
      expect(inventory.slots.every((slot) => slot === null)).toBe(true)
      expect(inventory.hotbar).toHaveLength(9)
      expect(inventory.selectedSlot).toBe(0)
    })

    it('should validate valid inventory', () => {
      const playerId = 'player1' as PlayerId
      const inventory = createEmptyInventory(playerId)
      const result = Effect.runSyncExit(validateInventory(inventory))

      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result)) {
        expect(result.value).toEqual(inventory)
      }
    })

    it('should reject inventory with invalid slot count', () => {
      const inventory = {
        playerId: 'player1',
        slots: new Array(10).fill(null), // Wrong size
        hotbar: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        selectedSlot: 0,
        armor: {
          helmet: null,
          chestplate: null,
          leggings: null,
          boots: null,
        },
        offhand: null,
      }

      const result = Schema.decodeEither(Inventory)(inventory)
      expect(Either.isLeft(result)).toBe(true)
    })

    it('should handle inventory with items', () => {
      const playerId = 'player1' as PlayerId
      const inventory = {
        ...createEmptyInventory(playerId),
        slots: [
          {
            itemId: 'minecraft:diamond' as ItemId,
            count: 10,
          },
          ...Array(8).fill(null),
          {
            itemId: 'minecraft:iron_ingot' as ItemId,
            count: 64,
            metadata: {
              damage: 0,
            },
          },
          ...Array(26).fill(null),
        ],
      }

      const result = Effect.runSync(validateInventory(inventory))
      expect(result).toBeDefined()
    })
  })

  describe('ItemMetadata', () => {
    it('should create valid metadata with enchantments', () => {
      const metadata: ItemMetadata = {
        enchantments: [
          { id: 'sharpness', level: 5 },
          { id: 'unbreaking', level: 3 },
        ],
        damage: 100,
        customName: 'Legendary Sword',
        lore: ['Forged by ancient smiths', 'Imbued with magic'],
      }

      const result = Schema.decodeEither(ItemMetadata)(metadata)
      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right.enchantments).toHaveLength(2)
        expect(result.right.enchantments?.[0]?.id).toBe('sharpness')
        expect(result.right.customName).toBe('Legendary Sword')
      }
    })

    it('should accept empty metadata', () => {
      const metadata = {}
      const result = Schema.decodeEither(ItemMetadata)(metadata)
      expect(Either.isRight(result)).toBe(true)
    })

    it('should handle durability metadata', () => {
      const metadata: ItemMetadata = {
        durability: 150,
      }

      const result = Schema.decodeEither(ItemMetadata)(metadata)
      expect(Either.isRight(result)).toBe(true)
    })
  })

  describe('Armor Slots', () => {
    it('should handle armor equipment', () => {
      const playerId = 'player1' as PlayerId
      const inventory = {
        ...createEmptyInventory(playerId),
        armor: {
          helmet: {
            itemId: 'minecraft:diamond_helmet' as ItemId,
            count: 1,
            metadata: {
              damage: 50,
            },
          },
          chestplate: {
            itemId: 'minecraft:iron_chestplate' as ItemId,
            count: 1,
          },
          leggings: null,
          boots: null,
        },
      }

      const result = Effect.runSync(validateInventory(inventory))
      expect(result).toBeDefined()
    })
  })

  describe('Schema Encoding/Decoding', () => {
    it('should roundtrip inventory through encode/decode', () => {
      const playerId = 'player1' as PlayerId
      const original = {
        ...createEmptyInventory(playerId),
        slots: [
          {
            itemId: 'minecraft:apple' as ItemId,
            count: 32,
          },
          ...Array(35).fill(null),
        ],
      }

      const encoded = Schema.encodeSync(Inventory)(original)
      const decoded = Schema.decodeSync(Inventory)(encoded)

      expect(decoded.playerId).toBe(original.playerId)
      expect(decoded.slots).toHaveLength(36)
      expect(decoded.slots[0]?.itemId).toBe('minecraft:apple')
      expect(decoded.slots[0]?.count).toBe(32)
    })
  })
})
