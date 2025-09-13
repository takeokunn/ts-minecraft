---
title: "00 Domain Application Apis"
description: "00 Domain Application Apisに関する詳細な説明とガイド。"
category: "specification"
difficulty: "intermediate"
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: "30分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# Domain & Application Layer API仕様

## 概要

Domain層とApplication層のAPI設計仕様です。Effect-TSのContext/Layerパターンを使用した、型安全で関数型プログラミングに適したAPI設計を定義します。

## Domain Layer APIs

### Brand型による型安全性強化

```typescript
// Brand型定義 - 実行時安全性を保証
export type PlayerId = string & Brand.Brand<"PlayerId">
export const PlayerId = Brand.nominal<PlayerId>()

export type BlockType = string & Brand.Brand<"BlockType">
export const BlockType = Brand.nominal<BlockType>()

export type ChunkId = string & Brand.Brand<"ChunkId">
export const ChunkId = Brand.nominal<ChunkId>()

export type InventoryId = string & Brand.Brand<"InventoryId">
export const InventoryId = Brand.nominal<InventoryId>()

export type WorldId = string & Brand.Brand<"WorldId">
export const WorldId = Brand.nominal<WorldId>()

// Position型のBrand化
export type Position = {
  readonly x: number
  readonly y: number
  readonly z: number
} & Brand.Brand<"Position">

export const Position = (coords: { x: number; y: number; z: number }): Position =>
  Brand.nominal<Position>()(coords as Position)
```

### Entity APIs

#### Player API

```typescript
// Player Service - 関数型アプローチ
export const PlayerService = Context.Tag<{
  readonly create: (params: Schema.Schema.Type<typeof CreatePlayerParams>) => Effect.Effect<Player, PlayerError>
  readonly move: (params: Schema.Schema.Type<typeof MovePlayerParams>) => Effect.Effect<Position, InvalidMovementError | BlockPlacementError>
  readonly damage: (params: Schema.Schema.Type<typeof DamagePlayerParams>) => Effect.Effect<Health, InvalidDamageError>
  readonly heal: (params: Schema.Schema.Type<typeof HealPlayerParams>) => Effect.Effect<Health>
}>()(\"@app/PlayerService\")

// Schema定義 - Brand型とバリデーション強化
export const CreatePlayerParams = Schema.Struct({
  id: Schema.String.pipe(Schema.brand(PlayerId)),
  name: Schema.String.pipe(
    Schema.minLength(1, { message: () => "プレイヤー名は必須です" }),
    Schema.maxLength(16, { message: () => "プレイヤー名は16文字以下にしてください" })
  ),
  position: Schema.Struct({
    x: Schema.Number.pipe(Schema.finite()),
    y: Schema.Number.pipe(Schema.finite(), Schema.between(-256, 320)),
    z: Schema.Number.pipe(Schema.finite())
  }).pipe(Schema.transform(
    Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
    Position,
    ({ x, y, z }) => Position({ x, y, z }),
    (pos) => ({ x: pos.x, y: pos.y, z: pos.z })
  ))
}).pipe(
  Schema.annotations({
    identifier: "CreatePlayerParams",
    description: "プレイヤー作成パラメータ"
  })
)

export const MovePlayerParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand(PlayerId)),
  direction: Schema.Union(
    Schema.Literal("north"),
    Schema.Literal("south"),
    Schema.Literal("east"),
    Schema.Literal("west"),
    Schema.Literal("up"),
    Schema.Literal("down")
  ),
  distance: Schema.Number.pipe(
    Schema.positive({ message: () => "移動距離は正の値である必要があります" }),
    Schema.lessThanOrEqualTo(10, { message: () => "一度に移動できる距離は10ブロック以下です" })
  )
}).pipe(
  Schema.annotations({
    identifier: "MovePlayerParams",
    description: "プレイヤー移動パラメータ"
  })
)

export const DamagePlayerParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand(PlayerId)),
  amount: Schema.Number.pipe(
    Schema.nonnegative({ message: () => "ダメージ量は0以上である必要があります" }),
    Schema.lessThanOrEqualTo(1000, { message: () => "ダメージ量は1000以下である必要があります" })
  ),
  source: Schema.Union(
    Schema.Literal("fall"),
    Schema.Literal("fire"),
    Schema.Literal("drowning"),
    Schema.Literal("mob"),
    Schema.Literal("player"),
    Schema.Literal("environment")
  )
}).pipe(
  Schema.annotations({
    identifier: "DamagePlayerParams",
    description: "プレイヤーダメージパラメータ"
  })
)

export const HealPlayerParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand(PlayerId)),
  amount: Schema.Number.pipe(
    Schema.positive({ message: () => "回復量は正の値である必要があります" }),
    Schema.lessThanOrEqualTo(100, { message: () => "一度に回復できる量は100以下です" })
  )
}).pipe(
  Schema.annotations({
    identifier: "HealPlayerParams",
    description: "プレイヤー回復パラメータ"
  })
)

// Service実装 - 関数型・パターンマッチング・早期リターンによる洗練
export const PlayerServiceLive = Layer.succeed(PlayerService, {
  create: (params) => Effect.gen(function* () {
    const validatedParams = yield* Schema.decodeUnknownSync(CreatePlayerParams)(params)

    // プレイヤー重複チェック - 早期リターンパターン
    const existingPlayer = yield* PlayerRepository.pipe(
      Effect.flatMap(repo => repo.findById(validatedParams.id)),
      Effect.option
    )

    // Match.valueによるパターンマッチング
    return yield* Match.value(existingPlayer).pipe(
      Match.when(Option.isSome, () =>
        Effect.fail(new PlayerError({
          message: "Player already exists",
          playerId: validatedParams.id
        }))
      ),
      Match.when(Option.isNone, () => Effect.gen(function* () {
        // プレイヤー作成処理
        const player = {
          id: validatedParams.id,
          name: validatedParams.name,
          position: validatedParams.position,
          health: { value: 100, max: 100 },
          status: "active" as const
        }

        yield* PlayerRepository.pipe(
          Effect.flatMap(repo => repo.save(player))
        )

        // 作成イベント発行
        yield* EventBusService.pipe(
          Effect.flatMap(bus => bus.publish({
            _tag: "PlayerCreated",
            playerId: validatedParams.id,
            position: validatedParams.position
          }))
        )

        return player
      })),
      Match.exhaustive
    )
  }),

  move: (params) => Effect.gen(function* () {
    const validatedParams = yield* Schema.decodeUnknownSync(MovePlayerParams)(params)

    // プレイヤー存在チェック
    const player = yield* PlayerRepository.pipe(
      Effect.flatMap(repo => repo.findById(validatedParams.playerId))
    )

    // 新しい座標計算
    const newPosition = calculateNewPosition(
      player.position,
      validatedParams.direction,
      validatedParams.distance
    )

    // バリデーションチェック - 早期リターンパターン
    const validationResult = yield* validateMovement(player.position, newPosition).pipe(
      Effect.either
    )

    return yield* Match.value(validationResult).pipe(
      Match.when(Either.isLeft, ({ left: error }) => Effect.fail(error)),
      Match.when(Either.isRight, () => Effect.gen(function* () {
        // 衝突チェック
        const isBlocked = yield* WorldService.pipe(
          Effect.flatMap(service => service.checkCollision(newPosition))
        )

        return yield* Match.value(isBlocked).pipe(
          Match.when(true, () => Effect.fail(new InvalidMovementError({
            message: "Movement blocked by terrain",
            playerId: validatedParams.playerId
          }))),
          Match.when(false, () => Effect.gen(function* () {
            // プレイヤー位置更新
            const updatedPlayer = { ...player, position: newPosition }
            yield* PlayerRepository.pipe(
              Effect.flatMap(repo => repo.update(updatedPlayer))
            )

            // 移動イベント発行
            yield* EventBusService.pipe(
              Effect.flatMap(bus => bus.publish({
                _tag: "PlayerMoved",
                playerId: validatedParams.playerId,
                from: player.position,
                to: newPosition
              }))
            )

            return newPosition
          })),
          Match.exhaustive
        )
      })),
      Match.exhaustive
    )
  }),

  damage: (params) => Effect.gen(function* () {
    const validatedParams = yield* Schema.decodeUnknownSync(DamagePlayerParams)(params)

    const player = yield* PlayerRepository.pipe(
      Effect.flatMap(repo => repo.findById(validatedParams.playerId))
    )

    // ダメージ計算
    const newHealthValue = Math.max(0, player.health.value - validatedParams.amount)
    const newHealth = { value: newHealthValue, max: player.health.max }

    const updatedPlayer = { ...player, health: newHealth }
    yield* PlayerRepository.pipe(
      Effect.flatMap(repo => repo.update(updatedPlayer))
    )

    // 健康状態によるパターンマッチング
    yield* Match.value(newHealthValue).pipe(
      Match.when(0, () =>
        // 死亡処理
        EventBusService.pipe(
          Effect.flatMap(bus => bus.publish({
            _tag: "PlayerDied",
            playerId: validatedParams.playerId,
            cause: validatedParams.source,
            position: player.position
          }))
        )
      ),
      Match.when(Match.number.lessThan(20), () =>
        // 瀕死警告
        EventBusService.pipe(
          Effect.flatMap(bus => bus.publish({
            _tag: "PlayerLowHealth",
            playerId: validatedParams.playerId,
            health: newHealthValue
          }))
        )
      ),
      Match.orElse(() => Effect.unit)
    )

    return newHealth
  }),

  heal: (params) => Effect.gen(function* () {
    const validatedParams = yield* Schema.decodeUnknownSync(HealPlayerParams)(params)

    const player = yield* PlayerRepository.pipe(
      Effect.flatMap(repo => repo.findById(validatedParams.playerId))
    )

    const newHealthValue = Math.min(player.health.max, player.health.value + validatedParams.amount)
    const newHealth = { value: newHealthValue, max: player.health.max }

    const updatedPlayer = { ...player, health: newHealth }
    yield* PlayerRepository.pipe(
      Effect.flatMap(repo => repo.update(updatedPlayer))
    )

    // 回復イベント発行
    yield* EventBusService.pipe(
      Effect.flatMap(bus => bus.publish({
        _tag: "PlayerHealed",
        playerId: validatedParams.playerId,
        amount: validatedParams.amount,
        newHealth: newHealthValue
      }))
    )

    return newHealth
  })
})
```

#### Block API

```typescript
// Block Service - 関数型アプローチ
export const BlockService = Context.Tag<{
  readonly place: (params: Schema.Schema.Type<typeof PlaceBlockParams>) => Effect.Effect<Block, BlockPlacementError>
  readonly break: (params: Schema.Schema.Type<typeof BreakBlockParams>) => Effect.Effect<ReadonlyArray<ItemDrop>, BlockBreakError>
  readonly getMetadata: (position: Position) => Effect.Effect<BlockMetadata, BlockNotFoundError>
  readonly update: (params: Schema.Schema.Type<typeof UpdateBlockParams>) => Effect.Effect<Block, BlockUpdateError>
}>()(\"@app/BlockService\")

// Schema定義 - Brand型強化
export const PlaceBlockParams = Schema.Struct({
  blockType: Schema.String.pipe(Schema.brand(BlockType)),
  position: Schema.Struct({
    x: Schema.Number.pipe(Schema.int(), Schema.between(-30000000, 30000000)),
    y: Schema.Number.pipe(Schema.int(), Schema.between(-256, 320)),
    z: Schema.Number.pipe(Schema.int(), Schema.between(-30000000, 30000000))
  }).pipe(Schema.transform(
    Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
    Position,
    ({ x, y, z }) => Position({ x, y, z }),
    (pos) => ({ x: pos.x, y: pos.y, z: pos.z })
  ))
}).pipe(
  Schema.annotations({
    identifier: "PlaceBlockParams",
    description: "ブロック配置パラメータ"
  })
)

export const BreakBlockParams = Schema.Struct({
  position: Schema.Struct({
    x: Schema.Number.pipe(Schema.int()),
    y: Schema.Number.pipe(Schema.int()),
    z: Schema.Number.pipe(Schema.int())
  }).pipe(Schema.transform(
    Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
    Position,
    ({ x, y, z }) => Position({ x, y, z }),
    (pos) => ({ x: pos.x, y: pos.y, z: pos.z })
  )),
  tool: Schema.Optional(Schema.Union(
    Schema.Literal("hand"),
    Schema.Literal("pickaxe"),
    Schema.Literal("shovel"),
    Schema.Literal("axe"),
    Schema.Literal("hoe")
  ))
}).pipe(
  Schema.annotations({
    identifier: "BreakBlockParams",
    description: "ブロック破壊パラメータ"
  })
)

export const UpdateBlockParams = Schema.Struct({
  position: Schema.Struct({
    x: Schema.Number.pipe(Schema.int()),
    y: Schema.Number.pipe(Schema.int()),
    z: Schema.Number.pipe(Schema.int())
  }).pipe(Schema.transform(
    Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
    Position,
    ({ x, y, z }) => Position({ x, y, z }),
    (pos) => ({ x: pos.x, y: pos.y, z: pos.z })
  )),
  metadata: Schema.Record({
    key: Schema.String,
    value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean)
  })
}).pipe(
  Schema.annotations({
    identifier: "UpdateBlockParams",
    description: "ブロック更新パラメータ"
  })
)

// Service実装 - パターンマッチングと副作用管理の最適化
export const BlockServiceLive = Layer.succeed(BlockService, {
  place: (params) => Effect.gen(function* () {
    const validatedParams = yield* Schema.decodeUnknownSync(PlaceBlockParams)(params)

    // 既存ブロックチェック
    const existingBlock = yield* BlockRepository.pipe(
      Effect.flatMap(repo => repo.getAt(validatedParams.position)),
      Effect.option
    )

    // Match.valueによるパターンマッチング - 早期リターン適用
    return yield* Match.value(existingBlock).pipe(
      Match.when(
        Option.isSome,
        ({ value: block }) => Match.value(block.replaceable).pipe(
          Match.when(false, () => Effect.fail(new BlockPlacementError({
            message: "Block position already occupied by non-replaceable block",
            position: validatedParams.position
          }))),
          Match.when(true, () => Effect.gen(function* () {
            // 置換可能ブロックの処理
            const newBlock = {
              type: validatedParams.blockType,
              position: validatedParams.position,
              metadata: getDefaultMetadata(validatedParams.blockType),
              replaceable: false
            }

            yield* BlockRepository.pipe(
              Effect.flatMap(repo => repo.replace(validatedParams.position, newBlock))
            )

            // チャンク更新とイベント発行を並列実行
            yield* Effect.all([
              ChunkService.pipe(
                Effect.flatMap(service => service.markDirty(
                  PositionAPI.toChunkPosition(validatedParams.position)
                ))
              ),
              EventBusService.pipe(
                Effect.flatMap(bus => bus.publish({
                  _tag: "BlockReplaced",
                  position: validatedParams.position,
                  oldType: block.type,
                  newType: validatedParams.blockType
                }))
              )
            ], { concurrency: 2 })

            return newBlock
          })),
          Match.exhaustive
        )
      ),
      Match.when(Option.isNone, () => Effect.gen(function* () {
        // 新規ブロック配置
        const newBlock = {
          type: validatedParams.blockType,
          position: validatedParams.position,
          metadata: getDefaultMetadata(validatedParams.blockType),
          replaceable: false
        }

        yield* BlockRepository.pipe(
          Effect.flatMap(repo => repo.place(newBlock))
        )

        // チャンク更新とイベント発行を並列実行
        yield* Effect.all([
          ChunkService.pipe(
            Effect.flatMap(service => service.markDirty(
              PositionAPI.toChunkPosition(validatedParams.position)
            ))
          ),
          EventBusService.pipe(
            Effect.flatMap(bus => bus.publish({
              _tag: "BlockPlaced",
              position: validatedParams.position,
              blockType: validatedParams.blockType
            }))
          )
        ], { concurrency: 2 })

        return newBlock
      })),
      Match.exhaustive
    )
  }),

  break: (params) => Effect.gen(function* () {
    const validatedParams = yield* Schema.decodeUnknownSync(BreakBlockParams)(params)

    const block = yield* BlockRepository.pipe(
      Effect.flatMap(repo => repo.getAt(validatedParams.position))
    )

    // ブロック破壊可能性をパターンマッチングでチェック
    const breakabilityCheck = getBreakability(block.type, validatedParams.tool)

    return yield* Match.value(breakabilityCheck).pipe(
      Match.when({ canBreak: false }, ({ reason }) =>
        Effect.fail(new BlockBreakError({
          message: `Block cannot be broken: ${reason}`,
          position: validatedParams.position
        }))
      ),
      Match.when({ canBreak: true }, ({ drops, durabilityDamage }) =>
        Effect.gen(function* () {
          // ブロック削除と関連処理を並列実行
          yield* Effect.all([
            BlockRepository.pipe(
              Effect.flatMap(repo => repo.remove(validatedParams.position))
            ),
            ChunkService.pipe(
              Effect.flatMap(service => service.markDirty(
                PositionAPI.toChunkPosition(validatedParams.position)
              ))
            ),
            EventBusService.pipe(
              Effect.flatMap(bus => bus.publish({
                _tag: "BlockBroken",
                position: validatedParams.position,
                blockType: block.type,
                tool: validatedParams.tool,
                drops
              }))
            )
          ], { concurrency: 3 })

          return drops
        })
      ),
      Match.exhaustive
    )
  }),

  getMetadata: (position) => Effect.gen(function* () {
    // Position型の直接受け入れ（既にBrand化済み）
    const block = yield* BlockRepository.pipe(
      Effect.flatMap(repo => repo.getAt(position))
    )

    return block.metadata
  }),

  update: (params) => Effect.gen(function* () {
    const validatedParams = yield* Schema.decodeUnknownSync(UpdateBlockParams)(params)

    const block = yield* BlockRepository.pipe(
      Effect.flatMap(repo => repo.getAt(validatedParams.position))
    )

    // メタデータ更新の副作用を明確に管理
    const updatedBlock = {
      ...block,
      metadata: { ...block.metadata, ...validatedParams.metadata }
    }

    // 更新とイベント発行を並列実行
    yield* Effect.all([
      BlockRepository.pipe(
        Effect.flatMap(repo => repo.update(updatedBlock))
      ),
      EventBusService.pipe(
        Effect.flatMap(bus => bus.publish({
          _tag: "BlockMetadataUpdated",
          position: validatedParams.position,
          oldMetadata: block.metadata,
          newMetadata: updatedBlock.metadata
        }))
      )
    ], { concurrency: 2 })

    return updatedBlock
  })
})
```

#### Chunk API

```typescript
export interface ChunkService {
  readonly _: unique symbol
}

export const ChunkService = Context.Tag<ChunkService>()("@app/ChunkService")

// Schema定義
export const GenerateChunkParams = Schema.Struct({
  x: Schema.Number,
  z: Schema.Number,
  seed: Schema.Number
})

export const GetBlockAtParams = Schema.Struct({
  chunk: ChunkPositionSchema,
  localPosition: LocalPositionSchema
})

// Service実装
export const ChunkServiceLive = Layer.succeed(ChunkService, {
  generate: (params) => Effect.gen(function* () {
    const validatedParams = yield* Schema.decodeUnknownSync(GenerateChunkParams)(params)

    // ノイズジェネレーターでハイトマップ生成
    const heightMap = yield* TerrainGenerator.pipe(
      Effect.flatMap(gen =>
        gen.generateHeightMap({
          x: validatedParams.x,
          z: validatedParams.z,
          seed: validatedParams.seed
        })
      )
    )

    // バイオーム決定
    const biome = yield* BiomeGenerator.pipe(
      Effect.flatMap(gen =>
        gen.determineBiome({
          x: validatedParams.x,
          z: validatedParams.z,
          temperature: calculateTemperature(validatedParams.x, validatedParams.z),
          humidity: calculateHumidity(validatedParams.x, validatedParams.z)
        })
      )
    )

    // ブロック配置生成
    const blocks = new Map<string, Block>()
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const height = heightMap[x * CHUNK_SIZE + z]
        for (let y = 0; y <= height; y++) {
          const blockType = determineBlockType(y, height, biome)
          const worldPos = {
            x: validatedParams.x * CHUNK_SIZE + x,
            y,
            z: validatedParams.z * CHUNK_SIZE + z
          }
          blocks.set(positionToKey(worldPos), Block({
            type: blockType,
            position: worldPos,
            metadata: getDefaultMetadata(blockType)
          }))
        }
      }
    }

    // 構造物生成
    const structures = yield* StructureGenerator.pipe(
      Effect.flatMap(gen =>
        gen.generateStructures({
          chunkX: validatedParams.x,
          chunkZ: validatedParams.z,
          biome,
          seed: validatedParams.seed
        })
      )
    )

    // 構造物ブロックをマージ
    for (const structure of structures) {
      for (const [pos, block] of structure.blocks) {
        blocks.set(pos, block)
      }
    }

    const chunk = Chunk({
      position: { x: validatedParams.x, z: validatedParams.z },
      blocks: Array.from(blocks.values()),
      biome,
      structures,
      generated: true
    })

    return chunk
  }),

  load: (position) => Effect.gen(function* () {
    const validatedPosition = yield* Schema.decodeUnknownSync(ChunkPositionSchema)(position)

    // ストレージからロード試行
    const stored = yield* ChunkStorageAdapter.pipe(
      Effect.flatMap(adapter =>
        adapter.loadChunk({
          worldId: getCurrentWorldId(),
          position: validatedPosition
        })
      )
    )

    return Match.value(stored).pipe(
      Match.when(Option.isSome, ({ value }) => Effect.succeed(value)),
      Match.orElse(() =>
        // 存在しない場合は生成
        ChunkService.pipe(
          Effect.flatMap(service =>
            service.generate({
              x: validatedPosition.x,
              z: validatedPosition.z,
              seed: getCurrentWorldSeed()
            })
          )
        )
      )
    )
  }),

  save: (chunk) => Effect.gen(function* () {
    const validatedChunk = yield* Schema.decodeUnknownSync(ChunkSchema)(chunk)

    yield* ChunkStorageAdapter.pipe(
      Effect.flatMap(adapter =>
        adapter.saveChunk({
          worldId: getCurrentWorldId(),
          chunk: validatedChunk
        })
      )
    )

    // キャッシュ更新
    yield* ChunkCache.pipe(
      Effect.flatMap(cache =>
        cache.set(validatedChunk.position, validatedChunk)
      )
    )
  }),

  getBlockAt: (params) => Effect.gen(function* () {
    const validatedParams = yield* Schema.decodeUnknownSync(GetBlockAtParams)(params)

    const chunk = yield* ChunkService.pipe(
      Effect.flatMap(service => service.load(validatedParams.chunk))
    )

    const worldPos = {
      x: validatedParams.chunk.x * CHUNK_SIZE + validatedParams.localPosition.x,
      y: validatedParams.localPosition.y,
      z: validatedParams.chunk.z * CHUNK_SIZE + validatedParams.localPosition.z
    }

    const block = chunk.blocks.find(b =>
      b.position.x === worldPos.x &&
      b.position.y === worldPos.y &&
      b.position.z === worldPos.z
    )

    return Option.fromNullable(block)
  }),

  markDirty: (position) => Effect.gen(function* () {
    yield* DirtyChunksRef.pipe(
      Effect.flatMap(ref =>
        Ref.update(ref, chunks => new Set([...chunks, positionToKey(position)]))
      )
    )
  })
})
```

### Value Object APIs

#### Position API

```typescript
// Pure functions for Position calculations
export const PositionAPI = {
  add: (a: Position, b: Position): Position => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
  }),

  distance: (a: Position, b: Position): number =>
    Math.sqrt(
      Math.pow(b.x - a.x, 2) +
      Math.pow(b.y - a.y, 2) +
      Math.pow(b.z - a.z, 2)
    ),

  toChunkPosition: (pos: Position): ChunkPosition => ({
    x: Math.floor(pos.x / CHUNK_SIZE),
    z: Math.floor(pos.z / CHUNK_SIZE)
  }),

  toLocalPosition: (pos: Position): LocalPosition => ({
    x: ((pos.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    y: pos.y,
    z: ((pos.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  })
}
```

## Application Layer APIs

### Use Case APIs

#### World Management API

```typescript
export interface WorldManagementService {
  readonly _: unique symbol
}

export const WorldManagementService = Context.Tag<WorldManagementService>()("@app/WorldManagementService")

// Schema定義
export const CreateWorldParams = Schema.Struct({
  name: Schema.String,
  seed: Schema.Number,
  gameMode: GameModeSchema,
  difficulty: DifficultySchema
})

export const GenerateTerrainParams = Schema.Struct({
  center: ChunkPositionSchema,
  radius: Schema.Number.pipe(Schema.int(), Schema.positive())
})

// Service実装
export const WorldManagementServiceLive = Layer.succeed(WorldManagementService, {
  createWorld: (params) => Effect.gen(function* () {
    const validatedParams = yield* Schema.decodeUnknownSync(CreateWorldParams)(params)

    // ワールド名重複チェック
    const existing = yield* WorldRepository.pipe(
      Effect.flatMap(repo => repo.findByName(validatedParams.name)),
      Effect.option
    )

    if (Option.isSome(existing)) {
      return yield* Effect.fail(WorldCreationError({
        message: "World name already exists",
        worldName: validatedParams.name
      }))
    }

    const worldId = generateId()
    const world = World({
      id: worldId,
      name: validatedParams.name,
      seed: validatedParams.seed,
      gameMode: validatedParams.gameMode,
      difficulty: validatedParams.difficulty,
      spawnPoint: { x: 0, y: 64, z: 0 },
      time: 0,
      weather: "clear",
      loadedChunks: new Map(),
      players: new Map()
    })

    // 初期チャンク生成（スポーン周辺）
    const spawnChunks = yield* WorldManagementService.pipe(
      Effect.flatMap(service =>
        service.generateTerrain({
          center: PositionAPI.toChunkPosition(world.spawnPoint),
          radius: 2
        })
      )
    )

    world.loadedChunks = new Map(
      spawnChunks.map(chunk => [positionToKey(chunk.position), chunk])
    )

    yield* WorldRepository.pipe(
      Effect.flatMap(repo => repo.save(world))
    )

    // 世界作成イベント発行
    yield* EventBusService.pipe(
      Effect.flatMap(bus =>
        bus.publish({
          _tag: "WorldCreated",
          worldId,
          name: validatedParams.name
        })
      )
    )

    return world
  }),

  loadWorld: (worldId) => Effect.gen(function* () {
    const world = yield* WorldRepository.pipe(
      Effect.flatMap(repo => repo.findById(worldId))
    )

    // チャンクの遅延ロード設定
    yield* CurrentWorldRef.pipe(
      Effect.flatMap(ref => Ref.set(ref, Option.some(world)))
    )

    return world
  }),

  saveWorld: (worldId) => Effect.gen(function* () {
    const world = yield* WorldRepository.pipe(
      Effect.flatMap(repo => repo.findById(worldId))
    )

    // 全チャンクの保存
    yield* Effect.all(
      Array.from(world.loadedChunks.values()).map(chunk =>
        ChunkService.pipe(
          Effect.flatMap(service => service.save(chunk))
        )
      ),
      { concurrency: 4 }
    )

    // ワールドメタデータの保存
    yield* WorldRepository.pipe(
      Effect.flatMap(repo => repo.save(world))
    )

    // プレイヤーデータの保存
    yield* Effect.all(
      Array.from(world.players.values()).map(player =>
        PlayerRepository.pipe(
          Effect.flatMap(repo => repo.save(player))
        )
      ),
      { concurrency: 2 }
    )
  }),

  generateTerrain: (params) => Effect.gen(function* () {
    const validatedParams = yield* Schema.decodeUnknownSync(GenerateTerrainParams)(params)

    // 生成範囲内のチャンク座標計算
    const positions: ChunkPosition[] = []
    for (let x = -validatedParams.radius; x <= validatedParams.radius; x++) {
      for (let z = -validatedParams.radius; z <= validatedParams.radius; z++) {
        positions.push({
          x: validatedParams.center.x + x,
          z: validatedParams.center.z + z
        })
      }
    }

    // 並列生成（バッチサイズ制限）
    const chunks = yield* Effect.all(
      positions.map(pos =>
        ChunkService.pipe(
          Effect.flatMap(service => service.load(pos))
        )
      ),
      { concurrency: 4, batching: true }
    )

    return chunks
  })
})
```

#### Inventory Management API

```typescript
export interface InventoryService {
  readonly _: unique symbol
}

export const InventoryService = Context.Tag<InventoryService>()("@app/InventoryService")

// Schema定義
export const AddItemParams = Schema.Struct({
  inventoryId: Schema.String,
  item: ItemStackSchema
})

export const RemoveItemParams = Schema.Struct({
  inventoryId: Schema.String,
  slot: Schema.Number.pipe(Schema.int(), Schema.nonnegative()),
  amount: Schema.Optional(Schema.Number.pipe(Schema.int(), Schema.positive()))
})

export const MoveItemParams = Schema.Struct({
  from: Schema.Struct({
    inventoryId: Schema.String,
    slot: Schema.Number.pipe(Schema.int(), Schema.nonnegative())
  }),
  to: Schema.Struct({
    inventoryId: Schema.String,
    slot: Schema.Number.pipe(Schema.int(), Schema.nonnegative())
  }),
  amount: Schema.Optional(Schema.Number.pipe(Schema.int(), Schema.positive()))
})

export const CraftItemParams = Schema.Struct({
  inventoryId: Schema.String,
  recipe: RecipeSchema
})

// Service実装
export const InventoryServiceLive = Layer.succeed(InventoryService, {
  addItem: (params) => Effect.gen(function* () {
    const validatedParams = yield* Schema.decodeUnknownSync(AddItemParams)(params)

    const inventory = yield* InventoryRepository.pipe(
      Effect.flatMap(repo => repo.findById(validatedParams.inventoryId))
    )

    // スタッキング可能なアイテムを探す
    const stackableSlot = findStackableSlot(inventory, validatedParams.item)

    return yield* Match.value(stackableSlot).pipe(
      Match.when(Option.isSome, ({ value: slot }) => Effect.gen(function* () {
        // 既存スタックに追加
        const existingStack = inventory.slots[slot.index]
        const maxStack = getMaxStackSize(validatedParams.item.type)
        const canAdd = Math.min(validatedParams.item.amount, maxStack - existingStack.amount)

        if (canAdd === 0) {
          return yield* Effect.fail(InventoryFullError({
            message: "No space in inventory",
            inventoryId: validatedParams.inventoryId
          }))
        }

        const updatedStack = { ...existingStack, amount: existingStack.amount + canAdd }
        const updatedSlots = [...inventory.slots]
        updatedSlots[slot.index] = updatedStack

        const updatedInventory = { ...inventory, slots: updatedSlots }

        yield* InventoryRepository.pipe(
          Effect.flatMap(repo => repo.update(updatedInventory))
        )

        // 残りアイテムがあれば新しいスロットに配置
        if (canAdd < validatedParams.item.amount) {
          const remainingItem = { ...validatedParams.item, amount: validatedParams.item.amount - canAdd }
          return yield* InventoryService.pipe(
            Effect.flatMap(service =>
              service.addItem({ inventoryId: validatedParams.inventoryId, item: remainingItem })
            )
          )
        }

        return updatedInventory
      })),
      Match.orElse(() => Effect.gen(function* () {
        // 空きスロットを探す
        const emptySlot = findEmptySlot(inventory)

        if (Option.isNone(emptySlot)) {
          return yield* Effect.fail(InventoryFullError({
            message: "No space in inventory",
            inventoryId: validatedParams.inventoryId
          }))
        }

        const updatedSlots = [...inventory.slots]
        updatedSlots[emptySlot.value] = validatedParams.item

        const updatedInventory = { ...inventory, slots: updatedSlots }

        yield* InventoryRepository.pipe(
          Effect.flatMap(repo => repo.update(updatedInventory))
        )

        return updatedInventory
      }))
    )
  }),

  removeItem: (params) => Effect.gen(function* () {
    const validatedParams = yield* Schema.decodeUnknownSync(RemoveItemParams)(params)

    const inventory = yield* InventoryRepository.pipe(
      Effect.flatMap(repo => repo.findById(validatedParams.inventoryId))
    )

    if (validatedParams.slot >= inventory.slots.length) {
      return yield* Effect.fail(InventoryError({
        message: "Invalid slot index",
        inventoryId: validatedParams.inventoryId
      }))
    }

    const slot = inventory.slots[validatedParams.slot]
    if (!slot) {
      return Option.none()
    }

    const removeAmount = validatedParams.amount ?? slot.amount

    if (removeAmount >= slot.amount) {
      // スロットを空にする
      const updatedSlots = [...inventory.slots]
      updatedSlots[validatedParams.slot] = null

      const updatedInventory = { ...inventory, slots: updatedSlots }

      yield* InventoryRepository.pipe(
        Effect.flatMap(repo => repo.update(updatedInventory))
      )

      return Option.some(slot)
    } else {
      // 部分削除
      const removedItem = { ...slot, amount: removeAmount }
      const remainingItem = { ...slot, amount: slot.amount - removeAmount }

      const updatedSlots = [...inventory.slots]
      updatedSlots[validatedParams.slot] = remainingItem

      const updatedInventory = { ...inventory, slots: updatedSlots }

      yield* InventoryRepository.pipe(
        Effect.flatMap(repo => repo.update(updatedInventory))
      )

      return Option.some(removedItem)
    }
  }),

  moveItem: (params) => Effect.gen(function* () {
    const validatedParams = yield* Schema.decodeUnknownSync(MoveItemParams)(params)

    // アイテム取得
    const item = yield* InventoryService.pipe(
      Effect.flatMap(service =>
        service.removeItem({
          inventoryId: validatedParams.from.inventoryId,
          slot: validatedParams.from.slot,
          amount: validatedParams.amount
        })
      )
    )

    if (Option.isNone(item)) {
      return yield* Effect.fail(InventoryError({
        message: "No item to move",
        inventoryId: validatedParams.from.inventoryId
      }))
    }

    // 移動先に配置
    yield* InventoryService.pipe(
      Effect.flatMap(service =>
        service.addItem({
          inventoryId: validatedParams.to.inventoryId,
          item: item.value
        })
      ),
      Effect.catchAll(error => {
        // 配置失敗時は元に戻す
        return InventoryService.pipe(
          Effect.flatMap(service =>
            service.addItem({
              inventoryId: validatedParams.from.inventoryId,
              item: item.value
            })
          ),
          Effect.flatMap(() => Effect.fail(error))
        )
      })
    )
  }),

  craft: (params) => Effect.gen(function* () {
    const validatedParams = yield* Schema.decodeUnknownSync(CraftItemParams)(params)

    const inventory = yield* InventoryRepository.pipe(
      Effect.flatMap(repo => repo.findById(validatedParams.inventoryId))
    )

    // 必要材料チェック
    const hasIngredients = checkIngredients(inventory, validatedParams.recipe.ingredients)

    if (!hasIngredients) {
      return yield* Effect.fail(CraftingError({
        message: "Insufficient ingredients",
        recipe: validatedParams.recipe.id
      }))
    }

    // 材料消費
    for (const ingredient of validatedParams.recipe.ingredients) {
      yield* consumeIngredient(inventory, ingredient)
    }

    // アイテム生成
    const craftedItem = ItemStack({
      type: validatedParams.recipe.output.type,
      amount: validatedParams.recipe.output.amount,
      durability: getMaxDurability(validatedParams.recipe.output.type),
      enchantments: []
    })

    // インベントリに追加
    yield* InventoryService.pipe(
      Effect.flatMap(service =>
        service.addItem({
          inventoryId: validatedParams.inventoryId,
          item: craftedItem
        })
      )
    )

    return craftedItem
  })
})
```

### Query APIs

#### Entity Query API

```typescript
export interface EntityQueryService {
  readonly _: unique symbol
}

export const EntityQueryService = Context.Tag<{
  findEntitiesInRadius: (params: {
    center: Position
    radius: number
    filter?: EntityFilter
  }) => Effect.Effect<ReadonlyArray<Entity>, QueryError>

  findNearestEntity: (params: {
    position: Position
    type: EntityType
    maxDistance?: number
  }) => Effect.Effect<Option.Option<Entity>, QueryError>

  getEntitiesInChunk: (
    chunkPosition: ChunkPosition
  ) => Effect.Effect<ReadonlyArray<Entity>, QueryError>
}>()("EntityQueryService")
```

#### Block Query API

```typescript
export interface BlockQueryService {
  readonly _: unique symbol
}

export const BlockQueryService = Context.Tag<{
  findBlocksInArea: (params: {
    min: Position
    max: Position
    filter?: BlockFilter
  }) => Effect.Effect<ReadonlyArray<BlockInfo>, QueryError>

  raycast: (params: {
    origin: Position
    direction: Vector3
    maxDistance: number
    includeFluid?: boolean
  }) => Effect.Effect<Option.Option<RaycastHit>, QueryError>

  getConnectedBlocks: (params: {
    position: Position
    blockType: BlockType
    maxBlocks?: number
  }) => Effect.Effect<ReadonlyArray<Position>, QueryError>
}>()("BlockQueryService")
```

### Command APIs

#### Player Command API

```typescript
export interface PlayerCommandService {
  readonly _: unique symbol
}

export const PlayerCommandService = Context.Tag<{
  execute: (
    command: PlayerCommand
  ) => Effect.Effect<CommandResult, CommandError>
}>()("PlayerCommandService")

// Command Types (Tagged Union)
export type PlayerCommand =
  | { _tag: 'MovePlayer'; playerId: string; position: Position }
  | { _tag: 'RotatePlayer'; playerId: string; rotation: Rotation }
  | { _tag: 'UseItem'; playerId: string; item: ItemStack }
  | { _tag: 'InteractWithBlock'; playerId: string; position: Position }
  | { _tag: 'AttackEntity'; playerId: string; targetId: string }
```

## Error Types - Effect-TS 3.x標準化

### システム別エラー分類

最新のEffect-TS 3.xパターンに従い、詳細化されたエラー定義とUnion型での論理的集約を実装します。

```typescript
// =============================================================================
// Player System Errors
// =============================================================================
export namespace PlayerSystem {
  export class PlayerNotFoundError extends Schema.TaggedError("PlayerSystem.PlayerNotFoundError")<{
    readonly playerId: string
    readonly searchContext: string
    readonly timestamp: number
    readonly requestedBy?: string
  }> {}

  export class InvalidMovementError extends Schema.TaggedError("PlayerSystem.InvalidMovementError")<{
    readonly playerId: string
    readonly currentPosition: Position
    readonly targetPosition: Position
    readonly reason: string
    readonly maxAllowedDistance: number
    readonly actualDistance: number
    readonly timestamp: number
  }> {}

  export class InvalidDamageError extends Schema.TaggedError("PlayerSystem.InvalidDamageError")<{
    readonly playerId: string
    readonly damageAmount: number
    readonly damageSource: string
    readonly currentHealth: number
    readonly maxHealth: number
    readonly reason: string
    readonly timestamp: number
  }> {}

  export class PlayerInventoryFullError extends Schema.TaggedError("PlayerSystem.PlayerInventoryFullError")<{
    readonly playerId: string
    readonly inventoryId: string
    readonly attemptedItem: string
    readonly attemptedAmount: number
    readonly availableSlots: number
    readonly maxSlots: number
    readonly timestamp: number
  }> {}

  export class PlayerPermissionDeniedError extends Schema.TaggedError("PlayerSystem.PlayerPermissionDeniedError")<{
    readonly playerId: string
    readonly action: string
    readonly requiredPermission: string
    readonly currentPermissions: ReadonlyArray<string>
    readonly context: string
    readonly timestamp: number
  }> {}
}

export type PlayerError =
  | PlayerSystem.PlayerNotFoundError
  | PlayerSystem.InvalidMovementError
  | PlayerSystem.InvalidDamageError
  | PlayerSystem.PlayerInventoryFullError
  | PlayerSystem.PlayerPermissionDeniedError

// =============================================================================
// Block System Errors
// =============================================================================
export namespace BlockSystem {
  export class BlockNotFoundError extends Schema.TaggedError("BlockSystem.BlockNotFoundError")<{
    readonly position: Position
    readonly chunkPosition: ChunkPosition
    readonly searchContext: string
    readonly timestamp: number
  }> {}

  export class BlockPlacementError extends Schema.TaggedError("BlockSystem.BlockPlacementError")<{
    readonly position: Position
    readonly blockType: string
    readonly existingBlockType?: string
    readonly reason: string
    readonly canReplace: boolean
    readonly placedBy?: string
    readonly timestamp: number
  }> {}

  export class BlockBreakError extends Schema.TaggedError("BlockSystem.BlockBreakError")<{
    readonly position: Position
    readonly blockType: string
    readonly tool?: string
    readonly reason: string
    readonly hardness: number
    readonly requiredTool?: string
    readonly brokenBy?: string
    readonly timestamp: number
  }> {}

  export class BlockUpdateError extends Schema.TaggedError("BlockSystem.BlockUpdateError")<{
    readonly position: Position
    readonly blockType: string
    readonly updateType: string
    readonly oldMetadata: unknown
    readonly newMetadata: unknown
    readonly reason: string
    readonly timestamp: number
  }> {}

  export class BlockValidationError extends Schema.TaggedError("BlockSystem.BlockValidationError")<{
    readonly position: Position
    readonly blockType: string
    readonly validationRule: string
    readonly actualValue: unknown
    readonly expectedValue: unknown
    readonly timestamp: number
  }> {}
}

export type BlockError =
  | BlockSystem.BlockNotFoundError
  | BlockSystem.BlockPlacementError
  | BlockSystem.BlockBreakError
  | BlockSystem.BlockUpdateError
  | BlockSystem.BlockValidationError

// =============================================================================
// Chunk System Errors
// =============================================================================
export namespace ChunkSystem {
  export class ChunkGenerationError extends Schema.TaggedError("ChunkSystem.ChunkGenerationError")<{
    readonly chunkX: number
    readonly chunkZ: number
    readonly biome: string
    readonly generationStep: string
    readonly underlyingError?: unknown
    readonly seed: number
    readonly performance: {
      readonly startTime: number
      readonly duration: number
      readonly memoryUsed: number
    }
    readonly timestamp: number
  }> {}

  export class ChunkLoadError extends Schema.TaggedError("ChunkSystem.ChunkLoadError")<{
    readonly chunkX: number
    readonly chunkZ: number
    readonly worldId: string
    readonly source: "disk" | "network" | "cache"
    readonly reason: string
    readonly underlyingError?: unknown
    readonly retryCount: number
    readonly timestamp: number
  }> {}

  export class ChunkSaveError extends Schema.TaggedError("ChunkSystem.ChunkSaveError")<{
    readonly chunkX: number
    readonly chunkZ: number
    readonly worldId: string
    readonly destination: "disk" | "network" | "cache"
    readonly reason: string
    readonly dataSize: number
    readonly underlyingError?: unknown
    readonly timestamp: number
  }> {}

  export class ChunkCorruptionError extends Schema.TaggedError("ChunkSystem.ChunkCorruptionError")<{
    readonly chunkX: number
    readonly chunkZ: number
    readonly worldId: string
    readonly corruptionType: string
    readonly detectedAt: string
    readonly recoverable: boolean
    readonly backupAvailable: boolean
    readonly timestamp: number
  }> {}
}

export type ChunkError =
  | ChunkSystem.ChunkGenerationError
  | ChunkSystem.ChunkLoadError
  | ChunkSystem.ChunkSaveError
  | ChunkSystem.ChunkCorruptionError

// =============================================================================
// World System Errors
// =============================================================================
export namespace WorldSystem {
  export class WorldCreationError extends Schema.TaggedError("WorldSystem.WorldCreationError")<{
    readonly worldName: string
    readonly worldId?: string
    readonly reason: string
    readonly existingWorldConflict: boolean
    readonly diskSpaceAvailable: number
    readonly diskSpaceRequired: number
    readonly creator?: string
    readonly timestamp: number
  }> {}

  export class WorldLoadError extends Schema.TaggedError("WorldSystem.WorldLoadError")<{
    readonly worldId: string
    readonly worldName?: string
    readonly reason: string
    readonly fileCorrupted: boolean
    readonly backupAvailable: boolean
    readonly lastModified?: number
    readonly underlyingError?: unknown
    readonly timestamp: number
  }> {}

  export class WorldSaveError extends Schema.TaggedError("WorldSystem.WorldSaveError")<{
    readonly worldId: string
    readonly worldName: string
    readonly reason: string
    readonly partialSave: boolean
    readonly affectedChunks: ReadonlyArray<ChunkPosition>
    readonly affectedPlayers: ReadonlyArray<string>
    readonly diskSpaceRemaining: number
    readonly timestamp: number
  }> {}

  export class WorldCorruptionError extends Schema.TaggedError("WorldSystem.WorldCorruptionError")<{
    readonly worldId: string
    readonly worldName: string
    readonly corruptionType: string
    readonly affectedRegions: ReadonlyArray<string>
    readonly recoverable: boolean
    readonly lastValidBackup?: number
    readonly detectionMethod: string
    readonly timestamp: number
  }> {}

  export class TerrainGenerationError extends Schema.TaggedError("WorldSystem.TerrainGenerationError")<{
    readonly center: ChunkPosition
    readonly radius: number
    readonly generationType: string
    readonly affectedChunks: ReadonlyArray<ChunkPosition>
    readonly biomeDistribution: Record<string, number>
    readonly seed: number
    readonly failureStage: string
    readonly underlyingError?: unknown
    readonly timestamp: number
  }> {}
}

export type WorldError =
  | WorldSystem.WorldCreationError
  | WorldSystem.WorldLoadError
  | WorldSystem.WorldSaveError
  | WorldSystem.WorldCorruptionError
  | WorldSystem.TerrainGenerationError

// =============================================================================
// Inventory System Errors
// =============================================================================
export namespace InventorySystem {
  export class InventoryNotFoundError extends Schema.TaggedError("InventorySystem.InventoryNotFoundError")<{
    readonly inventoryId: string
    readonly ownerId?: string
    readonly inventoryType: string
    readonly searchContext: string
    readonly timestamp: number
  }> {}

  export class InventoryFullError extends Schema.TaggedError("InventorySystem.InventoryFullError")<{
    readonly inventoryId: string
    readonly ownerId?: string
    readonly itemType: string
    readonly attemptedAmount: number
    readonly availableSpace: number
    readonly totalSlots: number
    readonly usedSlots: number
    readonly timestamp: number
  }> {}

  export class InvalidItemError extends Schema.TaggedError("InventorySystem.InvalidItemError")<{
    readonly itemType: string
    readonly itemId?: string
    readonly reason: string
    readonly validationRule: string
    readonly actualValue: unknown
    readonly expectedValue: unknown
    readonly context: string
    readonly timestamp: number
  }> {}

  export class ItemTransferError extends Schema.TaggedError("InventorySystem.ItemTransferError")<{
    readonly sourceInventoryId: string
    readonly targetInventoryId: string
    readonly itemType: string
    readonly amount: number
    readonly reason: string
    readonly sourceSlot: number
    readonly targetSlot?: number
    readonly timestamp: number
  }> {}

  export class ItemDurabilityError extends Schema.TaggedError("InventorySystem.ItemDurabilityError")<{
    readonly itemType: string
    readonly itemId: string
    readonly currentDurability: number
    readonly maxDurability: number
    readonly repairCost: number
    readonly isRepairable: boolean
    readonly reason: string
    readonly timestamp: number
  }> {}
}

export type InventoryError =
  | InventorySystem.InventoryNotFoundError
  | InventorySystem.InventoryFullError
  | InventorySystem.InvalidItemError
  | InventorySystem.ItemTransferError
  | InventorySystem.ItemDurabilityError

// =============================================================================
// Crafting System Errors
// =============================================================================
export namespace CraftingSystem {
  export class RecipeNotFoundError extends Schema.TaggedError("CraftingSystem.RecipeNotFoundError")<{
    readonly recipeId: string
    readonly recipePattern?: ReadonlyArray<ReadonlyArray<string>>
    readonly availableRecipes: ReadonlyArray<string>
    readonly searchContext: string
    readonly timestamp: number
  }> {}

  export class InsufficientIngredientsError extends Schema.TaggedError("CraftingSystem.InsufficientIngredientsError")<{
    readonly recipeId: string
    readonly missingIngredients: ReadonlyArray<{
      readonly item: string
      readonly required: number
      readonly available: number
    }>
    readonly inventoryId: string
    readonly craftingTableType: string
    readonly timestamp: number
  }> {}

  export class CraftingPermissionError extends Schema.TaggedError("CraftingSystem.CraftingPermissionError")<{
    readonly recipeId: string
    readonly playerId: string
    readonly requiredPermission: string
    readonly requiredLevel?: number
    readonly currentLevel?: number
    readonly reason: string
    readonly timestamp: number
  }> {}

  export class CraftingTableError extends Schema.TaggedError("CraftingSystem.CraftingTableError")<{
    readonly tablePosition: Position
    readonly tableType: string
    readonly reason: string
    readonly isAccessible: boolean
    readonly requiredTable?: string
    readonly timestamp: number
  }> {}
}

export type CraftingError =
  | CraftingSystem.RecipeNotFoundError
  | CraftingSystem.InsufficientIngredientsError
  | CraftingSystem.CraftingPermissionError
  | CraftingSystem.CraftingTableError

// =============================================================================
// Command System Errors
// =============================================================================
export namespace CommandSystem {
  export class CommandNotFoundError extends Schema.TaggedError("CommandSystem.CommandNotFoundError")<{
    readonly command: string
    readonly availableCommands: ReadonlyArray<string>
    readonly similarity: ReadonlyArray<{
      readonly command: string
      readonly score: number
    }>
    readonly executor: string
    readonly timestamp: number
  }> {}

  export class InvalidArgumentsError extends Schema.TaggedError("CommandSystem.InvalidArgumentsError")<{
    readonly command: string
    readonly providedArgs: ReadonlyArray<string>
    readonly expectedArgs: ReadonlyArray<{
      readonly name: string
      readonly type: string
      readonly required: boolean
    }>
    readonly invalidArg: string
    readonly reason: string
    readonly timestamp: number
  }> {}

  export class CommandPermissionError extends Schema.TaggedError("CommandSystem.CommandPermissionError")<{
    readonly command: string
    readonly executor: string
    readonly requiredPermission: string
    readonly currentPermissions: ReadonlyArray<string>
    readonly requiredLevel: number
    readonly currentLevel: number
    readonly timestamp: number
  }> {}

  export class CommandExecutionError extends Schema.TaggedError("CommandSystem.CommandExecutionError")<{
    readonly command: string
    readonly args: ReadonlyArray<string>
    readonly executor: string
    readonly executionStage: string
    readonly underlyingError?: unknown
    readonly partialSuccess: boolean
    readonly timestamp: number
  }> {}
}

export type CommandError =
  | CommandSystem.CommandNotFoundError
  | CommandSystem.InvalidArgumentsError
  | CommandSystem.CommandPermissionError
  | CommandSystem.CommandExecutionError

// =============================================================================
// Query System Errors
// =============================================================================
export namespace QuerySystem {
  export class InvalidQueryError extends Schema.TaggedError("QuerySystem.InvalidQueryError")<{
    readonly query: string
    readonly queryType: string
    readonly reason: string
    readonly validationErrors: ReadonlyArray<string>
    readonly suggestedFix?: string
    readonly timestamp: number
  }> {}

  export class QueryTimeoutError extends Schema.TaggedError("QuerySystem.QueryTimeoutError")<{
    readonly query: string
    readonly timeoutMs: number
    readonly elapsedMs: number
    readonly queryComplexity: string
    readonly indexesUsed: ReadonlyArray<string>
    readonly estimatedResultCount: number
    readonly timestamp: number
  }> {}

  export class QueryResultLimitError extends Schema.TaggedError("QuerySystem.QueryResultLimitError")<{
    readonly query: string
    readonly requestedLimit: number
    readonly maxAllowedLimit: number
    readonly actualResultCount: number
    readonly truncated: boolean
    readonly timestamp: number
  }> {}

  export class IndexNotFoundError extends Schema.TaggedError("QuerySystem.IndexNotFoundError")<{
    readonly indexName: string
    readonly requiredForQuery: string
    readonly availableIndexes: ReadonlyArray<string>
    readonly performanceImpact: string
    readonly suggestedIndex?: string
    readonly timestamp: number
  }> {}
}

export type QueryError =
  | QuerySystem.InvalidQueryError
  | QuerySystem.QueryTimeoutError
  | QuerySystem.QueryResultLimitError
  | QuerySystem.IndexNotFoundError

// =============================================================================
// Rendering System Errors
// =============================================================================
export namespace RenderingSystem {
  export class MeshGenerationError extends Schema.TaggedError("RenderingSystem.MeshGenerationError")<{
    readonly chunkPosition: ChunkPosition
    readonly meshType: string
    readonly vertexCount: number
    readonly memoryUsed: number
    readonly generationTime: number
    readonly reason: string
    readonly underlyingError?: unknown
    readonly timestamp: number
  }> {}

  export class ShaderCompilationError extends Schema.TaggedError("RenderingSystem.ShaderCompilationError")<{
    readonly shaderType: "vertex" | "fragment" | "geometry" | "compute"
    readonly shaderName: string
    readonly compilationErrors: ReadonlyArray<string>
    readonly line?: number
    readonly column?: number
    readonly shaderSource?: string
    readonly timestamp: number
  }> {}

  export class TextureLoadError extends Schema.TaggedError("RenderingSystem.TextureLoadError")<{
    readonly texturePath: string
    readonly textureFormat: string
    readonly dimensions: {
      readonly width: number
      readonly height: number
    }
    readonly reason: string
    readonly fileSize?: number
    readonly underlyingError?: unknown
    readonly timestamp: number
  }> {}

  export class RenderContextError extends Schema.TaggedError("RenderingSystem.RenderContextError")<{
    readonly contextType: "WebGL" | "WebGPU" | "Canvas2D"
    readonly reason: string
    readonly capabilities: Record<string, boolean>
    readonly extensions: ReadonlyArray<string>
    readonly deviceInfo: string
    readonly timestamp: number
  }> {}
}

export type RenderingError =
  | RenderingSystem.MeshGenerationError
  | RenderingSystem.ShaderCompilationError
  | RenderingSystem.TextureLoadError
  | RenderingSystem.RenderContextError

// =============================================================================
// 統合エラー型定義
// =============================================================================

// 全システムエラーの統合Union型
export type MinecraftSystemError =
  | PlayerError
  | BlockError
  | ChunkError
  | WorldError
  | InventoryError
  | CraftingError
  | CommandError
  | QueryError
  | RenderingError

// =============================================================================
// Schema-based エラーバリデーション（最新パターン）
// =============================================================================

// Player System Schema
export const PlayerSystemErrorSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("PlayerSystem.PlayerNotFoundError"),
    playerId: Schema.String,
    searchContext: Schema.String,
    timestamp: Schema.Number,
    requestedBy: Schema.Optional(Schema.String)
  }),
  Schema.Struct({
    _tag: Schema.Literal("PlayerSystem.InvalidMovementError"),
    playerId: Schema.String,
    currentPosition: PositionSchema,
    targetPosition: PositionSchema,
    reason: Schema.String,
    maxAllowedDistance: Schema.Number,
    actualDistance: Schema.Number,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("PlayerSystem.InvalidDamageError"),
    playerId: Schema.String,
    damageAmount: Schema.Number,
    damageSource: Schema.String,
    currentHealth: Schema.Number,
    maxHealth: Schema.Number,
    reason: Schema.String,
    timestamp: Schema.Number
  })
).pipe(
  Schema.annotations({
    identifier: "PlayerSystemErrorSchema",
    description: "プレイヤーシステム関連エラーのバリデーション"
  })
)

// Block System Schema
export const BlockSystemErrorSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("BlockSystem.BlockNotFoundError"),
    position: PositionSchema,
    chunkPosition: ChunkPositionSchema,
    searchContext: Schema.String,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("BlockSystem.BlockPlacementError"),
    position: PositionSchema,
    blockType: Schema.String,
    existingBlockType: Schema.Optional(Schema.String),
    reason: Schema.String,
    canReplace: Schema.Boolean,
    placedBy: Schema.Optional(Schema.String),
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("BlockSystem.BlockBreakError"),
    position: PositionSchema,
    blockType: Schema.String,
    tool: Schema.Optional(Schema.String),
    reason: Schema.String,
    hardness: Schema.Number,
    requiredTool: Schema.Optional(Schema.String),
    brokenBy: Schema.Optional(Schema.String),
    timestamp: Schema.Number
  })
).pipe(
  Schema.annotations({
    identifier: "BlockSystemErrorSchema",
    description: "ブロックシステム関連エラーのバリデーション"
  })
)

// Chunk System Schema
export const ChunkSystemErrorSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("ChunkSystem.ChunkGenerationError"),
    chunkX: Schema.Number,
    chunkZ: Schema.Number,
    biome: Schema.String,
    generationStep: Schema.String,
    underlyingError: Schema.Optional(Schema.Unknown),
    seed: Schema.Number,
    performance: Schema.Struct({
      startTime: Schema.Number,
      duration: Schema.Number,
      memoryUsed: Schema.Number
    }),
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("ChunkSystem.ChunkLoadError"),
    chunkX: Schema.Number,
    chunkZ: Schema.Number,
    worldId: Schema.String,
    source: Schema.Union(
      Schema.Literal("disk"),
      Schema.Literal("network"),
      Schema.Literal("cache")
    ),
    reason: Schema.String,
    underlyingError: Schema.Optional(Schema.Unknown),
    retryCount: Schema.Number,
    timestamp: Schema.Number
  })
).pipe(
  Schema.annotations({
    identifier: "ChunkSystemErrorSchema",
    description: "チャンクシステム関連エラーのバリデーション"
  })
)

// Command System Schema
export const CommandSystemErrorSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("CommandSystem.CommandNotFoundError"),
    command: Schema.String,
    availableCommands: Schema.Array(Schema.String),
    similarity: Schema.Array(Schema.Struct({
      command: Schema.String,
      score: Schema.Number
    })),
    executor: Schema.String,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("CommandSystem.InvalidArgumentsError"),
    command: Schema.String,
    providedArgs: Schema.Array(Schema.String),
    expectedArgs: Schema.Array(Schema.Struct({
      name: Schema.String,
      type: Schema.String,
      required: Schema.Boolean
    })),
    invalidArg: Schema.String,
    reason: Schema.String,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("CommandSystem.CommandPermissionError"),
    command: Schema.String,
    executor: Schema.String,
    requiredPermission: Schema.String,
    currentPermissions: Schema.Array(Schema.String),
    requiredLevel: Schema.Number,
    currentLevel: Schema.Number,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("CommandSystem.CommandExecutionError"),
    command: Schema.String,
    args: Schema.Array(Schema.String),
    executor: Schema.String,
    executionStage: Schema.String,
    underlyingError: Schema.Optional(Schema.Unknown),
    partialSuccess: Schema.Boolean,
    timestamp: Schema.Number
  })
).pipe(
  Schema.annotations({
    identifier: "CommandSystemErrorSchema",
    description: "コマンドシステム関連エラーのバリデーション"
  })
)

// Rendering System Schema
export const RenderingSystemErrorSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("RenderingSystem.MeshGenerationError"),
    chunkPosition: ChunkPositionSchema,
    meshType: Schema.String,
    vertexCount: Schema.Number,
    memoryUsed: Schema.Number,
    generationTime: Schema.Number,
    reason: Schema.String,
    underlyingError: Schema.Optional(Schema.Unknown),
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("RenderingSystem.ShaderCompilationError"),
    shaderType: Schema.Union(
      Schema.Literal("vertex"),
      Schema.Literal("fragment"),
      Schema.Literal("geometry"),
      Schema.Literal("compute")
    ),
    shaderName: Schema.String,
    compilationErrors: Schema.Array(Schema.String),
    line: Schema.Optional(Schema.Number),
    column: Schema.Optional(Schema.Number),
    shaderSource: Schema.Optional(Schema.String),
    timestamp: Schema.Number
  })
).pipe(
  Schema.annotations({
    identifier: "RenderingSystemErrorSchema",
    description: "レンダリングシステム関連エラーのバリデーション"
  })
)

// 統合エラーSchema
export const MinecraftSystemErrorSchema = Schema.Union(
  PlayerSystemErrorSchema,
  BlockSystemErrorSchema,
  ChunkSystemErrorSchema,
  CommandSystemErrorSchema,
  RenderingSystemErrorSchema
).pipe(
  Schema.annotations({
    identifier: "MinecraftSystemErrorSchema",
    description: "全Minecraftシステムエラーの統合バリデーション"
  })
)

// =============================================================================
// エラーファクトリー関数
// =============================================================================

// タイムスタンプ付きエラー作成ヘルパー
export const createPlayerNotFoundError = (params: {
  readonly playerId: string
  readonly searchContext: string
  readonly requestedBy?: string
}) => new PlayerSystem.PlayerNotFoundError({
  ...params,
  timestamp: Date.now()
})

export const createBlockPlacementError = (params: {
  readonly position: Position
  readonly blockType: string
  readonly existingBlockType?: string
  readonly reason: string
  readonly canReplace: boolean
  readonly placedBy?: string
}) => new BlockSystem.BlockPlacementError({
  ...params,
  timestamp: Date.now()
})

export const createChunkGenerationError = (params: {
  readonly chunkX: number
  readonly chunkZ: number
  readonly biome: string
  readonly generationStep: string
  readonly underlyingError?: unknown
  readonly seed: number
  readonly performance: {
    readonly startTime: number
    readonly duration: number
    readonly memoryUsed: number
  }
}) => new ChunkSystem.ChunkGenerationError({
  ...params,
  timestamp: Date.now()
})

export const createCommandNotFoundError = (params: {
  readonly command: string
  readonly availableCommands: ReadonlyArray<string>
  readonly similarity: ReadonlyArray<{
    readonly command: string
    readonly score: number
  }>
  readonly executor: string
}) => new CommandSystem.CommandNotFoundError({
  ...params,
  timestamp: Date.now()
})

export const createMeshGenerationError = (params: {
  readonly chunkPosition: ChunkPosition
  readonly meshType: string
  readonly vertexCount: number
  readonly memoryUsed: number
  readonly generationTime: number
  readonly reason: string
  readonly underlyingError?: unknown
}) => new RenderingSystem.MeshGenerationError({
  ...params,
  timestamp: Date.now()
})
```

## API組み合わせパターン

### Effect Composition

```typescript
// Schema定義
export const PlaceBlockWithValidationParams = Schema.Struct({
  playerId: Schema.String,
  blockType: BlockTypeSchema,
  position: PositionSchema
})

// 複数のAPIを組み合わせた処理
export const placeBlockWithValidation = (params: {
  playerId: string
  blockType: BlockType
  position: Position
}) => Effect.gen(function* () {
  // パラメータバリデーション
  const validatedParams = yield* Schema.decodeUnknownSync(PlaceBlockWithValidationParams)(params)

  const playerService = yield* PlayerService
  const blockService = yield* BlockService
  const queryService = yield* BlockQueryService

  // プレイヤーの位置確認
  const player = yield* PlayerRepository.pipe(
    Effect.flatMap(repo => repo.findById(validatedParams.playerId))
  )

  const distance = PositionAPI.distance(player.position, validatedParams.position)

  // 距離チェック（早期リターン）
  if (distance > MAX_PLACE_DISTANCE) {
    return yield* Effect.fail(new InvalidMovementError({
      message: "Block placement too far from player",
      playerId: validatedParams.playerId
    }))
  }

  // 既存ブロックチェック
  const existing = yield* BlockRepository.pipe(
    Effect.flatMap(repo => repo.getAt(validatedParams.position)),
    Effect.option
  )

  if (Option.isSome(existing) && !existing.value.replaceable) {
    return yield* Effect.fail(new BlockPlacementError({
      message: "Position already occupied by non-replaceable block",
      position: validatedParams.position
    }))
  }

  // 配置権限チェック
  const canPlace = yield* checkPlacePermission(player, validatedParams.position)
  if (!canPlace) {
    return yield* Effect.fail(new CommandError({
      message: "No permission to place block",
      command: "place_block",
      reason: "PermissionDenied"
    }))
  }

  // ブロック配置実行
  const block = yield* blockService.place({
    blockType: validatedParams.blockType,
    position: validatedParams.position
  })

  // イベント発行
  yield* EventBusService.pipe(
    Effect.flatMap(bus =>
      bus.publish({
        _tag: "BlockPlaced",
        position: validatedParams.position,
        blockType: validatedParams.blockType,
        placedBy: validatedParams.playerId
      })
    )
  )

  return block
})
```

### Pipeline Pattern

```typescript
// パイプラインでの処理（Match.valueとEffect.genの組み合わせ）
export const processPlayerAction = (action: PlayerAction) =>
  Effect.gen(function* () {
    // 入力バリデーション
    const validatedAction = yield* Schema.decodeUnknownSync(PlayerActionSchema)(action)

    // アクション種別による分岐処理
    return yield* Match.value(validatedAction).pipe(
      Match.when({ _tag: "MovePlayer" }, (moveAction) => Effect.gen(function* () {
        // 移動権限チェック
        const hasPermission = yield* checkMovePermission(moveAction.playerId)
        if (!hasPermission) {
          return { success: false, reason: "No movement permission" }
        }

        // 移動実行
        const newPosition = yield* PlayerService.pipe(
          Effect.flatMap(service => service.move({
            playerId: moveAction.playerId,
            direction: calculateDirection(moveAction.position),
            distance: calculateDistance(moveAction.position)
          }))
        )

        // ログ記録
        yield* Effect.logInfo(`Player ${moveAction.playerId} moved to ${JSON.stringify(newPosition)}`)

        return { success: true, result: newPosition }
      })),
      Match.when({ _tag: "UseItem" }, (useAction) => Effect.gen(function* () {
        // アイテム使用権限チェック
        const hasPermission = yield* checkItemUsePermission(useAction.playerId, useAction.item)
        if (!hasPermission) {
          return { success: false, reason: "No item use permission" }
        }

        // アイテム使用実行
        const result = yield* ItemService.pipe(
          Effect.flatMap(service => service.use({
            playerId: useAction.playerId,
            item: useAction.item,
            target: useAction.target
          }))
        )

        // ログ記録
        yield* Effect.logInfo(`Player ${useAction.playerId} used item ${useAction.item.type}`)

        return { success: true, result }
      })),
      Match.when({ _tag: "InteractWithBlock" }, (interactAction) => Effect.gen(function* () {
        // ブロック操作権限チェック
        const hasPermission = yield* checkBlockInteractPermission(interactAction.playerId, interactAction.position)
        if (!hasPermission) {
          return { success: false, reason: "No block interaction permission" }
        }

        // ブロック操作実行
        const result = yield* BlockService.pipe(
          Effect.flatMap(service => service.interact({
            playerId: interactAction.playerId,
            position: interactAction.position
          }))
        )

        // ログ記録
        yield* Effect.logInfo(`Player ${interactAction.playerId} interacted with block at ${JSON.stringify(interactAction.position)}`)

        return { success: true, result }
      })),
      Match.orElse(() => Effect.succeed({ success: false, reason: "Unknown action type" }))
    )
  }).pipe(
    Effect.catchTags({
      "InvalidMovementError": (error) => Effect.succeed({ success: false, reason: error.message }),
      "BlockPlacementError": (error) => Effect.succeed({ success: false, reason: error.message }),
      "InventoryError": (error) => Effect.succeed({ success: false, reason: error.message }),
      "CommandError": (error) => Effect.succeed({ success: false, reason: error.message })
    })
  )
```

## Service Layer構成

```typescript
// Layer定義
export const DomainLayer = Layer.mergeAll(
  PlayerServiceLive,
  BlockServiceLive,
  ChunkServiceLive,
  EntityServiceLive
)

export const ApplicationLayer = Layer.mergeAll(
  WorldManagementServiceLive,
  InventoryServiceLive,
  EntityQueryServiceLive,
  BlockQueryServiceLive,
  PlayerCommandServiceLive
).pipe(
  Layer.provide(DomainLayer)
)
```

## Related Documents

**Core System Integration**:
- [World Management System](../00-core-features/01-world-management-system.md) - ワールド管理API実装
- [Player System](../00-core-features/02-player-system.md) - プレイヤードメインAPI
- [Block System](../00-core-features/03-block-system.md) - ブロック操作API
- [Entity System](../00-core-features/04-entity-system.md) - エンティティ管理API
- [Inventory System](../00-core-features/01-inventory-system.md) - インベントリ操作API

**API Specifications**:
- [Infrastructure APIs](./01-infrastructure-apis.md) - インフラ層API定義
- [Event Bus Specification](./02-event-bus-specification.md) - イベント駆動API
- [Data Flow Diagram](./03-data-flow-diagram.md) - データフロー設計

**Architecture**:
- [Layered Architecture](../../01-architecture/04-layered-architecture.md) - レイヤー構成
- [Effect-TS Patterns](../../01-architecture/06-effect-ts-patterns.md) - APIパターン実装

## Glossary Terms Used

- **Aggregate (アグリゲート)**: DDDの一貫性境界 ([詳細](../../04-appendix/00-glossary.md#aggregate))
- **Application Service (アプリケーションサービス)**: ユースケース実現層 ([詳細](../../04-appendix/00-glossary.md#application-service))
- **Domain Service (ドメインサービス)**: ドメインロジック層 ([詳細](../../04-appendix/00-glossary.md#domain-service))
- **Effect (エフェクト)**: 副作用管理と型安全性 ([詳細](../../04-appendix/00-glossary.md#effect))
- **Entity (エンティティ)**: 一意性を持つドメインオブジェクト ([詳細](../../04-appendix/00-glossary.md#entity))
- **Value Object (値オブジェクト)**: 等価性による識別 ([詳細](../../04-appendix/00-glossary.md#value-object))