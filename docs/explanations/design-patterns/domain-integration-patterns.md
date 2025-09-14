---
title: "ドメイン統合パターン - DDD+ECS融合アーキテクチャ"
description: "DDD（ドメイン駆動設計）とECS（Entity Component System）を統合したアーキテクチャの設計思想と実装戦略"
category: "architecture"
difficulty: "advanced"
tags: ["ddd", "ecs", "domain-integration", "architecture-patterns", "effect-ts"]
prerequisites: ["ddd-concepts", "ecs-architecture", "effect-ts-fundamentals"]
estimated_reading_time: "20分"
related_patterns: ["data-modeling-patterns", "service-patterns", "functional-programming-philosophy"]
related_docs: ["../architecture/overview.md", "../game-mechanics/00-core-features/architecture-principles.md"]
---

# ドメイン統合パターン - DDD+ECS融合アーキテクチャ

## 統合アーキテクチャの必要性

TypeScript Minecraftでは、2つの異なるアーキテクチャパラダイムを統合しています：

- **DDD (Domain-Driven Design)**: ビジネスロジックの複雑性を管理
- **ECS (Entity Component System)**: ゲームオブジェクトのパフォーマンス最適化

なぜこの統合が必要なのか？それぞれ単体では不十分な理由を解説します。

### DDD単体の限界

**ドメイン駆動設計の強み**:
```typescript
// ✅ Effect-TS関数型ドメインロジックの明確な表現
const PlayerDeathEvent = Schema.TaggedError("PlayerDeathEvent")({
  playerId: PlayerId,
  deathTime: Schema.Date,
  cause: Schema.String
})

const PlayerDamagedEvent = Schema.TaggedError("PlayerDamagedEvent")({
  playerId: PlayerId,
  damage: Schema.Number,
  remainingHealth: Schema.Number
})

interface Player {
  readonly id: PlayerId
  readonly health: Health
  readonly inventory: Inventory
}

const Player = Context.GenericTag<Player>("@minecraft/Player")

const takeDamage = (
  player: Player,
  damage: Damage
): Effect.Effect<DomainEvent[], never, never> =>
  Effect.gen(function* () {
    return yield* Match.value(player.health.current <= damage.amount).pipe(
      Match.when(
        true,
        () => Effect.succeed([PlayerDeathEvent({
          playerId: player.id,
          deathTime: new Date(),
          cause: "damage"
        })])
      ),
      Match.when(
        false,
        () => {
          const newHealth = Health.subtract(player.health, damage.amount)
          return Effect.succeed([PlayerDamagedEvent({
            playerId: player.id,
            damage: damage.amount,
            remainingHealth: newHealth.current
          })])
        }
      ),
      Match.exhaustive
    )
  })
```

**ゲーム開発での課題**:
- **パフォーマンス**: オブジェクト指向は cache miss が多発
- **メモリ効率**: 小さなオブジェクトが断片化を引き起こす
- **並行処理**: ロック競合による性能低下

### ECS単体の限界

**Entity Component Systemの強み**:
```typescript
// ✅ Effect-TS関数型による効率的なデータレイアウト (Structure of Arrays)
interface PositionSystem {
  readonly positions: Float32Array   // x,y,z,x,y,z...
  readonly entities: Uint32Array     // entity_id, entity_id...
  readonly update: (deltaTime: number) => Effect.Effect<void, never, never>
}

const PositionSystem = Context.GenericTag<PositionSystem>("@minecraft/PositionSystem")

const makePositionSystem = (maxEntities: number): Effect.Effect<PositionSystem, never, never> =>
  Effect.gen(function* () {
    const positions = new Float32Array(maxEntities * 3)
    const entities = new Uint32Array(maxEntities)
    let entityCount = 0

    return PositionSystem.of({
      positions,
      entities,
      update: (deltaTime) => Effect.gen(function* () {
        // Stream.range による関数型 for ループの置き換え
        yield* Stream.range(0, entityCount).pipe(
          Stream.runForEach((i) => Effect.sync(() => {
            // SIMD最適化可能な連続メモリアクセス
            positions[i * 3 + 1] -= 9.8 * deltaTime // gravity
          }))
        )
      })
    })
  })
```

**ビジネスロジックでの課題**:
- **複雑なルール**: 複数コンポーネント間の整合性制御が困難
- **ドメイン知識の散逸**: ビジネスルールがシステム間に分散
- **テスタビリティ**: ドメインロジックの単体テストが困難

## 統合アーキテクチャの設計思想

### レイヤー構造による責務分離

```
┌─────────────────────────────────────┐
│         Domain Layer                │  ← DDD: ビジネスルール
│  (Aggregates, Entities, Services)   │
├─────────────────────────────────────┤
│       Application Layer             │  ← オーケストレーション
│     (Use Cases, Commands)           │
├─────────────────────────────────────┤
│      Infrastructure Layer           │  ← ECS: パフォーマンス最適化
│  (ECS Systems, Rendering, I/O)      │
└─────────────────────────────────────┘
```

### 境界づけられたコンテキストとECSの対応

**Game World Context**:
```typescript
// ドメイン層: ビジネスルール
export const PlayerDomain = {
  // 複雑なドメインロジック
  processPlayerAction: (
    player: Player,
    action: PlayerAction
  ): Effect.Effect<DomainEvent[], PlayerError, GameRules> =>
    Effect.gen(function* () {
      const rules = yield* GameRules

      // ドメイン知識に基づく検証
      yield* rules.validateAction(player, action)

      // ドメインイベントの生成
      return player.processAction(action)
    })
}

// ✅ Effect-TS関数型インフラ層: パフォーマンス最適化
interface PlayerECS {
  readonly updatePositions: (deltaTime: number) => Effect.Effect<void, never, never>
  readonly getEntityId: (playerId: PlayerId) => Effect.Effect<number, EntityNotFoundError, never>
  readonly addPlayer: (playerId: PlayerId) => Effect.Effect<number, EntityLimitError, never>
}

const PlayerECS = Context.GenericTag<PlayerECS>("@minecraft/PlayerECS")

const EntityNotFoundError = Schema.TaggedError("EntityNotFoundError")({
  playerId: PlayerId
})

const EntityLimitError = Schema.TaggedError("EntityLimitError")({
  currentCount: Schema.Number,
  maxCount: Schema.Number
})

const makePlayerECS = (maxPlayers: number): Effect.Effect<PlayerECS, never, never> =>
  Effect.gen(function* () {
    // 効率的なデータストレージ
    const positions = new Float32Array(maxPlayers * 3)
    const velocities = new Float32Array(maxPlayers * 3)
    const healths = new Uint16Array(maxPlayers)
    const entityMapRef = yield* Ref.make(new Map<PlayerId, number>())
    const activeCountRef = yield* Ref.make(0)

    return PlayerECS.of({
      updatePositions: (deltaTime) => Effect.gen(function* () {
        const activeCount = yield* Ref.get(activeCountRef)

        // Stream による関数型バッチ処理
        yield* Stream.range(0, activeCount).pipe(
          Stream.runForEach((i) => Effect.sync(() => {
            const baseIdx = i * 3
            // SIMD最適化可能な実装
            positions[baseIdx] += velocities[baseIdx] * deltaTime
            positions[baseIdx + 1] += velocities[baseIdx + 1] * deltaTime
            positions[baseIdx + 2] += velocities[baseIdx + 2] * deltaTime
          }))
        )
      }),

      getEntityId: (playerId) => Effect.gen(function* () {
        const entityMap = yield* Ref.get(entityMapRef)

        return yield* Match.value(entityMap.get(playerId)).pipe(
          Match.when(
            (id): id is number => id !== undefined,
            (id) => Effect.succeed(id)
          ),
          Match.orElse(() =>
            Effect.fail(EntityNotFoundError({ playerId }))
          )
        )
      }),

      addPlayer: (playerId) => Effect.gen(function* () {
        const activeCount = yield* Ref.get(activeCountRef)

        return yield* Match.value(activeCount >= maxPlayers).pipe(
          Match.when(
            true,
            () => Effect.fail(EntityLimitError({
              currentCount: activeCount,
              maxCount: maxPlayers
            }))
          ),
          Match.when(
            false,
            () => Effect.gen(function* () {
              yield* Ref.update(entityMapRef, (map) => new Map(map).set(playerId, activeCount))
              yield* Ref.update(activeCountRef, (count) => count + 1)
              return activeCount
            })
          ),
          Match.exhaustive
        )
      })
    })
  })
```

## 統合パターンの実装戦略

### 1. ドメインイベント駆動統合

**ドメイン層でのイベント生成**:
```typescript
export const takeDamage = (
  playerId: PlayerId,
  damage: Damage
): Effect.Effect<PlayerDamaged[], PlayerError, PlayerRepository> =>
  Effect.gen(function* () {
    const repo = yield* PlayerRepository
    const player = yield* repo.findById(playerId)

    // ドメインロジック
    const newHealth = Health.subtract(player.health, damage.amount)
    const updatedPlayer = { ...player, health: newHealth }

    yield* repo.save(updatedPlayer)

    // ドメインイベント
    return [PlayerDamaged.create({
      playerId,
      previousHealth: player.health,
      currentHealth: newHealth,
      damageAmount: damage.amount
    })]
  })
```

**ECS層でのイベント処理**:
```typescript
export const PlayerHealthSystem = {
  handlePlayerDamaged: (
    event: PlayerDamaged
  ): Effect.Effect<void, SystemError, ECSWorld> =>
    Effect.gen(function* () {
      const world = yield* ECSWorld
      const entityId = yield* world.getEntityId(event.playerId)

      // ECSコンポーネントの更新
      yield* world.updateComponent(entityId, "Health", {
        current: event.currentHealth.value,
        maximum: event.currentHealth.maximum
      })

      // Match.value によるビジュアルエフェクトの適用
      yield* Match.value(event.currentHealth.value <= 0).pipe(
        Match.when(
          true,
          () => world.addComponent(entityId, "DeathAnimation", {
            startTime: Date.now(),
            duration: 2000
          })
        ),
        Match.when(
          false,
          () => Effect.succeed(void 0)
        ),
        Match.exhaustive
      )
    })
}
```

### 2. Query Object パターン

**ドメインクエリの定義**:
```typescript
export interface PlayerQueries {
  findPlayersInArea: (area: Area) => Effect.Effect<Player[], QueryError, never>
  findPlayersByHealth: (condition: HealthCondition) => Effect.Effect<Player[], QueryError, never>
  getPlayerInventory: (playerId: PlayerId) => Effect.Effect<Inventory, QueryError, never>
}
```

**ECS最適化クエリの実装**:
```typescript
export const PlayerQueriesLive: Layer.Layer<PlayerQueries, never, ECSWorld> =
  Layer.effect(
    PlayerQueries,
    Effect.gen(function* () {
      const world = yield* ECSWorld

      return PlayerQueries.of({
        findPlayersInArea: (area) =>
          Effect.gen(function* () {
            // 空間分割による高速検索
            const spatialIndex = yield* world.getSpatialIndex()
            const entityIds = yield* spatialIndex.query(area)

            // バッチ取得による効率化
            const players = yield* Effect.forEach(
              entityIds,
              (id) => world.getPlayer(id),
              { concurrency: "unbounded" }
            )

            return players
          })
      })
    })
  )
```

### 3. Aggregate ↔ ECS 同期パターン

**Aggregate状態の永続化**:
```typescript
export const PlayerAggregate = Schema.Struct({
  id: PlayerId,
  health: Health,
  position: Position,
  inventory: Inventory,
  version: Schema.Number // オプティミスティックロック用
})

export const synchronizePlayerToECS = (
  player: typeof PlayerAggregate.Type
): Effect.Effect<void, SyncError, ECSWorld> =>
  Effect.gen(function* () {
    const world = yield* ECSWorld
    const entityId = yield* world.getOrCreateEntity(player.id)

    // コンポーネント単位の同期
    yield* Effect.all([
      world.setComponent(entityId, "Health", {
        current: player.health.current,
        maximum: player.health.maximum
      }),
      world.setComponent(entityId, "Position", {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z
      }),
      world.setComponent(entityId, "Inventory", {
        items: player.inventory.items.map(item => ({
          id: item.id,
          quantity: item.quantity,
          slot: item.slot
        }))
      })
    ], { concurrency: "unbounded" })
  })
```

## パフォーマンス最適化戦略

### 1. 遅延同期パターン

```typescript
export const PlayerSyncManager = {
  // ドメイン変更の蓄積
  private pendingChanges: Map<PlayerId, DomainEvent[]> = new Map(),

  // フレーム終了時に一括同期
  flushChanges: (): Effect.Effect<void, SyncError, ECSWorld> =>
    Effect.gen(function* () {
      const world = yield* ECSWorld

      yield* Effect.forEach(
        Array.from(this.pendingChanges.entries()),
        ([playerId, events]) => this.syncPlayerEvents(playerId, events),
        { concurrency: 8 } // 適度な並行数
      )

      this.pendingChanges.clear()
    })
}
```

### 2. 読み取り専用プロジェクション

```typescript
// ECS最適化された読み取り専用ビュー
export interface PlayerProjection {
  readonly id: PlayerId
  readonly health: number
  readonly position: { x: number, y: number, z: number }
  readonly isDead: boolean
  readonly lastUpdated: number
}

export const createPlayerProjection = (
  components: PlayerComponents
): PlayerProjection => ({
  id: PlayerId(components.id),
  health: components.health.current,
  position: components.position,
  isDead: components.health.current <= 0,
  lastUpdated: components.metadata.lastUpdated
})
```

## テスト戦略

### ドメインロジックのテスト

```typescript
describe("Player Domain", () => {
  it("should generate death event when health reaches zero", () => {
    const player = Player.create({
      id: PlayerId("test-player"),
      health: Health.create(10),
      position: Position.origin()
    })

    const events = player.takeDamage(Damage.create(15))

    expect(events).toContainEqual(
      expect.objectContaining({
        _tag: "PlayerDeathEvent"
      })
    )
  })
})
```

### 統合テスト

```typescript
describe("Player Domain-ECS Integration", () => {
  it("should sync domain changes to ECS", async () => {
    const testLayer = Layer.mergeAll(
      TestECSWorld.Live,
      TestPlayerRepository.Live,
      TestEventBus.Live
    )

    const test = Effect.gen(function* () {
      // ドメイン操作
      yield* takeDamage(PlayerId("test"), Damage.create(5))

      // ECS状態の確認
      const ecsWorld = yield* ECSWorld
      const healthComponent = yield* ecsWorld.getComponent("test", "Health")

      expect(healthComponent.current).toBe(5)
    })

    await Effect.runPromise(test.pipe(Effect.provide(testLayer)))
  })
})
```

## 実装上の注意点

### 1. データ一貫性の管理

```typescript
// バージョン管理による楽観的ロック
const updatePlayerWithVersion = (
  player: Player,
  expectedVersion: number
): Effect.Effect<Player, ConcurrencyError, PlayerRepository> =>
  Effect.gen(function* () {
    const repo = yield* PlayerRepository
    const current = yield* repo.findById(player.id)

    yield* Match.value(current.version !== expectedVersion).pipe(
      Match.when(
        true,
        () => Effect.fail(
          ConcurrencyError.create("Version mismatch")
        )
      ),
      Match.when(
        false,
        () => Effect.succeed(void 0)
      ),
      Match.exhaustive
    )

    const updated = { ...player, version: expectedVersion + 1 }
    yield* repo.save(updated)
    return updated
  })
```

### 2. メモリ効率の維持

```typescript
// ✅ Effect-TS関数型プールオブジェクトによるGC圧迫回避
interface ComponentPool<T> {
  readonly acquire: () => Effect.Effect<T, never, never>
  readonly release: (component: T) => Effect.Effect<void, never, never>
}

const ComponentPool = <T>() => Context.GenericTag<ComponentPool<T>>("@minecraft/ComponentPool")

const makeComponentPool = <T>(
  factory: () => T,
  resetComponent: (component: T) => void,
  maxSize = 1000
): Effect.Effect<ComponentPool<T>, never, never> =>
  Effect.gen(function* () {
    const availableRef = yield* Ref.make<T[]>([])

    return ComponentPool<T>().of({
      acquire: () => Effect.gen(function* () {
        const available = yield* Ref.get(availableRef)

        return yield* Match.value(available.length > 0).pipe(
          Match.when(
            true,
            () => Effect.gen(function* () {
              const [component, ...rest] = available
              yield* Ref.set(availableRef, rest)
              return component
            })
          ),
          Match.when(
            false,
            () => Effect.sync(() => factory())
          ),
          Match.exhaustive
        )
      }),

      release: (component) => Effect.gen(function* () {
        const available = yield* Ref.get(availableRef)

        // リセット処理
        yield* Effect.sync(() => resetComponent(component))

        // プールサイズ制限付きでリリース
        yield* Match.value(available.length < maxSize).pipe(
          Match.when(
            true,
            () => Ref.update(availableRef, (pool) => [...pool, component])
          ),
          Match.when(
            false,
            () => Effect.succeed(void 0) // プール満杯時は破棄
          ),
          Match.exhaustive
        )
      })
    })
  })
```

## 結論

DDD+ECS統合アーキテクチャにより実現される価値：

1. **ドメインの複雑性**: DDDによる適切な抽象化
2. **実行効率性**: ECSによる最適化
3. **テスタビリティ**: レイヤー分離による単体テスト
4. **保守性**: 責務分離による変更容易性

この統合パターンは、ゲーム開発における「ビジネスロジックの複雑性」と「パフォーマンス要求」という相反する要求を、アーキテクチャレベルで解決する革新的なアプローチなのです。