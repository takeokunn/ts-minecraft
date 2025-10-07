import { PlayerId } from '@domain/shared/entities/player_id'
import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import { InventoryRepositoryStorageSchema } from '../storage_schema'

describe('InventoryRepositoryStorageSchema', () => {
  describe('有効なデータのデコード', () => {
    it('完全なインベントリデータをデコードできる', () => {
      const validData = {
        inventories: {
          player_123: {
            id: 'inventory-player_123',
            playerId: 'player_123' as PlayerId,
            slots: [{ itemId: 'minecraft:stone', count: 64, metadata: undefined }, null],
            hotbar: [0, 1, 2, 3, 4, 5, 6, 7, 8],
            selectedSlot: 0,
            armor: {
              helmet: null,
              chestplate: null,
              leggings: null,
              boots: null,
            },
            offhand: null,
            version: 1,
            metadata: {
              lastUpdated: Date.now(),
              checksum: 'abc123',
            },
          },
        },
        snapshots: undefined,
        timestamp: Date.now(),
      }

      const result = Schema.decodeUnknownSync(InventoryRepositoryStorageSchema)(validData)
      expect(result).toEqual(validData)
    })

    it('スナップショット付きデータをデコードできる', () => {
      const validData = {
        inventories: {},
        snapshots: {
          snap_1: {
            snapshotId: 'snap_1',
            inventory: {
              id: 'inventory-player_456',
              playerId: 'player_456' as PlayerId,
              slots: [],
              hotbar: [0, 1, 2, 3, 4, 5, 6, 7, 8],
              selectedSlot: 0,
              armor: {
                helmet: null,
                chestplate: null,
                leggings: null,
                boots: null,
              },
              offhand: null,
              version: 0,
              metadata: {
                lastUpdated: Date.now(),
                checksum: 'xyz789',
              },
            },
            timestamp: Date.now(),
            reason: 'Manual save',
          },
        },
      }

      const result = Schema.decodeUnknownSync(InventoryRepositoryStorageSchema)(validData)
      expect(result.snapshots).toBeDefined()
      expect(result.snapshots!['snap_1'].snapshotId).toBe('snap_1')
    })

    it('空のデータ構造をデコードできる', () => {
      const emptyData = {
        inventories: undefined,
        snapshots: undefined,
      }

      const result = Schema.decodeUnknownSync(InventoryRepositoryStorageSchema)(emptyData)
      expect(result.inventories).toBeUndefined()
      expect(result.snapshots).toBeUndefined()
    })

    it('省略可能なフィールドを持つデータをデコードできる', () => {
      const dataWithOptionals = {
        inventories: {
          player_789: {
            id: 'inventory-player_789',
            playerId: 'player_789' as PlayerId,
            slots: [],
            hotbar: [0, 1, 2, 3, 4, 5, 6, 7, 8],
            selectedSlot: 0,
            armor: {
              helmet: null,
              chestplate: null,
              leggings: null,
              boots: null,
            },
            offhand: null,
            version: 0,
            metadata: {
              lastUpdated: Date.now(),
              checksum: 'checksum',
            },
          },
        },
      }

      const result = Schema.decodeUnknownSync(InventoryRepositoryStorageSchema)(dataWithOptionals)
      expect(result.timestamp).toBeUndefined()
    })
  })

  describe('無効なデータの検証', () => {
    it('selectedSlotが負の値の場合はエラー', () => {
      const invalidData = {
        inventories: {
          player_111: {
            id: 'inventory-player_111',
            playerId: 'player_111' as PlayerId,
            slots: [],
            hotbar: [0, 1, 2, 3, 4, 5, 6, 7, 8],
            selectedSlot: -1, // 負の値
            armor: {
              helmet: null,
              chestplate: null,
              leggings: null,
              boots: null,
            },
            offhand: null,
            version: 0,
            metadata: {
              lastUpdated: Date.now(),
              checksum: 'checksum',
            },
          },
        },
      }

      expect(() => Schema.decodeUnknownSync(InventoryRepositoryStorageSchema)(invalidData)).toThrow()
    })

    it('versionが負の値の場合はエラー', () => {
      const invalidData = {
        inventories: {
          player_222: {
            id: 'inventory-player_222',
            playerId: 'player_222' as PlayerId,
            slots: [],
            hotbar: [0, 1, 2, 3, 4, 5, 6, 7, 8],
            selectedSlot: 0,
            armor: {
              helmet: null,
              chestplate: null,
              leggings: null,
              boots: null,
            },
            offhand: null,
            version: -1, // 負の値
            metadata: {
              lastUpdated: Date.now(),
              checksum: 'checksum',
            },
          },
        },
      }

      expect(() => Schema.decodeUnknownSync(InventoryRepositoryStorageSchema)(invalidData)).toThrow()
    })

    it('slots配列が上限を超える場合はエラー', () => {
      const invalidData = {
        inventories: {
          player_333: {
            id: 'inventory-player_333',
            playerId: 'player_333' as PlayerId,
            slots: Array.from({ length: 55 }, () => null), // 54を超える
            hotbar: [0, 1, 2, 3, 4, 5, 6, 7, 8],
            selectedSlot: 0,
            armor: {
              helmet: null,
              chestplate: null,
              leggings: null,
              boots: null,
            },
            offhand: null,
            version: 0,
            metadata: {
              lastUpdated: Date.now(),
              checksum: 'checksum',
            },
          },
        },
      }

      expect(() => Schema.decodeUnknownSync(InventoryRepositoryStorageSchema)(invalidData)).toThrow()
    })

    it('hotbar配列が上限を超える場合はエラー', () => {
      const invalidData = {
        inventories: {
          player_444: {
            id: 'inventory-player_444',
            playerId: 'player_444' as PlayerId,
            slots: [],
            hotbar: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], // 9を超える
            selectedSlot: 0,
            armor: {
              helmet: null,
              chestplate: null,
              leggings: null,
              boots: null,
            },
            offhand: null,
            version: 0,
            metadata: {
              lastUpdated: Date.now(),
              checksum: 'checksum',
            },
          },
        },
      }

      expect(() => Schema.decodeUnknownSync(InventoryRepositoryStorageSchema)(invalidData)).toThrow()
    })
  })

  describe('エッジケース', () => {
    it('itemStackのcountが正の整数であることを検証', () => {
      const dataWithZeroCount = {
        inventories: {
          player_555: {
            id: 'inventory-player_555',
            playerId: 'player_555' as PlayerId,
            slots: [
              { itemId: 'minecraft:stone', count: 0, metadata: undefined }, // ゼロ
            ],
            hotbar: [0, 1, 2, 3, 4, 5, 6, 7, 8],
            selectedSlot: 0,
            armor: {
              helmet: null,
              chestplate: null,
              leggings: null,
              boots: null,
            },
            offhand: null,
            version: 0,
            metadata: {
              lastUpdated: Date.now(),
              checksum: 'checksum',
            },
          },
        },
      }

      expect(() => Schema.decodeUnknownSync(InventoryRepositoryStorageSchema)(dataWithZeroCount)).toThrow()
    })

    it('アイテムメタデータの構造を検証', () => {
      const dataWithMetadata = {
        inventories: {
          player_666: {
            id: 'inventory-player_666',
            playerId: 'player_666' as PlayerId,
            slots: [
              {
                itemId: 'minecraft:diamond_sword',
                count: 1,
                metadata: {
                  durability: 0.5,
                  enchantments: [{ id: 'minecraft:sharpness', level: 5 }],
                  customName: 'Legendary Sword',
                  lore: ['A powerful weapon'],
                },
              },
            ],
            hotbar: [0, 1, 2, 3, 4, 5, 6, 7, 8],
            selectedSlot: 0,
            armor: {
              helmet: null,
              chestplate: null,
              leggings: null,
              boots: null,
            },
            offhand: null,
            version: 0,
            metadata: {
              lastUpdated: Date.now(),
              checksum: 'checksum',
            },
          },
        },
      }

      const result = Schema.decodeUnknownSync(InventoryRepositoryStorageSchema)(dataWithMetadata)
      const inventory = result.inventories!['player_666']
      const item = inventory.slots[0]

      expect(item).not.toBeNull()
      if (item && 'itemId' in item) {
        expect(item.metadata?.durability).toBe(0.5)
        expect(item.metadata?.enchantments).toHaveLength(1)
      }
    })
  })
})
