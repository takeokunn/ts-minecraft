---
title: 'データモデリングパターン - DDD・Schema・型安全性の実践的実装'
description: 'TypeScript Minecraft プロジェクトにおけるDDD原則に基づくデータモデリングパターンの実装ガイド。Effect-TS 3.17+とSchema.Structを活用した型安全なドメインモデル設計。'
category: 'patterns'
difficulty: 'intermediate'
tags: ['ddd', 'data-modeling', 'schema', 'effect-ts', 'domain-design', 'patterns', 'type-safety']
prerequisites: ['effect-ts-fundamentals', 'ddd-basics', 'schema-design']
estimated_reading_time: '25分'
related_patterns: ['service-patterns', 'error-handling-patterns', 'validation-patterns']
related_docs: ['../reference/data-models/overview.md', '../explanations/architecture/aggregates.md']
search_keywords:
  primary: ['data-modeling-patterns', 'ddd-patterns', 'schema-patterns', 'domain-modeling']
  secondary: ['type-safety', 'validation-patterns', 'aggregate-patterns']
  context: ['functional-programming', 'domain-driven-design', 'typescript-patterns']
---

# データモデリングパターン

## 概要

このドキュメントでは、TypeScript Minecraftプロジェクトで使用されているDDD（ドメイン駆動設計）原則に基づくデータモデリングパターンを説明します。Effect-TS 3.17+とSchema.Structを活用した型安全で実行時検証可能なドメインモデル設計のベストプラクティスを提示します。

### プロジェクトのモデリング原則

1. **Schema駆動設計**: すべてのデータ構造を`Schema.Struct`で定義
2. **型安全性**: Branded TypesとBrand関数による実行時型検証
3. **不変性**: すべてのデータ構造は不変として扱う
4. **純粋関数分離**: 副作用と純粋計算を明確に分離
5. **関数型合成**: 小さく焦点を絞った関数の組み合わせ

---

## パターン1: Entity/Value Objectパターン

### 問題の文脈

DDD設計において、エンティティ（識別子を持つドメインオブジェクト）と値オブジェクト（等価性で判定される不変オブジェクト）を明確に区別し、型安全性を保ちながら実装する必要があります。

### 解決策

Effect-TSの`Schema.Struct`とBranded Typesを使用して、エンティティと値オブジェクトを型レベルで区別し、実行時検証を組み込みます。

### Schema定義パターン

> 📚 **Schema定義の詳細**: 基本的なSchema.Struct、Brand型、Player/Positionエンティティの完全な定義は [Schema API リファレンス](../../reference/api/effect-ts-schema-api.md#11-統合パターンライブラリ) を参照してください。

DDD設計におけるEntity/Value Objectパターンでは、以下の原則を適用します：

**値オブジェクトの設計指針**:

- `Schema.Struct`で不変な構造を定義
- `Schema.annotations`でドメイン知識を埋め込み
- バリデーションロジックをスキーマ内に組み込み

**エンティティの設計指針**:

- Brand型による識別子の型安全性確保
- `readonly`修飾子による不変性保証
- ドメインルールのスキーマレベルでの表現

```typescript
// ✅ DDD特化のSchema設計例（具体的な設計パターンのみ記載）
import { Schema, Brand, Effect } from 'effect'

// 基本的なPositionやPlayerSchemaは上記リファレンスを参照

// ✅ ドメイン特化のバリデーションロジック
const ValidPlayerPosition = Schema.Struct({
  position: Position,
  dimension: Schema.Literal('overworld', 'nether', 'end'),
}).pipe(
  Schema.filter(
    ({ position, dimension }) => {
      // ディメンション別の位置制約
      if (dimension === 'nether' && position.y > 128) return false
      if (dimension === 'end' && (Math.abs(position.x) > 1000 || Math.abs(position.z) > 1000)) return false
      return true
    },
    { message: () => 'Position violates dimension constraints' }
  )
)

// ✅ ドメインルールを含む複合エンティティ
const PlayerWithInventory = Schema.Struct({
  player: Player,
  inventory: InventorySchema,
  permissions: Schema.Array(Schema.String),
}).pipe(
  Schema.filter(({ player, inventory }) => inventory.ownerId === player.id, {
    message: () => 'Inventory ownership mismatch',
  })
)
```

### DDD実装の設計パターン

> 📚 **基本的なEffect.genパターン**: 標準的なEffect合成とエラーハンドリングパターンは [Schema API リファレンス](../../reference/api/effect-ts-schema-api.md#111-基本effectgenパターン) を参照してください。

DDDにおけるEntity/Value Objectパターンの実装では、ドメインロジックの表現に焦点を当てます：

```typescript
// ✅ DDDドメインロジックに特化した実装例
import { Match, pipe, Effect } from 'effect'

// ドメイン知識：プレイヤーの移動制限
const validatePlayerMovement = (
  currentPosition: Position,
  targetPosition: Position,
  gameMode: GameMode
): Effect.Effect<void, MovementViolationError> =>
  Effect.gen(function* () {
    const distance = calculateDistance(currentPosition, targetPosition)
    const maxDistance = gameMode === 'creative' ? 100 : 10

    if (distance > maxDistance) {
      yield* Effect.fail(
        new MovementViolationError({
          reason: 'Distance exceeds game mode limits',
          distance,
          maxDistance,
          gameMode,
        })
      )
    }
  })

// ドメインイベント：プレイヤー状態変化の業務ルール
const applyHealthChange = (
  player: Player,
  healthChange: number
): Effect.Effect<PlayerStateChanged, HealthChangeError> =>
  Effect.gen(function* () {
    const newHealth = Math.max(0, Math.min(20, player.health + healthChange))

    // 死亡による副次的なドメインルール
    const updatedPlayer = pipe(
      Match.value(newHealth),
      Match.when(0, () => ({
        ...player,
        health: 0,
        gameMode: 'spectator' as const,
        position: getRespawnPosition(player.dimension),
      })),
      Match.orElse(() => ({ ...player, health: newHealth }))
    )

    // ドメインイベントの生成
    return new PlayerStateChanged({
      playerId: player.id,
      previousHealth: player.health,
      newHealth,
      gameMode: updatedPlayer.gameMode,
      timestamp: new Date().toISOString(),
    })
  })

// ドメイン集約：複数のエンティティ間の整合性維持
const transferItemBetweenPlayers = (
  fromPlayer: Player,
  toPlayer: Player,
  itemStack: ItemStack
): Effect.Effect<[Player, Player], TransferError> =>
  Effect.gen(function* () {
    // 集約内の業務ルール検証
    yield* validateTransferPermissions(fromPlayer, toPlayer)
    yield* validateItemOwnership(fromPlayer, itemStack)
    yield* validateInventorySpace(toPlayer, itemStack)

    // トランザクション境界内での状態変更
    const updatedFromPlayer = removeItemFromInventory(fromPlayer, itemStack)
    const updatedToPlayer = addItemToInventory(toPlayer, itemStack)

    return [updatedFromPlayer, updatedToPlayer]
  })
```

### 利点

- **型安全性**: コンパイル時および実行時の型検証
- **不変性**: 値オブジェクトとエンティティの一貫した不変更新
- **明確な責任**: エンティティの識別性と値オブジェクトの等価性を明確に区別
- **実行時検証**: Schema検証による堅牢なデータ整合性

### 制約

- ランタイム検証のオーバーヘッドが存在する
- Schemaの学習コストが必要
- 複雑な変換処理でパフォーマンス考慮が必要

---

## パターン2: Aggregateパターン

### 問題の文脈

複雑なビジネスルールを持つドメインオブジェクトの集合を一貫性を保ちながら管理し、ドメインの不変条件を維持する必要があります。

### 解決策

集約ルートとしてのエンティティを定義し、関連する値オブジェクトとエンティティを一つのトランザクション境界として管理します。

### Schema定義例

```typescript
import { Option, ReadonlyArray, Data } from 'effect'

// ✅ ADT（代数的データ型）パターンでアイテム状態を定義
const ItemState = Data.taggedEnum<{
  readonly Empty: {}
  readonly Occupied: { readonly item: ItemStack }
  readonly Reserved: { readonly item: ItemStack; readonly reservedBy: PlayerId }
}>()

// ✅ Branded Typesによる意味的な型定義
type ItemId = string & Brand.Brand<'ItemId'>
type InventoryId = string & Brand.Brand<'InventoryId'>
type SlotIndex = number & Brand.Brand<'SlotIndex'>

// ✅ Schema.Structによる宣言的なデータ定義
const ItemMetadata = Schema.Struct({
  durability: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  enchantments: Schema.optional(Schema.ReadonlyArray(Schema.String)),
  customName: Schema.optional(Schema.String),
  lore: Schema.optional(Schema.ReadonlyArray(Schema.String)),
})

const ItemStack = Schema.Struct({
  itemId: Schema.String.pipe(Schema.brand('ItemId')),
  count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64), Schema.brand('ItemCount')),
  metadata: Schema.optional(ItemMetadata),
}).pipe(
  Schema.annotations({
    identifier: 'ItemStack',
    title: 'アイテムスタック',
    description: 'アイテムの数量とメタデータを含む値オブジェクト',
  })
)
type ItemStack = Schema.Schema.Type<typeof ItemStack>

// ✅ Schema.transformによる変換ロジック定義
const InventorySlot = Schema.Union(
  Schema.Literal('empty').pipe(
    Schema.transform(Schema.Struct({}), ItemState.Empty, {
      decode: () => ItemState.Empty(),
      encode: () => ({}),
    })
  ),
  Schema.Struct({ item: ItemStack }).pipe(
    Schema.transform(ItemState.Occupied, {
      decode: ({ item }) => ItemState.Occupied({ item }),
      encode: ({ item }) => ({ item }),
    })
  )
)

const Inventory = Schema.Struct({
  id: Schema.String.pipe(Schema.brand('InventoryId')),
  slots: Schema.ReadonlyArray(InventorySlot).pipe(
    Schema.minItems(9),
    Schema.maxItems(45),
    Schema.filter((slots) => slots.length % 9 === 0, {
      message: () => 'スロット数は9の倍数である必要があります',
    })
  ),
  maxSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
  selectedSlot: Schema.Number.pipe(Schema.between(0, 8), Schema.brand('SlotIndex')),
}).pipe(
  Schema.annotations({
    identifier: 'Inventory',
    title: 'インベントリ集約',
    description: 'プレイヤーのアイテム管理を行う集約ルート',
  })
)
type Inventory = Schema.Schema.Type<typeof Inventory>
```

### 実装例

```typescript
// ✅ 集約操作（ビジネスルール実装）- Effect.genによる副作用管理
const InventoryOperations = {
  // ✅ Match.typeによるADTパターンマッチング
  findEmptySlot: (inventory: Inventory): Option.Option<number> =>
    pipe(
      inventory.slots,
      ReadonlyArray.findIndex(
        Match.type<typeof ItemState.Empty | typeof ItemState.Occupied | typeof ItemState.Reserved>(),
        Match.tag('Empty', () => true),
        Match.orElse(() => false)
      ),
      (index) => (index === -1 ? Option.none() : Option.some(index))
    ),

  // ✅ Effect.catchTagsによるエラーハンドリング
  addItem: (inventory: Inventory, item: ItemStack): Effect.Effect<Inventory, InventoryError> =>
    Effect.gen(function* () {
      // Schema検証
      const validatedItem = yield* Schema.decodeUnknown(ItemStack)(item).pipe(
        Effect.catchTags({
          ParseError: (error) => Effect.fail({ _tag: 'ValidationError' as const, cause: error }),
        })
      )

      // 空きスロット検索
      const emptySlotIndex = yield* pipe(
        InventoryOperations.findEmptySlot(inventory),
        Option.match({
          onNone: () => Effect.fail({ _tag: 'InventoryFullError' as const }),
          onSome: Effect.succeed,
        })
      )

      // 不変更新
      const newSlots = ReadonlyArray.modify(inventory.slots, emptySlotIndex, () =>
        ItemState.Occupied({ item: validatedItem })
      )

      return {
        ...inventory,
        slots: newSlots,
      }
    }),

  // ✅ Schema.refinementによる複雑なバリデーション
  canStackItems: (existing: ItemStack, newItem: ItemStack): boolean =>
    existing.itemId === newItem.itemId &&
    existing.count + newItem.count <= 64 &&
    // メタデータの一致チェック
    JSON.stringify(existing.metadata) === JSON.stringify(newItem.metadata),

  // ✅ パターンマッチングによる状態遷移
  moveItem: (inventory: Inventory, fromSlot: SlotIndex, toSlot: SlotIndex): Effect.Effect<Inventory, InventoryError> =>
    Effect.gen(function* () {
      // 範囲チェック
      if (fromSlot < 0 || fromSlot >= inventory.slots.length || toSlot < 0 || toSlot >= inventory.slots.length) {
        return yield* Effect.fail({ _tag: 'InvalidSlotError' as const })
      }

      const fromState = inventory.slots[fromSlot]
      const toState = inventory.slots[toSlot]

      // 状態による分岐処理
      const moveResult = Match.value({ from: fromState, to: toState }).pipe(
        Match.when(
          ({ from, to }) => from._tag === 'Empty',
          () => Effect.fail({ _tag: 'EmptySlotMoveError' as const })
        ),
        Match.when(
          ({ from, to }) => from._tag === 'Occupied' && to._tag === 'Empty',
          ({ from }) =>
            Effect.succeed({
              newFromState: ItemState.Empty(),
              newToState: from,
            })
        ),
        Match.when(
          ({ from, to }) => from._tag === 'Occupied' && to._tag === 'Occupied',
          ({ from, to }) =>
            Effect.succeed({
              newFromState: to,
              newToState: from,
            })
        ),
        Match.orElse(() => Effect.fail({ _tag: 'InvalidMoveError' as const }))
      )

      const { newFromState, newToState } = yield* moveResult

      const newSlots = pipe(
        inventory.slots,
        ReadonlyArray.modify(fromSlot, () => newFromState),
        ReadonlyArray.modify(toSlot, () => newToState)
      )

      return {
        ...inventory,
        slots: newSlots,
      }
    }),
}

// ✅ Tagged Unionによる明示的なエラー型定義
const InventoryError = Data.taggedEnum<{
  readonly ValidationError: { readonly cause: unknown }
  readonly InventoryFullError: {}
  readonly InvalidSlotError: {}
  readonly EmptySlotMoveError: {}
  readonly InvalidMoveError: {}
}>()
type InventoryError = Data.TaggedEnum.Value<typeof InventoryError>
```

### 利点

- **一貫性保証**: 集約境界内でのビジネスルール遵守
- **封じ込め**: 複雑なドメインロジックの集約内封じ込め
- **トランザクション境界**: 明確なデータ変更単位
- **不変条件維持**: 集約操作による不変条件の自動保証

### 制約

- 集約の設計が複雑になりがち
- 過度に大きな集約はパフォーマンス問題を引き起こす
- 集約間の整合性管理は別途考慮が必要

---

## パターン3: Repositoryパターン

### 問題の文脈

ドメインオブジェクトの永続化と取得を、ドメインロジックから分離し、型安全で合成可能な方法で実装する必要があります。

### 解決策

Effect-TSの`Context.Tag`（class-based）とLayerシステムを使用して、Repository インターフェースを定義し、実装を依存性注入で提供します。

### Schema定義例

```typescript
import { Context, Layer, Ref } from "effect";

// ✅ Data.TaggedEnumによる判別共用体定義
const RepositoryError = Data.taggedEnum<{
  readonly NotFoundError: { readonly id: string; readonly entityType: string }
  readonly DuplicateError: { readonly id: string; readonly entityType: string }
  readonly PersistenceError: { readonly message: string; readonly cause?: unknown }
  readonly ValidationError: { readonly field: string; readonly value: unknown; readonly message: string }
}>>
type RepositoryError = Data.TaggedEnum.Value<typeof RepositoryError>;

// ✅ Service定義パターン - class-based Context.Tag
class PlayerRepository extends Context.Tag("@app/PlayerRepository")<PlayerRepository, {
  readonly findById: (id: PlayerId) => Effect.Effect<Option.Option<Player>, RepositoryError>
  readonly findByName: (name: PlayerName) => Effect.Effect<Option.Option<Player>, RepositoryError>
  readonly save: (player: Player) => Effect.Effect<void, RepositoryError>
  readonly delete: (id: PlayerId) => Effect.Effect<void, RepositoryError>
  readonly findAll: () => Effect.Effect<ReadonlyArray<Player>, RepositoryError>
  readonly findByCondition: (predicate: (player: Player) => boolean) => Effect.Effect<ReadonlyArray<Player>, RepositoryError>
}>() {}

// ✅ 検索条件のSchemaベース定義
const PlayerSearchCriteria = Schema.Struct({
  readonly name: Schema.optional(Schema.String.pipe(Schema.brand("PlayerName"))),
  readonly gameMode: Schema.optional(Schema.Literal("survival", "creative", "adventure", "spectator")),
  readonly healthRange: Schema.optional(Schema.Struct({
    readonly min: Schema.Number.pipe(Schema.between(0, 20)),
    readonly max: Schema.Number.pipe(Schema.between(0, 20))
  })),
  readonly positionRadius: Schema.optional(Schema.Struct({
    readonly center: Position,
    readonly radius: Schema.Number.pipe(Schema.positive())
  }))
});
type PlayerSearchCriteria = Schema.Schema.Type<typeof PlayerSearchCriteria>;
```

### 実装例

```typescript
import { SqlClient } from '@effect/sql'
import { HashMap } from 'effect'

// ✅ メモリ実装（テスト用）- HashMap使用で高効率化
const makePlayerRepositoryMemory = Effect.gen(function* () {
  const storage = yield* Ref.make(HashMap.empty<PlayerId, Player>())
  const nameIndex = yield* Ref.make(HashMap.empty<PlayerName, PlayerId>())

  return {
    findById: (id) =>
      Effect.gen(function* () {
        const store = yield* Ref.get(storage)
        return HashMap.get(store, id)
      }),

    // ✅ 複合検索の実装
    findByName: (name) =>
      Effect.gen(function* () {
        const nameIdx = yield* Ref.get(nameIndex)
        const playerId = HashMap.get(nameIdx, name)

        return yield* pipe(
          playerId,
          Option.match({
            onNone: () => Effect.succeed(Option.none()),
            onSome: (id) =>
              Effect.gen(function* () {
                const store = yield* Ref.get(storage)
                return HashMap.get(store, id)
              }),
          })
        )
      }),

    // ✅ Schema検証を含む保存処理
    save: (player) =>
      Effect.gen(function* () {
        // Schema検証
        const validatedPlayer = yield* Schema.decodeUnknown(Player)(player).pipe(
          Effect.catchTags({
            ParseError: (error) =>
              Effect.fail(
                RepositoryError.ValidationError({
                  field: 'player',
                  value: player,
                  message: 'Invalid player data',
                })
              ),
          })
        )

        // 重複チェック
        const existingStore = yield* Ref.get(storage)
        const existingPlayer = HashMap.get(existingStore, validatedPlayer.id)

        if (Option.isSome(existingPlayer) && existingPlayer.value.name !== validatedPlayer.name) {
          // 名前変更時のインデックス更新
          yield* Ref.update(nameIndex, (idx) =>
            pipe(idx, HashMap.remove(existingPlayer.value.name), HashMap.set(validatedPlayer.name, validatedPlayer.id))
          )
        } else if (Option.isNone(existingPlayer)) {
          // 新規プレイヤーのインデックス追加
          yield* Ref.update(nameIndex, (idx) => HashMap.set(idx, validatedPlayer.name, validatedPlayer.id))
        }

        // プレイヤー保存
        yield* Ref.update(storage, (store) => HashMap.set(store, validatedPlayer.id, validatedPlayer))
        yield* Effect.log(`プレイヤー ${validatedPlayer.name} を保存しました`)
      }),

    delete: (id) =>
      Effect.gen(function* () {
        const store = yield* Ref.get(storage)
        const player = HashMap.get(store, id)

        if (Option.isNone(player)) {
          return yield* Effect.fail(RepositoryError.NotFoundError({ id, entityType: 'Player' }))
        }

        yield* Ref.update(storage, (store) => HashMap.remove(store, id))
        yield* Ref.update(nameIndex, (idx) => HashMap.remove(idx, player.value.name))
        yield* Effect.log(`プレイヤー ${player.value.name} を削除しました`)
      }),

    findAll: () =>
      Effect.gen(function* () {
        const store = yield* Ref.get(storage)
        return HashMap.values(store)
      }),

    // ✅ 複雑な検索条件の実装
    findByCondition: (predicate) =>
      Effect.gen(function* () {
        const store = yield* Ref.get(storage)
        return pipe(HashMap.values(store), ReadonlyArray.filter(predicate))
      }),
  }
})

// ✅ データベース実装 - SqlClientパターン使用
const makePlayerRepositoryDatabase = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  return {
    findById: (id) =>
      Effect.gen(function* () {
        const result = yield* sql<{
          readonly id: string
          readonly name: string
          readonly position_x: number
          readonly position_y: number
          readonly position_z: number
          readonly health: number
          readonly game_mode: string
        }>`SELECT * FROM players WHERE id = ${id}`.pipe(
          Effect.catchTags({
            SqlError: (error) =>
              Effect.fail(
                RepositoryError.PersistenceError({
                  message: `Player query failed: ${error.message}`,
                  cause: error,
                })
              ),
          })
        )

        if (result.length === 0) {
          return Option.none()
        }

        // ✅ Schema.transformによるデータ変換
        const playerData = yield* Schema.decodeUnknown(Player)({
          id: result[0].id,
          name: result[0].name,
          position: {
            x: result[0].position_x,
            y: result[0].position_y,
            z: result[0].position_z,
          },
          rotation: { yaw: 0, pitch: 0 }, // デフォルト値
          health: result[0].health,
          gameMode: result[0].game_mode,
        }).pipe(
          Effect.catchTags({
            ParseError: (error) =>
              Effect.fail(
                RepositoryError.ValidationError({
                  field: 'player',
                  value: result[0],
                  message: 'Invalid player data format',
                })
              ),
          })
        )

        return Option.some(playerData)
      }),

    save: (player) =>
      Effect.gen(function* () {
        yield* sql`
          INSERT INTO players (id, name, position_x, position_y, position_z, health, game_mode)
          VALUES (${player.id}, ${player.name}, ${player.position.x}, ${player.position.y}, ${player.position.z}, ${player.health}, ${player.gameMode})
          ON CONFLICT(id) DO UPDATE SET
            name = EXCLUDED.name,
            position_x = EXCLUDED.position_x,
            position_y = EXCLUDED.position_y,
            position_z = EXCLUDED.position_z,
            health = EXCLUDED.health,
            game_mode = EXCLUDED.game_mode
        `.pipe(
          Effect.catchTags({
            SqlError: (error) =>
              Effect.fail(
                RepositoryError.PersistenceError({
                  message: `Failed to save player: ${error.message}`,
                  cause: error,
                })
              ),
          })
        )
      }),

    findByName: (name) =>
      Effect.gen(function* () {
        const result = yield* sql<{ readonly id: string; readonly name: string }>`
          SELECT id, name FROM players WHERE name = ${name}
        `
        return result.length > 0 ? yield* this.findById(result[0].id as PlayerId) : Option.none()
      }),

    delete: (id) =>
      Effect.gen(function* () {
        const result = yield* sql`DELETE FROM players WHERE id = ${id}`
        if (result.affectedRows === 0) {
          return yield* Effect.fail(RepositoryError.NotFoundError({ id, entityType: 'Player' }))
        }
      }),

    findAll: () =>
      Effect.gen(function* () {
        const results = yield* sql<
          Array<{
            readonly id: string
            readonly name: string
            readonly position_x: number
            readonly position_y: number
            readonly position_z: number
            readonly health: number
            readonly game_mode: string
          }>
        >`SELECT * FROM players`

        return yield* Effect.forEach(results, (row) =>
          Schema.decodeUnknown(Player)({
            id: row.id,
            name: row.name,
            position: { x: row.position_x, y: row.position_y, z: row.position_z },
            rotation: { yaw: 0, pitch: 0 },
            health: row.health,
            gameMode: row.game_mode,
          })
        )
      }),

    findByCondition: (predicate) =>
      Effect.gen(function* () {
        const allPlayers = yield* this.findAll()
        return ReadonlyArray.filter(allPlayers, predicate)
      }),
  }
})

// ✅ Layer定義
export const PlayerRepositoryMemoryLive = Layer.effect(PlayerRepository, makePlayerRepositoryMemory)

export const PlayerRepositoryDatabaseLive = Layer.effect(PlayerRepository, makePlayerRepositoryDatabase).pipe(
  Layer.provide(SqlClient.SqlClient)
)
```

### 利点

- **関心の分離**: ドメインロジックと永続化ロジックの分離
- **テスタビリティ**: 異なる実装を簡単に切り替え可能
- **型安全性**: Effect型による明示的なエラーハンドリング
- **合成可能性**: 他のサービスとの組み合わせが容易

### 制約

- 実装の複雑さが増加
- 抽象化レイヤーのオーバーヘッド
- 複雑なクエリの表現が困難な場合がある

---

## パターン4: Branded Typesパターン

### 問題の文脈

プリミティブ型（string, number等）を使用する際に、異なる概念のデータが誤って混在することを防ぎ、型レベルでドメイン概念を明確に表現する必要があります。

### 解決策

Effect-TSのBrand機能を使用して、プリミティブ型に型レベルのタグを付与し、実行時検証と組み合わせて型安全性を向上させます。

### Schema定義例

```typescript
// ✅ Branded Types定義 - Brand.Brand型による意味的な型安全性
type PlayerId = string & Brand.Brand<'PlayerId'>
const PlayerId = Schema.String.pipe(Schema.pattern(/^player_[a-f0-9]{32}$/), Schema.brand('PlayerId'))

type ChunkId = string & Brand.Brand<'ChunkId'>
const ChunkId = Schema.String.pipe(Schema.pattern(/^chunk_-?\d+_-?\d+$/), Schema.brand('ChunkId'))

type BlockId = string & Brand.Brand<'BlockId'>
const BlockId = Schema.String.pipe(Schema.pattern(/^minecraft:[a-z_]+$/), Schema.brand('BlockId'))

// ✅ 数値型のBranded Types - Schema.refinementによる複雑なバリデーション
type Health = number & Brand.Brand<'Health'>
const Health = Schema.Number.pipe(
  Schema.between(0, 20),
  Schema.filter((n) => Number.isInteger(n * 2), {
    message: () => 'Health must be in 0.5 increments',
  }),
  Schema.brand('Health')
)

type Experience = number & Brand.Brand<'Experience'>
const Experience = Schema.Number.pipe(Schema.nonNegative(), Schema.int(), Schema.brand('Experience'))

type Timestamp = number & Brand.Brand<'Timestamp'>
const Timestamp = Schema.Number.pipe(
  Schema.positive(),
  Schema.filter((n) => n <= Date.now() + 86400000, {
    // 24時間未来まで許可
    message: () => 'Timestamp cannot be more than 24 hours in the future',
  }),
  Schema.brand('Timestamp')
)

// ✅ 複合Branded Types - Schema.transformによる双方向変換
type Coordinate = number & Brand.Brand<'Coordinate'>
const Coordinate = Schema.Number.pipe(Schema.int(), Schema.between(-30_000_000, 30_000_000), Schema.brand('Coordinate'))

// ✅ 高度なSchema.transform使用例
const ChunkPosition = Schema.Struct({
  x: Coordinate,
  z: Coordinate,
}).pipe(
  Schema.transform(
    Schema.Struct({
      x: Coordinate,
      z: Coordinate,
    }),
    Schema.String.pipe(Schema.brand('ChunkId')),
    {
      // エンコード: 座標 → ChunkId文字列
      decode: ({ x, z }) => `chunk_${x}_${z}` as ChunkId,
      // デコード: ChunkId文字列 → 座標
      encode: (chunkId) => {
        const match = chunkId.match(/^chunk_(-?\d+)_(-?\d+)$/)
        if (!match) {
          throw new Error(`Invalid ChunkId format: ${chunkId}`)
        }
        const [, xStr, zStr] = match
        return {
          x: parseInt(xStr, 10) as Coordinate,
          z: parseInt(zStr, 10) as Coordinate,
        }
      },
    }
  ),
  Schema.annotations({
    identifier: 'ChunkPosition',
    title: 'チャンク位置',
    description: 'チャンクの座標とIDの相互変換を提供する複合型',
  })
)
type ChunkPosition = Schema.Schema.Type<typeof ChunkPosition>

// ✅ 階層的Branded Types定義
type WorldName = string & Brand.Brand<'WorldName'>
const WorldName = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(64),
  Schema.pattern(/^[a-zA-Z0-9_-]+$/),
  Schema.brand('WorldName')
)

type DimensionId = string & Brand.Brand<'DimensionId'>
const DimensionId = Schema.Literal('overworld', 'nether', 'end').pipe(Schema.brand('DimensionId'))

// ✅ 複合識別子の構築
const WorldCoordinate = Schema.Struct({
  world: WorldName,
  dimension: DimensionId,
  position: Position,
}).pipe(
  Schema.annotations({
    identifier: 'WorldCoordinate',
    title: '世界座標',
    description: 'ワールド、ディメンション、位置を含む完全な座標情報',
  })
)
type WorldCoordinate = Schema.Schema.Type<typeof WorldCoordinate>
```

### 実装例

```typescript
import { Either, pipe } from "effect";

// ✅ ValidationError型の定義
const ValidationError = Data.taggedEnum<{
  readonly ValidationError: { readonly field: string; readonly value: unknown; readonly message: string }
  readonly ParseError: { readonly cause: unknown }
}>.
type ValidationError = Data.TaggedEnum.Value<typeof ValidationError>;

// ✅ Schema駆動のBranded Types操作関数
const BrandedTypeOperations = {
  // PlayerId生成 - Effect.genによる合成可能なエラーハンドリング
  createPlayerId: (rawId: string): Effect.Effect<PlayerId, ValidationError> =>
    Schema.decodeUnknown(PlayerId)(rawId).pipe(
      Effect.catchTags({
        ParseError: (error) => Effect.fail(ValidationError.ValidationError({
          field: "playerId",
          value: rawId,
          message: "Invalid player ID format"
        }))
      })
    ),

  // ChunkId生成 - 複数の検証ステップを合成
  createChunkId: (x: number, z: number): Effect.Effect<ChunkId, ValidationError> =>
    Effect.gen(function* () {
      const coordX = yield* Schema.decodeUnknown(Coordinate)(x).pipe(
        Effect.catchTags({
          ParseError: () => Effect.fail(ValidationError.ValidationError({
            field: "x",
            value: x,
            message: "Invalid X coordinate"
          }))
        })
      );

      const coordZ = yield* Schema.decodeUnknown(Coordinate)(z).pipe(
        Effect.catchTags({
          ParseError: () => Effect.fail(ValidationError.ValidationError({
            field: "z",
            value: z,
            message: "Invalid Z coordinate"
          }))
        })
      );

      return `chunk_${coordX}_${coordZ}` as ChunkId;
    }),

  // ✅ より複雑なバリデーションロジック
  createWorldCoordinate: (
    world: string,
    dimension: string,
    position: unknown
  ): Effect.Effect<WorldCoordinate, ValidationError> =>
    Effect.gen(function* () {
      const validatedWorld = yield* Schema.decodeUnknown(WorldName)(world);
      const validatedDimension = yield* Schema.decodeUnknown(DimensionId)(dimension);
      const validatedPosition = yield* Schema.decodeUnknown(Position)(position);

      return {
        world: validatedWorld,
        dimension: validatedDimension,
        position: validatedPosition
      };
    })
};

// ✅ 型安全な計算関数 - Match.valueによる条件分岐
const HealthOperations = {
  calculatePercentage: (health: Health): number => (health / 20) * 100,

  getHealthStatus: (health: Health): string =>
    pipe(
      health,
      Match.value,
      Match.when(20, () => "満タン"),
      Match.when((h) => h >= 15, () => "健康"),
      Match.when((h) => h >= 10, () => "軽傷"),
      Match.when((h) => h >= 5, () => "負傷"),
      Match.when((h) => h > 0, () => "重傷"),
      Match.orElse(() => "死亡")
    ),

  canRegenerateNaturally: (health: Health): boolean => health > 0 && health < 20
};

const ExperienceOperations = {
  add: (current: Experience, additional: Experience): Experience =>
    (current + additional) as Experience,

  // レベル計算のロジック - Match.value による段階的判定
  calculateLevel: (experience: Experience): number =>
    pipe(
      Match.value(experience),
      Match.when(
        (exp) => exp < 352,
        (exp) => Math.floor(Math.sqrt(exp + 9) - 3)
      ),
      Match.when(
        (exp) => exp < 1507,
        (exp) => Math.floor(8.1 + Math.sqrt(0.4 * (exp - 158.25)))
      ),
      Match.orElse(
        (exp) => Math.floor((325/18) + Math.sqrt((2/9) * (exp - (54215/72))))
      )
    )
};

const TimestampOperations = {
  isRecent: (timestamp: Timestamp, windowMs: number = 300000): boolean =>
    Date.now() - timestamp < windowMs,

  formatRelative: (timestamp: Timestamp): string => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    return pipe(
      { minutes, hours, days },
      Match.value,
      Match.when(({ days }) => days > 0, ({ days }) => `${days}日前`),
      Match.when(({ hours }) => hours > 0, ({ hours }) => `${hours}時間前`),
      Match.when(({ minutes }) => minutes > 0, ({ minutes }) => `${minutes}分前`),
      Match.orElse(() => "たった今")
    );
  }
};

// ✅ 型ガード関数 - Either.match使用
const TypeGuards = {
  isValidPlayerId: (value: string): value is PlayerId =>
    pipe(
      Schema.decodeUnknownEither(PlayerId)(value),
      Either.match({
        onLeft: () => false,
        onRight: () => true
      })
    ),

  isValidBlockId: (value: string): value is BlockId =>
    pipe(
      Schema.decodeUnknownEither(BlockId)(value),
      Either.isRight
    ),

  // より複雑な条件での型ガード
  isValidCoordinate: (value: unknown): value is Coordinate =>
    pipe(
      Schema.decodeUnknownEither(Coordinate)(value),
      Either.match({
        onLeft: () => false,
        onRight: (coord) => coord >= -30_000_000 && coord <= 30_000_000
      })
    )
};

// ✅ 変換ヘルパー - Option.matchによる安全な変換
const ConversionHelpers = {
  playerIdToString: (id: PlayerId): string => id,

  stringToPlayerId: (s: string): Option.Option<PlayerId> =>
    pipe(
      Schema.decodeUnknownEither(PlayerId)(s),
      Either.match({
        onLeft: () => Option.none(),
        onRight: Option.some
      })
    ),

  // 複数のBranded Typesを同時に変換
  parsePlayerIdentifiers: (data: {
    id: string;
    name: string;
  }): Effect.Effect<{ id: PlayerId; name: PlayerName }, ValidationError> =>
    Effect.gen(function* () {
      const validatedId = yield* BrandedTypeOperations.createPlayerId(data.id);
      const validatedName = yield* Schema.decodeUnknown(
        Schema.String.pipe(Schema.brand("PlayerName"))
      )(data.name);

      return {
        id: validatedId,
        name: validatedName
      };
    })
};
```

### 利点

- **型安全性**: コンパイル時に型の誤用を防止
- **実行時検証**: パターンや範囲の動的検証
- **ドメイン表現**: ビジネス概念の型レベル表現
- **リファクタリング安全性**: 型変更時の影響範囲が明確

### 制約

- ランタイム検証のパフォーマンスコスト
- 型変換の複雑さが増加
- デバッグ時の型情報の複雑化

---

## パターン5: Immutable Dataパターン

### 問題の文脈

関数型プログラミングにおいて、データの不変性を保ちながら効率的なデータ操作を行い、予期しない副作用を防ぐ必要があります。

### 解決策

Effect-TSのReadonlyArrayやHashMapなどの不変データ構造を使用し、すべてのデータ操作を不変操作として実装します。

### Schema定義例

```typescript
// ✅ Weather状態をTagged Unionで定義
const WeatherState = Data.taggedEnum<{
  readonly Clear: { readonly visibility: number }
  readonly Rain: { readonly intensity: number; readonly duration: number }
  readonly Storm: { readonly intensity: number; readonly lightningFrequency: number }
  readonly Snow: { readonly intensity: number; readonly accumulation: number }
}>()
type WeatherState = Data.TaggedEnum.Value<typeof WeatherState>

// ✅ GameRule値の型安全な定義
const GameRuleValue = Schema.Union(
  Schema.String.pipe(Schema.brand('StringGameRule')),
  Schema.Number.pipe(Schema.brand('NumberGameRule')),
  Schema.Boolean.pipe(Schema.brand('BooleanGameRule'))
)

// ✅ 不変データ構造の定義 - ReadonlyArrayによる不変性保証
const GameState = Schema.Struct({
  players: Schema.ReadonlyArray(Player),
  world: Schema.Struct({
    chunks: Schema.ReadonlyArray(
      Schema.Struct({
        id: ChunkId,
        blocks: Schema.instanceOf(Uint16Array).pipe(
          Schema.filter((arr) => arr.length === 4096, {
            message: 'Chunk must contain exactly 4096 blocks (16x16x16)',
          })
        ),
        entities: Schema.ReadonlyArray(EntityId),
        lastModified: Timestamp,
        isLoaded: Schema.Boolean,
        isDirty: Schema.Boolean,
      })
    ),
    time: Schema.Number.pipe(Schema.between(0, 24000), Schema.brand('WorldTime')),
    weather: WeatherState,
    seed: Schema.Number.pipe(Schema.brand('WorldSeed')),
  }),
  gameRules: Schema.ReadonlyRecord({
    key: Schema.String,
    value: GameRuleValue,
  }),
  serverInfo: Schema.Struct({
    tickRate: Schema.Number.pipe(Schema.between(1, 40)),
    maxPlayers: Schema.Number.pipe(Schema.int(), Schema.positive()),
    difficulty: Schema.Literal('peaceful', 'easy', 'normal', 'hard'),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'GameState',
    title: 'ゲーム状態',
    description: 'ゲーム全体の不変状態を表すデータ構造',
  })
)
type GameState = Schema.Schema.Type<typeof GameState>

// ✅ チャンクデータ（SoAパターン）- TypedArrayの最適化
const ChunkData = Schema.Struct({
  id: ChunkId,
  // Structure of Arrays パターンで効率的なメモリレイアウト
  blocks: Schema.instanceOf(Uint16Array).pipe(
    Schema.filter((arr) => arr.length === 4096, {
      message: 'Chunk must contain exactly 4096 blocks (16x16x16)',
    })
  ),
  lightLevels: Schema.instanceOf(Uint8Array).pipe(
    Schema.filter((arr) => arr.length === 4096, {
      message: 'Light levels array must have 4096 elements',
    })
  ),
  biomes: Schema.instanceOf(Uint8Array).pipe(
    Schema.filter((arr) => arr.length === 256, {
      message: 'Biome array must have 256 elements (16x16)',
    })
  ),
  skyLight: Schema.instanceOf(Uint8Array).pipe(
    Schema.filter((arr) => arr.length === 2048, {
      message: 'Sky light array must have 2048 elements',
    })
  ),
  blockLight: Schema.instanceOf(Uint8Array).pipe(
    Schema.filter((arr) => arr.length === 2048, {
      message: 'Block light array must have 2048 elements',
    })
  ),
  entities: Schema.ReadonlyArray(EntityId),
  tileEntities: Schema.ReadonlyArray(
    Schema.Struct({
      id: EntityId,
      position: Position,
      type: Schema.String.pipe(Schema.brand('TileEntityType')),
      data: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    })
  ),
  lastUpdate: Timestamp,
  generationStep: Schema.Literal(
    'empty',
    'structure_starts',
    'structure_references',
    'biomes',
    'noise',
    'surface',
    'carvers',
    'liquid_carvers',
    'features',
    'light',
    'spawn',
    'heightmaps',
    'full'
  ),
}).pipe(
  Schema.annotations({
    identifier: 'ChunkData',
    title: 'チャンクデータ',
    description: 'Structure of Arrays パターンによる高効率チャンクデータ',
  })
)
type ChunkData = Schema.Schema.Type<typeof ChunkData>

// ✅ チャンク状態管理用のADT
const ChunkState = Data.taggedEnum<{
  readonly Unloaded: {}
  readonly Loading: { readonly progress: number }
  readonly Loaded: { readonly data: ChunkData }
  readonly Unloading: { readonly data: ChunkData }
  readonly Error: { readonly reason: string }
}>()
type ChunkState = Data.TaggedEnum.Value<typeof ChunkState>
```

### 実装例

```typescript
// ✅ 不変データ操作 - Effect.genによる副作用管理
const GameStateOperations = {
  // プレイヤー追加（Effect合成）
  addPlayer: (gameState: GameState, player: Player): Effect.Effect<GameState, GameStateError> =>
    Effect.gen(function* () {
      // プレイヤー検証
      const validatedPlayer = yield* Schema.decodeUnknown(Player)(player)

      // 重複チェック
      const existingPlayer = ReadonlyArray.find(gameState.players, (p) => p.id === validatedPlayer.id)

      if (Option.isSome(existingPlayer)) {
        return yield* Effect.fail(GameStateError.DuplicatePlayerError({ id: validatedPlayer.id }))
      }

      yield* Effect.log(`プレイヤー ${validatedPlayer.name} がゲームに参加しました`)

      return {
        ...gameState,
        players: ReadonlyArray.append(gameState.players, validatedPlayer),
      }
    }),

  // プレイヤー更新（Match.valueによる条件分岐）
  updatePlayer: (
    gameState: GameState,
    playerId: PlayerId,
    updater: (player: Player) => Effect.Effect<Player, PlayerUpdateError>
  ): Effect.Effect<GameState, GameStateError> =>
    Effect.gen(function* () {
      const index = ReadonlyArray.findIndex(gameState.players, (p) => p.id === playerId)

      if (index === -1) {
        return yield* Effect.fail(GameStateError.PlayerNotFoundError({ id: playerId }))
      }

      const currentPlayer = gameState.players[index]
      const updatedPlayer = yield* updater(currentPlayer)

      const updatedPlayers = ReadonlyArray.modify(gameState.players, index, () => updatedPlayer)

      return {
        ...gameState,
        players: updatedPlayers,
      }
    }),

  // プレイヤー削除（ログ付き）
  removePlayer: (gameState: GameState, playerId: PlayerId): Effect.Effect<GameState, GameStateError> =>
    Effect.gen(function* () {
      const player = ReadonlyArray.find(gameState.players, (p) => p.id === playerId)

      if (Option.isNone(player)) {
        return yield* Effect.fail(GameStateError.PlayerNotFoundError({ id: playerId }))
      }

      yield* Effect.log(`プレイヤー ${player.value.name} がゲームから退出しました`)

      return {
        ...gameState,
        players: ReadonlyArray.filter(gameState.players, (p) => p.id !== playerId),
      }
    }),

  // ワールド時間更新（天候連動）
  advanceTime: (gameState: GameState, deltaTime: number): Effect.Effect<GameState, never> =>
    Effect.gen(function* () {
      const newTime = (gameState.world.time + deltaTime) % 24000

      // 時間帯による天候変化のロジック
      const weatherTransition = pipe(
        { currentWeather: gameState.world.weather, time: newTime },
        Match.value,
        Match.when(
          ({ time }) => time >= 12000 && time < 13000, // 夜間
          ({ currentWeather }) => WeatherState.Clear({ visibility: 0.1 })
        ),
        Match.when(
          ({ time }) => time >= 0 && time < 1000, // 朝
          () => WeatherState.Clear({ visibility: 1.0 })
        ),
        Match.orElse(({ currentWeather }) => currentWeather)
      )

      return {
        ...gameState,
        world: {
          ...gameState.world,
          time: newTime,
          weather: weatherTransition,
        },
      }
    }),

  // 天気変更（複雑な状態遷移）
  changeWeather: (gameState: GameState, newWeather: WeatherState): Effect.Effect<GameState, GameStateError> =>
    Effect.gen(function* () {
      // 天気変更の妥当性チェック
      const isValidTransition = pipe(
        { from: gameState.world.weather, to: newWeather },
        Match.value,
        Match.when(
          ({ from, to }) => from._tag === 'Storm' && to._tag === 'Clear',
          () => false // 嵐から直接快晴には変化しない
        ),
        Match.orElse(() => true)
      )

      if (!isValidTransition) {
        return yield* Effect.fail(
          GameStateError.InvalidWeatherTransitionError({
            from: gameState.world.weather._tag,
            to: newWeather._tag,
          })
        )
      }

      yield* Effect.log(`天候が ${newWeather._tag} に変更されました`)

      return {
        ...gameState,
        world: {
          ...gameState.world,
          weather: newWeather,
        },
      }
    }),
}

// ✅ 高効率バッチ操作
const BatchOperations = {
  // HashMap使用による効率的な一括更新
  updatePlayerPositions: (
    gameState: GameState,
    updates: ReadonlyArray<{ playerId: PlayerId; position: Position }>
  ): Effect.Effect<GameState, GameStateError> =>
    Effect.gen(function* () {
      // 更新マップをHashMapで構築（O(1)アクセス）
      const updateMap = HashMap.fromIterable(updates.map((update) => [update.playerId, update.position]))

      // 効率的な一括更新
      const updatedPlayers = ReadonlyArray.map(gameState.players, (player) => {
        const newPosition = HashMap.get(updateMap, player.id)
        return Option.match(newPosition, {
          onNone: () => player,
          onSome: (position) => ({ ...player, position }),
        })
      })

      return {
        ...gameState,
        players: updatedPlayers,
      }
    }),

  // TypedArray最適化されたチャンクブロック更新
  updateChunkBlocks: (
    chunk: ChunkData,
    blockUpdates: ReadonlyArray<{ index: number; blockId: number; metadata?: unknown }>
  ): Effect.Effect<ChunkData, ChunkUpdateError> =>
    Effect.gen(function* () {
      // バリデーション
      const validUpdates = yield* Effect.forEach(blockUpdates, (update) => {
        if (update.index < 0 || update.index >= 4096) {
          return Effect.fail(ChunkUpdateError.InvalidBlockIndexError({ index: update.index }))
        }
        if (update.blockId < 0 || update.blockId > 65535) {
          return Effect.fail(ChunkUpdateError.InvalidBlockIdError({ blockId: update.blockId }))
        }
        return Effect.succeed(update)
      })

      // TypedArrayの効率的な複製と更新
      const newBlocks = new Uint16Array(chunk.blocks)
      const newLightLevels = new Uint8Array(chunk.lightLevels)

      // バッチ更新（副作用を制御）
      validUpdates.forEach((update) => {
        newBlocks[update.index] = update.blockId
        // ブロック変更に伴う光源レベル再計算（簡略化）
        newLightLevels[update.index] = update.blockId === 0 ? 15 : 0
      })

      return {
        ...chunk,
        blocks: newBlocks,
        lightLevels: newLightLevels,
        lastUpdate: Date.now() as Timestamp,
        isDirty: true,
      }
    }),

  // 空間インデックス使用による効率的な範囲検索
  getPlayersInRange: (
    gameState: GameState,
    center: Position,
    radius: number
  ): Effect.Effect<ReadonlyArray<Player>, never> =>
    Effect.gen(function* () {
      yield* Effect.log(`範囲検索: 中心(${center.x}, ${center.y}, ${center.z}), 半径${radius}`)

      return pipe(
        gameState.players,
        ReadonlyArray.filter((player) => {
          const distance = calculateDistance(player.position, center)
          return distance <= radius
        })
      )
    }),

  // 複合条件での高効率フィルタリング
  getPlayersBy: (gameState: GameState, criteria: PlayerSearchCriteria): Effect.Effect<ReadonlyArray<Player>, never> =>
    Effect.gen(function* () {
      return pipe(
        gameState.players,
        ReadonlyArray.filter((player) => {
          // 名前フィルタ
          if (Option.isSome(criteria.name) && player.name !== criteria.name.value) {
            return false
          }

          // ゲームモードフィルタ
          if (Option.isSome(criteria.gameMode) && player.gameMode !== criteria.gameMode.value) {
            return false
          }

          // 体力範囲フィルタ - Match.value による範囲チェック
          if (Option.isSome(criteria.healthRange)) {
            const range = criteria.healthRange.value
            return pipe(
              Match.value({ health: player.health, range }),
              Match.when(
                ({ health, range }) => health < range.min || health > range.max,
                () => false
              ),
              Match.orElse(() => true)
            )
              ? true
              : false
          }

          // 位置範囲フィルタ - Match.value による距離判定
          if (Option.isSome(criteria.positionRadius)) {
            const posFilter = criteria.positionRadius.value
            const distance = calculateDistance(player.position, posFilter.center)
            return pipe(
              Match.value(distance),
              Match.when(
                (dist) => dist > posFilter.radius,
                () => false
              ),
              Match.orElse(() => true)
            )
              ? true
              : false
          }

          return true
        })
      )
    }),
}

// ✅ 効率的なインデックス作成とアクセス
const IndexOperations = {
  createPlayerIndex: (players: ReadonlyArray<Player>): HashMap.HashMap<PlayerId, Player> =>
    HashMap.fromIterable(ReadonlyArray.map(players, (player) => [player.id, player])),

  createChunkIndex: (chunks: ReadonlyArray<ChunkData>): HashMap.HashMap<ChunkId, ChunkData> =>
    HashMap.fromIterable(ReadonlyArray.map(chunks, (chunk) => [chunk.id, chunk])),

  // 位置ベースの空間インデックス（簡略化）
  createSpatialIndex: (players: ReadonlyArray<Player>): HashMap.HashMap<string, ReadonlyArray<Player>> => {
    const grouped = ReadonlyArray.groupBy(players, (player) => {
      // 64x64のグリッドでグループ化
      const gridX = Math.floor(player.position.x / 64)
      const gridZ = Math.floor(player.position.z / 64)
      return `${gridX},${gridZ}`
    })

    return HashMap.fromIterable(Object.entries(grouped))
  },
}

// ✅ 効率的な状態更新パイプライン
const updateGameStatePipeline = (
  initialState: GameState,
  operations: ReadonlyArray<(state: GameState) => Effect.Effect<GameState, GameStateError>>
): Effect.Effect<GameState, GameStateError> =>
  ReadonlyArray.reduce(operations, Effect.succeed(initialState), (accEffect, operation) =>
    Effect.flatMap(accEffect, operation)
  )

// ✅ 複合操作の例（Effect.gen使用）
const complexGameUpdate = (gameState: GameState): Effect.Effect<GameState, GameStateError> =>
  Effect.gen(function* () {
    const state1 = yield* GameStateOperations.advanceTime(gameState, 50)
    const state2 = yield* GameStateOperations.changeWeather(
      state1,
      WeatherState.Rain({ intensity: 0.5, duration: 6000 })
    )
    const state3 = yield* BatchOperations.updatePlayerPositions(state2, [
      { playerId: 'player_123' as PlayerId, position: { x: 10, y: 64, z: 20 } },
    ])

    yield* Effect.log('複合ゲーム更新が完了しました')
    return state3
  })

// ✅ エラー型の定義
const GameStateError = Data.taggedEnum<{
  readonly DuplicatePlayerError: { readonly id: PlayerId }
  readonly PlayerNotFoundError: { readonly id: PlayerId }
  readonly InvalidWeatherTransitionError: { readonly from: string; readonly to: string }
  readonly ChunkNotFoundError: { readonly id: ChunkId }
}>()
type GameStateError = Data.TaggedEnum.Value<typeof GameStateError>

const ChunkUpdateError = Data.taggedEnum<{
  readonly InvalidBlockIndexError: { readonly index: number }
  readonly InvalidBlockIdError: { readonly blockId: number }
  readonly ChunkNotLoadedError: { readonly id: ChunkId }
}>()
type ChunkUpdateError = Data.TaggedEnum.Value<typeof ChunkUpdateError>

const PlayerUpdateError = Data.taggedEnum<{
  readonly InvalidPositionError: { readonly position: unknown }
  readonly InvalidHealthError: { readonly health: unknown }
}>()
type PlayerUpdateError = Data.TaggedEnum.Value<typeof PlayerUpdateError>
```

### 利点

- **予測可能性**: 不変データによる副作用の排除
- **並行安全性**: 複数スレッドでの安全な読み取りアクセス
- **デバッグ容易性**: 状態変化の追跡が容易
- **関数型合成**: パイプライン処理での自然な合成
- **メモリ効率**: 構造共有による効率的なメモリ使用

### 制約

- 学習コストが高い
- 大量データ操作時のパフォーマンス考慮が必要
- GCプレッシャーが高い場合がある

---

## まとめ

この文書では、TypeScript MinecraftプロジェクトにおけるDDD原則に基づく5つの主要なデータモデリングパターンを説明しました。

### パターンの使い分けガイド

1. **Entity/Value Objectパターン**: ドメインオブジェクトの基本設計
2. **Aggregateパターン**: 複雑なビジネスルールとトランザクション境界の管理
3. **Repositoryパターン**: データアクセスとドメインロジックの分離
4. **Branded Typesパターン**: 型安全性とドメイン概念の明確化
5. **Immutable Dataパターン**: 関数型プログラミングによる予測可能なデータ操作

### 実装時の注意点

- すべてのデータ構造は`Schema.Struct`で定義する
- Brand型を積極的に活用して型安全性を向上させる
- 不変性を保ち、純粋関数での操作を心がける
- パフォーマンスが重要な部分では`TypedArray`や`HashMap`を活用する
- Effect-TSの型システムを最大限活用してエラーハンドリングを明示的にする

これらのパターンを適切に組み合わせることで、型安全で保守可能、かつ高性能なドメインモデルを構築できます。

## 関連ドキュメント

- [Effect-TS利用パターン](../explanations/architecture/06-effect-ts-patterns.md) - Effect-TS 3.17+の最新パターン詳細
- [DDD戦略的設計](../explanations/architecture/02-ddd-strategic-design.md) - ドメイン駆動設計の戦略レベル詳細
- [サービスパターン](./service-patterns.md) - サービス層の設計パターン
- [エラーハンドリングパターン](./error-handling-patterns.md) - 型安全なエラーハンドリング
