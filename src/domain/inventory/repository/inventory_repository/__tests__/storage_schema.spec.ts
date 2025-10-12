import { PlayerId } from '@domain/shared/entities/player_id'
import { makeUnsafe as makeUnsafeTimestamp } from '@domain/shared/value_object/units/timestamp'
import { Effect, Option, Schema, pipe } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { InventoryRepositoryStorageSchema } from '../storage_schema'

const TIMESTAMP = makeUnsafeTimestamp(1_700_000_000_000)

describe('InventoryRepositoryStorageSchema', () => {
  const decode = Schema.decodeUnknown(InventoryRepositoryStorageSchema)
  const decodeEither = Schema.decodeUnknownEither(InventoryRepositoryStorageSchema)

  describe('有効なデータのデコード', () => {
    it.effect('完全なインベントリデータをデコードできる', () =>
      Effect.gen(function* () {
        const validData = {
          inventories: {
            player_123: {
              id: 'inventory-player_123',
              playerId: 'player_123' as PlayerId,
              slots: {
                0: { itemId: 'minecraft:stone', count: 64, metadata: undefined },
                1: null,
              },
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
                lastUpdated: TIMESTAMP,
                checksum: 'abc123',
              },
            },
          },
          snapshots: undefined,
          timestamp: TIMESTAMP,
        }

        const result = yield* decode(validData)
        expect(result).toEqual(validData)
      })
    )

    it.effect('スナップショット付きデータをデコードできる', () =>
      Effect.gen(function* () {
        const validData = {
          inventories: {},
          snapshots: {
            snap_1: {
              snapshotId: 'snap_1',
              inventory: {
                id: 'inventory-player_456',
                playerId: 'player_456' as PlayerId,
                slots: {},
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
                  lastUpdated: TIMESTAMP,
                  checksum: 'xyz789',
                },
              },
              timestamp: TIMESTAMP,
              reason: 'Manual save',
            },
          },
        }

        const result = yield* decode(validData)
        expect(result.snapshots).toBeDefined()
        expect(result.snapshots!['snap_1'].snapshotId).toBe('snap_1')
      })
    )

    it.effect('空のデータ構造をデコードできる', () =>
      Effect.gen(function* () {
        const emptyData = {
          inventories: undefined,
          snapshots: undefined,
        }

        const result = yield* decode(emptyData)
        expect(result.inventories).toBeUndefined()
        expect(result.snapshots).toBeUndefined()
      })
    )

    it.effect('省略可能なフィールドを持つデータをデコードできる', () =>
      Effect.gen(function* () {
        const dataWithOptionals = {
          inventories: {
            player_789: {
              id: 'inventory-player_789',
              playerId: 'player_789' as PlayerId,
              slots: {},
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
                lastUpdated: TIMESTAMP,
                checksum: 'checksum',
              },
            },
          },
        }

        const result = yield* decode(dataWithOptionals)
        expect(result.timestamp).toBeUndefined()
      })
    )
  })

  describe('無効なデータの検証', () => {
    it('selectedSlotが負の値の場合はエラー', () => {
      const invalidData = {
        inventories: {
          player_111: {
            id: 'inventory-player_111',
            playerId: 'player_111' as PlayerId,
            slots: {},
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
              lastUpdated: TIMESTAMP,
              checksum: 'checksum',
            },
          },
        },
      }

      const result = decodeEither(invalidData)
      expect(result._tag).toBe('Left')
    })

    it('versionが負の値の場合はエラー', () => {
      const invalidData = {
        inventories: {
          player_222: {
            id: 'inventory-player_222',
            playerId: 'player_222' as PlayerId,
            slots: {},
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
              lastUpdated: TIMESTAMP,
              checksum: 'checksum',
            },
          },
        },
      }

      const result = decodeEither(invalidData)
      expect(result._tag).toBe('Left')
    })

    it('slots配列が上限を超える場合はエラー', () => {
      const invalidData = {
        inventories: {
          player_333: {
            id: 'inventory-player_333',
            playerId: 'player_333' as PlayerId,
            slots: Object.fromEntries(Array.from({ length: 55 }, (_, index) => [index, null])), // 54を超える
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
              lastUpdated: TIMESTAMP,
              checksum: 'checksum',
            },
          },
        },
      }

      const result = decodeEither(invalidData)
      expect(result._tag).toBe('Left')
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
              lastUpdated: TIMESTAMP,
              checksum: 'checksum',
            },
          },
        },
      }

      const result = decodeEither(invalidData)
      expect(result._tag).toBe('Left')
    })
  })

  describe('エッジケース', () => {
    it('itemStackのcountが正の整数であることを検証', () => {
      const dataWithZeroCount = {
        inventories: {
          player_555: {
            id: 'inventory-player_555',
            playerId: 'player_555' as PlayerId,
            slots: {
              0: { itemId: 'minecraft:stone', count: 0, metadata: undefined }, // ゼロ
            },
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
              lastUpdated: TIMESTAMP,
              checksum: 'checksum',
            },
          },
        },
      }

      const result = decodeEither(dataWithZeroCount)
      expect(result._tag).toBe('Left')
    })

    it('アイテムメタデータの構造を検証', () => {
      const dataWithMetadata = {
        inventories: {
          player_666: {
            id: 'inventory-player_666',
            playerId: 'player_666' as PlayerId,
            slots: {
              0: {
                itemId: 'minecraft:diamond_sword',
                count: 1,
                metadata: {
                  durability: 0.5,
                  enchantments: [{ id: 'minecraft:sharpness', level: 5 }],
                  customName: 'Legendary Sword',
                  lore: ['A powerful weapon'],
                },
              },
            },
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
              lastUpdated: TIMESTAMP,
              checksum: 'checksum',
            },
          },
        },
      }

      const result = decode(dataWithMetadata)
      const inventory = result.inventories!['player_666']
      const item = inventory.slots['0']

      expect(item).not.toBeNull()
      pipe(
        Option.fromNullable(item),
        Option.filter((value): value is { itemId: string } & typeof value => 'itemId' in value),
        Option.match({
          onSome: (stack) => {
            expect(stack.metadata?.durability).toBe(0.5)
            expect(stack.metadata?.enchantments).toHaveLength(1)
          },
          onNone: () => {
            throw new Error('Expected item stack with itemId')
          },
        })
      )
    })
  })
})
