---
title: 'Effect-TS 3.17+ クイックリファレンス'
description: 'TypeScript Minecraft開発で頻繁に使用するEffect-TSパターンの実践的リファレンス。コピー&ペーストで即利用可能。'
category: 'guide'
difficulty: 'intermediate'
tags: ['effect-ts', 'typescript', 'patterns', 'quick-reference', 'cheat-sheet']
prerequisites: ['effect-ts-fundamentals', 'typescript-basics']
estimated_reading_time: '15分'
related_docs:
  [
    '../tutorials/effect-ts-fundamentals/06a-effect-ts-basics.md',
    '../explanations/design-patterns/01-service-patterns.md',
  ]
---

# Effect-TS 3.17+ クイックリファレンス

TypeScript Minecraft開発で頻繁に使用するEffect-TSパターンの実践的リファレンス集。すぐにコピー&ペーストして使える実装例を提供します。

## 🎯 使用場面

**✅ 以下の場面で活用してください：**

- 新しい機能実装時の基本パターン確認
- Effect-TS 3.17+の最新APIの正確な使用法
- コードレビュー時のパターン照合
- プロジェクト規約に準拠した実装の確認

## 📚 最新基本パターン集 (Effect-TS 3.17+)

### 1. Context.GenericTag（サービス定義）

**最新パターン（Effect-TS 3.17+）**

```typescript
// ✅ 推奨：Context.GenericTag
interface WorldServiceInterface {
  readonly getBlock: (position: Position) => Effect.Effect<Block, WorldError>
  readonly setBlock: (position: Position, block: Block) => Effect.Effect<void, WorldError>
}

export const WorldService = Context.GenericTag<WorldServiceInterface>('@minecraft/WorldService')

// 実装
const makeWorldService = Effect.gen(function* () {
  const chunkManager = yield* ChunkManager

  const getBlock = (position: Position) =>
    Effect.gen(function* () {
      const chunk = yield* chunkManager.getChunk(positionToChunkCoord(position))
      const localPos = worldToLocalPosition(position)
      return chunk.getBlock(localPos)
    })

  const setBlock = (position: Position, block: Block) =>
    Effect.gen(function* () {
      const chunk = yield* chunkManager.getChunk(positionToChunkCoord(position))
      const localPos = worldToLocalPosition(position)
      yield* chunk.setBlock(localPos, block)
    })

  return { getBlock, setBlock }
})

export const WorldServiceLive = Layer.effect(WorldService, makeWorldService)
```

**❌ 非推奨：旧パターン**

```typescript
// 古いAPI（使用しない）
export const WorldService = Context.Tag<WorldServiceInterface>('WorldService')
```

### 2. Schema.Struct（データ型定義）

**最新パターン**

```typescript
// ✅ 推奨：Schema.Struct
export const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})

export const Block = Schema.Struct({
  id: pipe(Schema.String, Schema.brand('BlockId')),
  type: Schema.Union(Schema.Literal('stone'), Schema.Literal('dirt'), Schema.Literal('grass')),
  metadata: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    })
  ),
})

// 使用例
const createBlock = (type: 'stone' | 'dirt' | 'grass') =>
  Effect.gen(function* () {
    const blockData = {
      id: `block_${Date.now()}` as Brand.Branded<string, 'BlockId'>,
      type,
      metadata: { createdAt: new Date().toISOString() },
    }

    return Schema.decodeSync(Block)(blockData)
  })
```

**❌ 非推奨：旧パターン**

```typescript
// 古いAPI（使用しない）
import { Data } from '@effect/data'
// class使用は禁止 - 関数型パターンを使用
```

### 3. Effect.gen（非同期処理合成）

**最新パターン**

```typescript
// ✅ 推奨：Effect.gen + yield*
const processPlayerAction = (playerId: PlayerId, action: PlayerAction) =>
  Effect.gen(function* () {
    // サービス取得
    const playerService = yield* PlayerService
    const worldService = yield* WorldService
    const eventBus = yield* EventBus

    // プレイヤー情報取得
    const player = yield* playerService.getPlayer(playerId)

    // アクション処理
    const result = yield* Match.value(action).pipe(
      Match.when({ _tag: 'Move' }, ({ direction, distance }) =>
        Effect.gen(function* () {
          const newPosition = calculateNewPosition(player.position, direction, distance)
          yield* playerService.updatePlayerPosition(playerId, newPosition)
          return { type: 'position_updated', position: newPosition } as const
        })
      ),
      Match.when({ _tag: 'PlaceBlock' }, ({ position, blockType }) =>
        Effect.gen(function* () {
          const block = yield* createBlock(blockType)
          yield* worldService.setBlock(position, block)
          return { type: 'block_placed', block } as const
        })
      ),
      Match.orElse(() => Effect.fail(PlayerError.InvalidAction({ action })))
    )

    // イベント発火
    yield* eventBus.publish({
      type: 'player_action_processed',
      playerId,
      action,
      result,
    })

    return result
  })
```

### 4. Match.value（安全なパターンマッチング）

**最新パターン**

```typescript
// ✅ 推奨：Match.value
const handleGameEvent = (event: GameEvent) =>
  Match.value(event).pipe(
    Match.when({ type: 'player_joined' }, ({ playerId, timestamp }) =>
      Effect.gen(function* () {
        yield* PlayerService.initializePlayer(playerId)
        yield* NotificationService.broadcast(`プレイヤー ${playerId} が参加しました`)
        yield* Effect.logInfo(`Player joined: ${playerId}`)
      })
    ),
    Match.when({ type: 'block_broken' }, ({ position, playerId, blockType }) =>
      Effect.gen(function* () {
        yield* InventoryService.addItem(playerId, { type: blockType, count: 1 })
        yield* ParticleService.spawnBreakParticles(position, blockType)
        yield* SoundService.playSound('block_break', position)
      })
    ),
    Match.when({ type: 'chunk_loaded' }, ({ chunkCoord }) =>
      Effect.gen(function* () {
        yield* ChunkManager.activateChunk(chunkCoord)
        yield* MobSpawningService.scheduleSpawning(chunkCoord)
      })
    ),
    Match.orElse(() => Effect.logWarning('Unknown game event type'))
  )

// エラーハンドリング付きパターン
const processWithFallback = <T>(value: T, processors: ProcessorMap<T>) =>
  Match.value(value).pipe(
    ...Object.entries(processors).map(([pattern, handler]) => Match.when(pattern as any, handler)),
    Match.orElse((unmatched) =>
      Effect.gen(function* () {
        yield* Effect.logError(`Unhandled case: ${JSON.stringify(unmatched)}`)
        return defaultResult
      })
    )
  )
```

### 5. Schema.TaggedError（型安全エラーハンドリング）

**最新パターン**

```typescript
// ✅ 推奨：Schema.TaggedError
export const WorldError = Schema.TaggedError('WorldError')({
  ChunkNotLoaded: Schema.Struct({
    chunkCoord: ChunkCoordinate,
    requestedAt: Schema.DateTimeUtc,
  }),
  BlockNotFound: Schema.Struct({
    position: Position,
    expectedType: Schema.optional(Schema.String),
  }),
  InvalidPosition: Schema.Struct({
    position: Position,
    bounds: Schema.Struct({
      min: Position,
      max: Position,
    }),
  }),
})

export type WorldError = Schema.Schema.Type<typeof WorldError>

// 使用例
const safeGetBlock = (position: Position) =>
  Effect.gen(function* () {
    // バウンズチェック
    const isValid = yield* validatePosition(position)
    if (!isValid) {
      return yield* Effect.fail(
        WorldError.InvalidPosition({
          position,
          bounds: { min: { x: -64, y: 0, z: -64 }, max: { x: 64, y: 256, z: 64 } },
        })
      )
    }

    // チャンクロード確認
    const chunkCoord = positionToChunkCoord(position)
    const chunkManager = yield* ChunkManager
    const isLoaded = yield* chunkManager.isChunkLoaded(chunkCoord)

    if (!isLoaded) {
      return yield* Effect.fail(
        WorldError.ChunkNotLoaded({
          chunkCoord,
          requestedAt: new Date(),
        })
      )
    }

    // ブロック取得
    const chunk = yield* chunkManager.getChunk(chunkCoord)
    const localPos = worldToLocalPosition(position)
    const block = chunk.getBlock(localPos)

    if (Option.isNone(block)) {
      return yield* Effect.fail(WorldError.BlockNotFound({ position }))
    }

    return block.value
  })
```

### 6. Brand型（型安全性の強化）

**最新パターン**

```typescript
// ✅ 推奨：Brand型の活用
export type PlayerId = Brand.Branded<string, 'PlayerId'>
export type ChunkCoordinate = Brand.Branded<string, 'ChunkCoordinate'>
export type ItemStackCount = Brand.Branded<number, 'ItemStackCount'>

// Brand型作成ヘルパー
export const PlayerId = Brand.nominal<PlayerId>()
export const ChunkCoordinate = Brand.nominal<ChunkCoordinate>()
export const ItemStackCount = Brand.refined<ItemStackCount>(
  (n): n is ItemStackCount => Number.isInteger(n) && n >= 0 && n <= 64
)

// Schema定義
export const PlayerIdSchema = pipe(Schema.String, Schema.brand('PlayerId'))
export const ChunkCoordinateSchema = pipe(Schema.String, Schema.brand('ChunkCoordinate'))
export const ItemStackCountSchema = pipe(
  Schema.Number,
  Schema.int(),
  Schema.between(0, 64),
  Schema.brand('ItemStackCount')
)

// 高度なBrand型パターン（最新）
const EmailSchema = Schema.String.pipe(
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  Schema.brand('Email'),
  Schema.annotations({
    identifier: 'Email',
    title: 'Email Address',
    description: 'Valid email address format',
  })
)

const PositiveIntSchema = Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.brand('PositiveInt'))

// 使用例
const createPlayer = (name: string, startPosition: Position) =>
  Effect.gen(function* () {
    const playerId = PlayerId(`player_${crypto.randomUUID()}`)

    const playerData = {
      id: playerId,
      name,
      position: startPosition,
      health: ItemStackCount(20),
      inventory: {
        slots: Array.from({ length: 36 }, () => null),
        selectedSlot: 0,
      },
    }

    return Schema.decodeSync(Player)(playerData)
  })
```

### 7. Layer（依存注入）

**最新パターン**

```typescript
// ✅ 推奨：Layer合成パターン
export const MainLayer = Layer.mergeAll(
  // インフラ層
  ChunkManagerLive,
  WorldServiceLive,
  PlayerServiceLive,

  // ドメイン層
  InventoryServiceLive,
  CraftingServiceLive,
  CombatSystemLive,

  // アプリケーション層
  GameLoopLive,
  EventBusLive,
  NotificationServiceLive
).pipe(
  Layer.provide(
    // 外部依存
    Layer.mergeAll(DatabaseLive, FileSystemLive, RendererLive)
  )
)

// 環境別Layer
export const DevelopmentLayer = MainLayer.pipe(Layer.provide(DebugServiceLive), Layer.provide(MockDataLive))

export const ProductionLayer = MainLayer.pipe(Layer.provide(LoggingServiceLive), Layer.provide(MetricsServiceLive))

// テスト用Layer
export const TestLayer = MainLayer.pipe(Layer.provide(InMemoryDatabaseLive), Layer.provide(MockRendererLive))
```

### 8. Ref（状態管理）

**最新パターン**

```typescript
// ✅ 推奨：Ref + STM による状態管理
const makeGameStateManager = Effect.gen(function* () {
  // ゲーム状態
  const gameStateRef = yield* Ref.make({
    isRunning: false,
    tickCount: 0,
    players: new Map<PlayerId, PlayerState>(),
    world: {
      loadedChunks: new Set<ChunkCoordinate>(),
      time: 0,
      weather: 'clear' as const,
    },
  })

  // 複数状態の同期更新
  const updateGameState = (updates: Partial<GameState>) =>
    Ref.update(gameStateRef, (current) => ({
      ...current,
      ...updates,
      tickCount: current.tickCount + 1,
    }))

  // プレイヤー追加（原子性保証）
  const addPlayer = (player: PlayerState) =>
    Ref.update(gameStateRef, (state) => ({
      ...state,
      players: new Map(state.players).set(player.id, player),
    }))

  // チャンクロード状態管理
  const loadChunk = (chunkCoord: ChunkCoordinate) =>
    Ref.update(gameStateRef, (state) => ({
      ...state,
      world: {
        ...state.world,
        loadedChunks: new Set([...state.world.loadedChunks, chunkCoord]),
      },
    }))

  // 状態読取り
  const getCurrentState = Ref.get(gameStateRef)

  const getPlayerCount = Ref.get(gameStateRef).pipe(Effect.map((state) => state.players.size))

  return {
    updateGameState,
    addPlayer,
    loadChunk,
    getCurrentState,
    getPlayerCount,
  }
})
```

## 🔧 実践的な使用例

### ゲーム機能の実装例

```typescript
// プレイヤーがブロックを設置する処理
const placeBlock = (playerId: PlayerId, position: Position, blockType: BlockType) =>
  Effect.gen(function* () {
    // 依存サービス取得
    const playerService = yield* PlayerService
    const worldService = yield* WorldService
    const inventoryService = yield* InventoryService
    const soundService = yield* SoundService

    // プレイヤー状態確認
    const player = yield* playerService.getPlayer(playerId)

    // インベントリからアイテム消費
    const hasBlock = yield* inventoryService.hasItem(playerId, blockType, 1)
    if (!hasBlock) {
      return yield* Effect.fail(PlayerError.InsufficientItems({ blockType, required: 1 }))
    }

    // ブロック設置
    const block = yield* createBlock(blockType)
    yield* worldService.setBlock(position, block)

    // アイテム消費
    yield* inventoryService.removeItem(playerId, blockType, 1)

    // サウンド再生
    yield* soundService.playSound('block_place', position)

    // イベント発火
    const eventBus = yield* EventBus
    yield* eventBus.publish({
      type: 'block_placed',
      playerId,
      position,
      blockType,
      timestamp: new Date(),
    })

    yield* Effect.logInfo(`Player ${playerId} placed ${blockType} at ${JSON.stringify(position)}`)

    return { success: true, block }
  })
```

## 🚀 パフォーマンス最適化パターン

### バッチ処理パターン

```typescript
const processBatchUpdates = (updates: readonly BlockUpdate[]) =>
  Effect.gen(function* () {
    // チャンク別にグループ化
    const updatesByChunk = Map.groupBy(updates, (update) => positionToChunkCoord(update.position))

    // 並列処理で各チャンクを更新
    const results = yield* Effect.forEach(
      updatesByChunk,
      ([chunkCoord, chunkUpdates]) =>
        Effect.gen(function* () {
          const chunkManager = yield* ChunkManager
          const chunk = yield* chunkManager.getChunk(chunkCoord)

          // チャンク内での一括更新
          yield* Effect.forEach(
            chunkUpdates,
            (update) =>
              Effect.gen(function* () {
                const localPos = worldToLocalPosition(update.position)
                yield* chunk.setBlock(localPos, update.block)
              }),
            { discard: true }
          )

          return { chunkCoord, updatedBlocks: chunkUpdates.length }
        }),
      { concurrency: 'unbounded' }
    )

    const totalUpdated = results.reduce((sum, result) => sum + result.updatedBlocks, 0)
    yield* Effect.logInfo(`Batch update completed: ${totalUpdated} blocks across ${results.length} chunks`)

    return results
  })
```

### Schema Transform 最適化パターン

```typescript
// 効率的なDate変換
const OptimizedDateSchema = Schema.transformOrFail(Schema.String, Schema.DateFromSelf, {
  decode: (str) => {
    const timestamp = Date.parse(str)
    return isNaN(timestamp)
      ? ParseResult.fail(new ParseResult.Type(Schema.String.ast, str))
      : ParseResult.succeed(new Date(timestamp))
  },
  encode: (date) => ParseResult.succeed(date.toISOString()),
})

// メモ化付き複雑バリデーション
const memoizedComplexValidation = Schema.memoize(
  ComplexPlayerSchema,
  (player) => `${player.id}-${player.version}` // キー関数
)
```

### 遅延評価とパフォーマンス

```typescript
// 大型オブジェクトの遅延評価
const LazyWorldSchema = Schema.suspend(() =>
  Schema.Struct({
    chunks: Schema.Record(
      ChunkCoordinateSchema,
      Schema.suspend(() => ChunkSchema) // 必要時のみ評価
    ),
    players: Schema.Record(
      PlayerIdSchema,
      Schema.suspend(() => PlayerSchema)
    ),
    entities: Schema.Array(Schema.suspend(() => EntitySchema)),
  })
)

// 段階的バリデーション（パフォーマンス最適化）
const validatePlayerData = (data: unknown) =>
  Effect.gen(function* () {
    // 第1段階: 基本構造のみ
    const basicCheck = yield* Schema.decodeUnknown(
      Schema.Struct({
        id: Schema.String,
        name: Schema.String,
      })
    )(data)

    // 第2段階: 必要な場合のみ詳細チェック
    if (basicCheck.name.length > 16) {
      return yield* Effect.fail(new ValidationError('Name too long'))
    }

    // 第3段階: 完全バリデーション
    return yield* Schema.decodeUnknown(FullPlayerSchema)(data)
  })
```

## 🔐 Opaque型とセキュリティ強化パターン

### セキュリティ関連のOpaque型

```typescript
// ✅ 推奨：Secret Token管理
declare const SecretTokenSymbol: unique symbol
export interface SecretToken {
  readonly [SecretTokenSymbol]: true
  readonly value: string
  readonly expiresAt: Date
}

export const SecretTokenSchema = Schema.transform(
  Schema.Struct({
    token: Schema.String.pipe(
      Schema.minLength(32),
      Schema.pattern(/^[A-Za-z0-9+/]+=*$/) // Base64 pattern
    ),
    expiresAt: Schema.DateFromSelf,
  }),
  Schema.Struct({
    [SecretTokenSymbol]: Schema.Literal(true),
    value: Schema.String,
    expiresAt: Schema.DateFromSelf,
  }),
  {
    decode: ({ token, expiresAt }) => ({
      [SecretTokenSymbol]: true as const,
      value: token,
      expiresAt,
    }),
    encode: (secret) => ({
      token: secret.value,
      expiresAt: secret.expiresAt,
    }),
  }
)
export type SecretToken = Schema.Schema.Type<typeof SecretTokenSchema>

// 使用例：認証トークンの安全な管理
const authenticateUser = (token: SecretToken) =>
  Effect.gen(function* () {
    // トークンの有効期限確認
    if (token.expiresAt < new Date()) {
      return yield* Effect.fail(AuthError.TokenExpired({ expiresAt: token.expiresAt }))
    }

    // トークンバリデーション（Opaque型により漏洩防止）
    return yield* validateTokenWithServer(token.value)
  })
```

### 改ざん防止Currency

```typescript
// ✅ 推奨：ゲーム通貨の改ざん防止
declare const CurrencySymbol: unique symbol
export interface GameCurrency {
  readonly [CurrencySymbol]: true
  readonly amount: number
  readonly type: 'emerald' | 'diamond' | 'gold' | 'iron'
  readonly checksum: string
}

export const GameCurrencySchema = Schema.transformOrFail(
  Schema.Struct({
    amount: Schema.Number.pipe(Schema.int(), Schema.nonnegative()),
    type: Schema.Union(
      Schema.Literal('emerald'),
      Schema.Literal('diamond'),
      Schema.Literal('gold'),
      Schema.Literal('iron')
    ),
  }),
  Schema.Struct({
    [CurrencySymbol]: Schema.Literal(true),
    amount: Schema.Number,
    type: Schema.String,
    checksum: Schema.String,
  }),
  {
    decode: ({ amount, type }, options, ast) => {
      const checksum = generateCurrencyChecksum(amount, type)
      return ParseResult.succeed({
        [CurrencySymbol]: true as const,
        amount,
        type,
        checksum,
      })
    },
    encode: (currency) => {
      const expectedChecksum = generateCurrencyChecksum(currency.amount, currency.type)
      if (currency.checksum !== expectedChecksum) {
        return ParseResult.fail(new ParseResult.Type(ast, currency))
      }
      return ParseResult.succeed({
        amount: currency.amount,
        type: currency.type as any,
      })
    },
  }
)

// 使用例：通貨の安全な操作
const transferCurrency = (from: PlayerId, to: PlayerId, currency: GameCurrency) =>
  Effect.gen(function* () {
    const playerService = yield* PlayerService

    // チェックサムでデータ整合性確認
    const isValid = yield* validateCurrency(currency)
    if (!isValid) {
      return yield* Effect.fail(CurrencyError.TamperedData({ currency }))
    }

    yield* playerService.deductCurrency(from, currency)
    yield* playerService.addCurrency(to, currency)
  })
```

## 📊 Transform最適化パターン

### 圧縮付きデータ保存

```typescript
// ✅ 推奨：自動圧縮/展開Schema
export const CompressedSaveDataSchema = Schema.transformOrFail(
  Schema.String.pipe(Schema.minLength(1), Schema.annotations({ description: 'Base64 encoded compressed data' })),
  Schema.Struct({
    world: WorldDataSchema,
    player: PlayerDataSchema,
    gameRules: GameRulesSchema,
    timestamp: Schema.DateFromSelf,
    version: Schema.String,
  }),
  {
    decode: (compressedData, options, ast) =>
      Effect.gen(function* () {
        try {
          const binaryData = Buffer.from(compressedData, 'base64')
          const decompressed = yield* Effect.tryPromise({
            try: () => decompressData(binaryData),
            catch: () => new ParseResult.Type(ast, compressedData),
          })
          const parsed = JSON.parse(decompressed.toString('utf8'))
          return parsed
        } catch (error) {
          return yield* Effect.fail(new ParseResult.Type(ast, compressedData))
        }
      }),
    encode: (saveData) =>
      Effect.gen(function* () {
        const jsonString = JSON.stringify(saveData)
        const compressed = yield* Effect.tryPromise({
          try: () => compressData(Buffer.from(jsonString, 'utf8')),
          catch: () => new ParseResult.Type(ast, saveData),
        })
        return compressed.toString('base64')
      }),
  }
)

// 使用例：世界データの自動圧縮保存
const saveWorldData = (worldData: WorldData) =>
  Effect.gen(function* () {
    const compressedData = yield* Schema.encode(CompressedSaveDataSchema)(worldData)
    yield* FileSystem.writeFile('world.dat', compressedData)
    yield* Effect.logInfo(`World saved (compressed: ${compressedData.length} chars)`)
  })
```

### メモ化付き高コストバリデーション

```typescript
// ✅ 推奨：メモ化Schemaファクトリー
export const createMemoizedSchema = <A, I, R>(
  baseSchema: Schema.Schema<A, I, R>,
  keyExtractor: (input: I) => string,
  cacheSize: number = 1000
) => {
  const cache = new Map<string, Either.Either<ParseResult.ParseError, A>>()

  return Schema.transformOrFail(baseSchema, baseSchema, {
    decode: (input, options, ast) => {
      const key = keyExtractor(input)

      if (cache.has(key)) {
        const cached = cache.get(key)!
        return cached._tag === 'Right' ? ParseResult.succeed(cached.right) : ParseResult.fail(cached.left)
      }

      const result = baseSchema.decode(input, options)

      // LRU cache management
      if (cache.size >= cacheSize) {
        const firstKey = cache.keys().next().value
        cache.delete(firstKey)
      }

      cache.set(key, result)
      return result
    },
    encode: (output) => baseSchema.encode(output),
  })
}

// 使用例：複雑なプレイヤーバリデーションのメモ化
const MemoizedPlayerSchema = createMemoizedSchema(
  ComplexPlayerSchema,
  (player) => `${player.id}-${player.version}`,
  500 // キャッシュサイズ
)
```

### バッチ処理最適化

```typescript
// ✅ 推奨：大量データのバッチ処理
export const createBatchSchema = <A, I, R>(itemSchema: Schema.Schema<A, I, R>, batchSize: number = 100) => {
  return Schema.transformOrFail(Schema.Array(itemSchema), Schema.Array(itemSchema), {
    decode: (items, options, ast) =>
      Effect.gen(function* () {
        const batches = pipe(
          ReadonlyArray.chunksOf(items, batchSize),
          ReadonlyArray.mapWithIndex((index, batch) => ({ index, batch }))
        )

        return yield* Effect.reduce(batches, [] as ReadonlyArray<A>, (acc, { index, batch }) =>
          Effect.gen(function* () {
            const batchResults = yield* Effect.forEach(batch, (item) => itemSchema.decode(item, options), {
              concurrency: 'unbounded',
            })

            if (index % 10 === 0) {
              yield* Effect.logInfo(
                `Processed ${Math.min((index + 1) * batchSize, items.length)}/${items.length} items`
              )
            }

            return [...acc, ...batchResults]
          })
        )
      }),
    encode: (items) => Effect.forEach(items, (item) => itemSchema.encode(item), { concurrency: 'unbounded' }),
  })
}

// 使用例：大量エンティティの効率的処理
const processMassEntities = (entities: unknown[]) =>
  Effect.gen(function* () {
    const BatchEntitySchema = createBatchSchema(EntitySchema, 50)
    const validatedEntities = yield* Schema.decodeUnknown(BatchEntitySchema)(entities)

    yield* Effect.forEach(validatedEntities, (entity) => processEntity(entity), { concurrency: 10 })
  })
```

### パフォーマンス監視付きSchema

```typescript
// ✅ 推奨：パフォーマンス監視
export const createInstrumentedSchema = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  metricsCollector: (operation: string, duration: number) => void
) => {
  return Schema.transformOrFail(schema, schema, {
    decode: (input, options, ast) =>
      Effect.gen(function* () {
        const start = performance.now()
        const result = yield* schema.decode(input, options)
        const duration = performance.now() - start

        metricsCollector('decode', duration)

        // 遅い処理の警告
        if (duration > 100) {
          yield* Effect.logWarning(`Slow decode: ${duration}ms`)
        }

        return result
      }),
    encode: (output) =>
      Effect.gen(function* () {
        const start = performance.now()
        const result = yield* schema.encode(output)
        const duration = performance.now() - start

        metricsCollector('encode', duration)
        return result
      }),
  })
}

// 使用例：メトリクス収集付きスキーマ
const InstrumentedPlayerSchema = createInstrumentedSchema(PlayerSchema, (operation, duration) => {
  console.log(`PlayerSchema.${operation}: ${duration}ms`)
  // メトリクスサーバーに送信
  sendMetrics({ schema: 'Player', operation, duration })
})
```

---

## 💡 補足情報

### デバッグのヒント

- `Effect.tap(() => Effect.logInfo("デバッグメッセージ"))` でデバッグログを挿入
- `Effect.catchAll` でエラーハンドリングの詳細化
- `Effect.timed` で実行時間測定

### よくあるミス

- `yield*` の忘れ（`yield Effect...` ではなく `yield* Effect...`）
- 古いAPIの使用（`Context.Tag` や `Data.Class`）
- Brand型の不適切な使用（実行時チェックなしの使用）
- `transformOrFail` でのエラーハンドリング漏れ
- Schema合成時のパフォーマンス考慮不足

### ベストプラクティス

- **最新APIの使用**: Context7でEffect-TS最新情報を定期的に確認
- **段階的バリデーション**: パフォーマンスが重要な場合は軽いチェックから開始
- **型安全性の活用**: Brand型やTagged Unionでコンパイル時エラー検出
- **メモ化の活用**: 高コストなバリデーションはメモ化で最適化
- **Opaque型の活用**: 機密データやビジネスルールが重要なデータはOpaque型で保護
- **Transform最適化**: 大量データや重い処理は段階的処理・バッチ処理・メモ化で最適化
- **セキュリティ考慮**: 認証トークン・ゲーム通貨等はチェックサム・有効期限付きで実装
- **監視とメトリクス**: パフォーマンス監視機能を内蔵して本番環境での動作を把握

### Opaque型とTransform使用指針

**Opaque型を使うべき場面:**

- 認証トークン・API キー等の機密情報
- ゲーム通貨・スコア等の改ざん防止が必要なデータ
- ファイルパス・URL等の形式検証が重要なデータ
- ID・Handle等の誤った代入を防ぎたいデータ

**Transform最適化を適用すべき場面:**

- 大量データの処理（100件以上の配列処理）
- 重いバリデーション（正規表現・API呼び出し等）
- 圧縮・暗号化が必要なデータ
- パフォーマンス監視が必要な処理

このリファレンスを参考に、型安全で保守可能かつセキュアなMinecraft実装を進めてください！
