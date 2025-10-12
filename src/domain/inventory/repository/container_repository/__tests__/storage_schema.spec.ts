/**
 * @fileoverview ContainerStorageDataSchemaのテスト
 */

import { Effect, Schema } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { ContainerRepositoryStorageSchema, ContainerStorageDataSchema } from '../storage_schema'

describe('ContainerStorageDataSchema', () => {
  const decodeContainer = Schema.decodeUnknown(ContainerStorageDataSchema)
  const decodeContainerEither = Schema.decodeUnknownEither(ContainerStorageDataSchema)

  it.effect('有効なストレージデータをデコードできる', () =>
    Effect.gen(function* () {
      const validData = {
        id: 'container_12345678-1234-1234-1234-123456789012',
        type: 'chest' as const,
        capacity: 27,
        slots: {},
        version: 1,
      }

      const result = yield* decodeContainer(validData)
      expect(result.id).toBe(validData.id)
      expect(result.type).toBe('chest')
      expect(result.capacity).toBe(27)
    })
  )

  it.effect('スロット情報を含むデータをデコードできる', () =>
    Effect.gen(function* () {
      const validData = {
        id: 'container_12345678-1234-1234-1234-123456789012',
        type: 'chest' as const,
      capacity: 27,
      slots: {
        '0': {
          itemStack: {
            itemId: 'minecraft:stone',
            quantity: 64,
          },
        },
        '1': null,
      },
      version: 1,
    }

      const result = yield* decodeContainer(validData)
      expect(result.slots['0']).toBeDefined()
      expect(result.slots['0']?.itemStack?.itemId).toBe('minecraft:stone')
    })
  )

  it('無効な容量でエラーになる', () => {
    const invalidData = {
      id: 'container_12345678-1234-1234-1234-123456789012',
      type: 'chest' as const,
      capacity: -1, // 負の値
      slots: {},
      version: 1,
    }

    const result = decodeContainerEither(invalidData)
    expect(result._tag).toBe('Left')
  })

  it('無効なコンテナタイプでエラーになる', () => {
    const invalidData = {
      id: 'container_12345678-1234-1234-1234-123456789012',
      type: 'invalid_type', // 存在しないタイプ
      capacity: 27,
      slots: {},
      version: 1,
    }

    const result = decodeContainerEither(invalidData)
    expect(result._tag).toBe('Left')
  })

  it('無効なバージョンでエラーになる', () => {
    const invalidData = {
      id: 'container_12345678-1234-1234-1234-123456789012',
      type: 'chest' as const,
      capacity: 27,
      slots: {},
      version: 0, // 0以下
    }

    const result = decodeContainerEither(invalidData)
    expect(result._tag).toBe('Left')
  })

  it.effect('オプショナルフィールドを含むデータをデコードできる', () =>
    Effect.gen(function* () {
      const validData = {
        id: 'container_12345678-1234-1234-1234-123456789012',
        type: 'chest' as const,
        ownerId: 'player_abc123',
        worldId: 'world_main',
        position: { x: 100, y: 64, z: 200 },
        capacity: 27,
        slots: {},
        permissions: {
          public: false,
          owner: 'player_abc123',
          allowedPlayers: ['player_xyz789'],
        },
        lastAccessed: 1234567890,
        version: 1,
      }

      const result = yield* decodeContainer(validData)
      expect(result.ownerId).toBe('player_abc123')
      expect(result.position).toEqual({ x: 100, y: 64, z: 200 })
      expect(result.permissions?.owner).toBe('player_abc123')
    })
  )
})

describe('ContainerRepositoryStorageSchema', () => {
  const decodeRepository = Schema.decodeUnknown(ContainerRepositoryStorageSchema)
  const decodeRepositoryEither = Schema.decodeUnknownEither(ContainerRepositoryStorageSchema)

  it.effect('完全なリポジトリストレージデータをデコードできる', () =>
    Effect.gen(function* () {
      const validData = {
        containers: {
          'container_12345678-1234-1234-1234-123456789012': {
            id: 'container_12345678-1234-1234-1234-123456789012',
            type: 'chest' as const,
            capacity: 27,
            slots: {},
            version: 1,
          },
        },
        snapshots: {
          snapshot_1: {
            id: 'snapshot_1',
            name: 'backup_1',
            containerId: 'container_12345678-1234-1234-1234-123456789012',
            container: {
              id: 'container_12345678-1234-1234-1234-123456789012',
              type: 'chest' as const,
              capacity: 27,
              slots: {},
              version: 1,
            },
            createdAt: 1234567890,
          },
        },
        version: 1,
        lastSaved: 1234567890,
      }

      const result = yield* decodeRepository(validData)
      expect(result.containers).toBeDefined()
      expect(result.snapshots).toBeDefined()
      expect(result.version).toBe(1)
    })
  )

  it.effect('空のcontainersとsnapshotsをデコードできる', () =>
    Effect.gen(function* () {
      const validData = {
        version: 1,
        lastSaved: 1234567890,
      }

      const result = yield* decodeRepository(validData)
      expect(result.containers).toBeUndefined()
      expect(result.snapshots).toBeUndefined()
    })
  )

  it('無効なlastSavedでエラーになる', () => {
    const invalidData = {
      version: 1,
      lastSaved: -1, // 負の値
    }

    const result = decodeRepositoryEither(invalidData)
    expect(result._tag).toBe('Left')
  })
})
