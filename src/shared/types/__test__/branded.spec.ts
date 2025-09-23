import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Schema, ParseResult, Effect, Either } from 'effect'
import {
  PlayerIdSchema,
  WorldCoordinateSchema,
  ChunkIdSchema,
  BlockTypeIdSchema,
  ChunkPosition,
  BlockPosition,
  EntityId,
  ItemId,
  SessionId,
  Timestamp,
  Version,
  UUID,
  BrandedTypes,
  type PlayerId,
  type WorldCoordinate,
  type ChunkId,
  type BlockTypeId,
} from '../branded'

describe('Branded Types', () => {
  describe('PlayerIdSchema', () => {
    it.effect('validates any string as PlayerId', () => Effect.gen(function* () {
    const testStrings = ['player1', 'user-123', '', 'very-long-player-name-with-special-chars']
    for (const str of testStrings) {
    const result = Schema.decodeUnknownEither(PlayerIdSchema)(str)
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
    expect(typeof result.right).toBe('string')
    }
    }
})
),
  Effect.gen(function* () {
    const invalidValues = [123, true, null, undefined, {}, []]

    for (const value of invalidValues) {
    const result = Schema.decodeUnknownEither(PlayerIdSchema)(value)
    expect(Either.isLeft(result)).toBe(true)
    }
  })

    it.effect('preserves string content when valid', () => Effect.gen(function* () {
    const testId = 'test-player-id'
    const result = Schema.decodeUnknownEither(PlayerIdSchema)(testId)
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
    expect(result.right).toBe(testId)
    }
  })
)
  describe('WorldCoordinateSchema', () => {
  it.effect('validates numeric coordinates', () => Effect.gen(function* () {
    const validCoordinates = [0, 1, -1, 100.5, -100.5, Number.MAX_SAFE_INTEGER]
    for (const coord of validCoordinates) {
    const result = Schema.decodeUnknownEither(WorldCoordinateSchema)(coord)
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
    expect(typeof result.right).toBe('number')
    expect(result.right).toBe(coord)
    }
    }
})
),
  Effect.gen(function* () {
    const invalidValues = ['123', true, null, undefined, {}, []]

    for (const value of invalidValues) {
    const result = Schema.decodeUnknownEither(WorldCoordinateSchema)(value)
    expect(Either.isLeft(result)).toBe(true)
    }
  })

    it.effect('handles edge cases for coordinates', () => Effect.gen(function* () {
    const edgeCases = [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, NaN]
    for (const value of edgeCases) {
    const result = Schema.decodeUnknownEither(WorldCoordinateSchema)(value)
    // スキーマの実装に依存するが、通常はNaNやInfinityは無効
    if (isNaN(value) || !isFinite(value)) {
    expect(Either.isLeft(result)).toBe(true)
    }
    }
  })
)
  describe('ChunkIdSchema', () => {
  it.effect('validates chunk ID strings', () => Effect.gen(function* () {
    const validIds = ['chunk-0-0', 'chunk-10-20', 'chunk--5--10', 'custom-chunk-id']
    for (const id of validIds) {
    const result = Schema.decodeUnknownEither(ChunkIdSchema)(id)
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
    expect(typeof result.right).toBe('string')
    expect(result.right).toBe(id)
    }
    }
})
),
  Effect.gen(function* () {
    const invalidValues = [123, true, null, undefined, {}, []]

    for (const value of invalidValues) {
    const result = Schema.decodeUnknownEither(ChunkIdSchema)(value)
    expect(Either.isLeft(result)).toBe(true)
    }
  })

  })

  describe('BlockTypeIdSchema', () => {
  it.effect('validates block type ID strings', () => Effect.gen(function* () {
    const validIds = ['minecraft:stone', 'dirt', 'grass_block', 'custom:special_block']
    for (const id of validIds) {
    const result = Schema.decodeUnknownEither(BlockTypeIdSchema)(id)
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
    expect(typeof result.right).toBe('string')
    expect(result.right).toBe(id)
    }
    }
})
),
  Effect.gen(function* () {
    const invalidValues = [123, true, null, undefined, {}, []]

    for (const value of invalidValues) {
    const result = Schema.decodeUnknownEither(BlockTypeIdSchema)(value)
    expect(Either.isLeft(result)).toBe(true)
    }
  })

  })

  describe('Position Types', () => {
  it.effect('ChunkPosition creates valid branded type', () => Effect.gen(function* () {
    const position = ChunkPosition({ x: 10, z: 20
})
).toHaveProperty('x')
    expect(position).toHaveProperty('z')
    expect(position.x).toBe(10)
    expect(position.z).toBe(20)
  })

    it.effect('BlockPosition creates valid branded type', () => Effect.gen(function* () {
    const position = BlockPosition({ x: 100, y: 64, z: 200
  })
).toHaveProperty('x')
    expect(position).toHaveProperty('y')
    expect(position).toHaveProperty('z')
    expect(position.x).toBe(100)
    expect(position.y).toBe(64)
    expect(position.z).toBe(200)
  })

  })

  describe('ID Types', () => {
  it.effect('EntityId creates valid branded type', () => Effect.gen(function* () {
    const id = EntityId('entity-123')
    expect(typeof id).toBe('string')
    expect(id).toBe('entity-123')
})
),
  Effect.gen(function* () {
    const id = ItemId('item-456')
    expect(typeof id).toBe('string')
    expect(id).toBe('item-456')
  })

    it.effect('SessionId creates valid branded type', () => Effect.gen(function* () {
    const id = SessionId('session-789')
    expect(typeof id).toBe('string')
    expect(id).toBe('session-789')
  })
)
  describe('Temporal and Version Types', () => {
  it.effect('Timestamp creates valid branded type', () => Effect.gen(function* () {
    const now = Date.now()
    const timestamp = Timestamp(now)
    expect(typeof timestamp).toBe('number')
    expect(timestamp).toBe(now)
})
),
  Effect.gen(function* () {
    const version = Version('1.0.0')

    expect(typeof version).toBe('string')
    expect(version).toBe('1.0.0')
  })

    it.effect('UUID creates valid branded type', () => Effect.gen(function* () {
    const uuid = UUID('550e8400-e29b-41d4-a716-446655440000')
    expect(typeof uuid).toBe('string')
    expect(uuid).toBe('550e8400-e29b-41d4-a716-446655440000')
  })
)
  describe('BrandedTypes Schema Integration', () => {
  it.effect('validates all schema types correctly', () => Effect.gen(function* () {
    // テスト用の有効なデータ
    const validData = {
    playerId: 'player-123',
    worldCoordinate: 100.5,
    chunkId: 'chunk-0-0',
    blockTypeId: 'minecraft:stone'
    }
    // 各スキーマでの検証
    const playerResult = Schema.decodeUnknownEither(PlayerIdSchema)(validData.playerId)
    const coordResult = Schema.decodeUnknownEither(WorldCoordinateSchema)(validData.worldCoordinate)
    const chunkResult = Schema.decodeUnknownEither(ChunkIdSchema)(validData.chunkId)
    const blockResult = Schema.decodeUnknownEither(BlockTypeIdSchema)(validData.blockTypeId)
    expect(Either.isRight(playerResult)).toBe(true)
    expect(Either.isRight(coordResult)).toBe(true)
    expect(Either.isRight(chunkResult)).toBe(true)
    expect(Either.isRight(blockResult)).toBe(true)
})
),
  Effect.gen(function* () {
    // 複雑な検証シナリオ
    const testCases = [
    { schema: PlayerIdSchema, valid: ['player'], invalid: [123, null] },
    { schema: WorldCoordinateSchema, valid: [0, -100.5], invalid: ['100', null] },
    { schema: ChunkIdSchema, valid: ['chunk-1-2'], invalid: [123, undefined] },
    { schema: BlockTypeIdSchema, valid: ['stone'], invalid: [true, {}] }
    ]

    for (const testCase of testCases) {
    // 有効なケース
    for (const validValue of testCase.valid) {
    const result = Schema.decodeUnknownEither(testCase.schema)(validValue)
    expect(Either.isRight(result)).toBe(true)
    }

    // 無効なケース
    for (const invalidValue of testCase.invalid) {
    const result = Schema.decodeUnknownEither(testCase.schema)(invalidValue)
    expect(Either.isLeft(result)).toBe(true)
    }
    }
  })

  })

  describe('Type Safety and Branding', () => {
  it.effect('branded types maintain type safety', () => Effect.gen(function* () {
    const playerId = 'player-123' as PlayerId
    const worldCoord = 100.5 as WorldCoordinate
    const chunkId = 'chunk-0-0' as ChunkId
    const blockTypeId = 'stone' as BlockTypeId
    // 型の検証（実行時チェック）
    expect(typeof playerId).toBe('string')
    expect(typeof worldCoord).toBe('number')
    expect(typeof chunkId).toBe('string')
    expect(typeof blockTypeId).toBe('string')
    // 値の検証
    expect(playerId).toBe('player-123')
    expect(worldCoord).toBe(100.5)
    expect(chunkId).toBe('chunk-0-0')
    expect(blockTypeId).toBe('stone')
})
),
  Effect.gen(function* () {
    // コンストラクタ関数の動作確認
    const entities = [
    EntityId('entity-1'),
    ItemId('item-1'),
    SessionId('session-1'),
    Timestamp(Date.now()),
    Version('2.0.0'
    }),
    UUID('123e4567-e89b-12d3-a456-426614174000')
    ]

    // 全ての要素が適切に作成されていることを確認
    for (const entity of entities) {
    expect(entity).toBeDefined()
    expect(typeof entity === 'string' || typeof entity === 'number').toBe(true)
    }
  })

  })
})