> **Summary**
> このドキュメントは、本プロジェクトのコアアーキテクチャであるEntity Component System (ECS)とDomain-Driven Design (DDD)、Effect-TSの統合モデルについて解説します。Entity, Component, Archetype, Query, System, Worldの各要素がDDDレイヤーでどのように配置され、データ指向設計と関数型プログラミング、ドメイン駆動設計を三位一体で実現しているかを説明します。

# ECS with DDD Architecture and Effect-TS

本プロジェクトのアーキテクチャは、**Entity Component System (ECS)** パターンを **Domain-Driven Design (DDD)** アーキテクチャと統合し、関数型プログラミングライブラリである **[Effect-TS](https://effect.website/)** で実装した革新的なモデルです。これにより、データ指向設計のパフォーマンス、DDDのビジネスロジック表現力、Effect-TSの堅牢性を同時に実現しています。

このアーキテクチャは、DDD層構造の中でECSの6つの要素が明確に配置されています。

- **[Entity (エンティティ)](#entity-エンティティ)**: ドメイン層でビジネス概念として定義される識別子
- **[Component (コンポーネント)](#component-コンポーネント)**: ドメイン層の純粋なデータ表現
- **[Archetype (アーキタイプ)](#archetype-アーキタイプ)**: アプリケーション層のエンティティ生成パターン
- **[Query (クエリ)](#query-クエリ)**: アプリケーション層の効率的なデータ取得仕組み
- **[System (システム)](#system-システム)**: アプリケーション層のビジネスワークフロー
- **[World (ワールド)](#world-ワールド)**: ドメイン層のAggregate Rootとして機能する中央管理者

---

## Entity (エンティティ)

- **定義**: ゲーム内に存在する「モノ」を一意に識別するためのIDです。
- **実装**: `src/domain/entity.ts` で定義されており、`string` 型に `EntityId` というブランドを付けた `Brand.Brand<'EntityId'>` 型として表現されます。これにより、ただの文字列がエンティティIDとして誤って使われることを防ぎます。エンティティ自体は状態を持たず、単なる識別子です。

---

## Component (コンポーネント)

- **定義**: エンティティの特性や状態を表す、純粋なデータコンテナです。例えば、「位置」を表す `Position` コンポーネントや、「速度」を表す `Velocity` コンポーネントなどがあります。コンポーネントはロジック（メソッド）を持ちません。
- **実装**: `src/domain/components.ts` に集約されています。コンポーネントは `@effect/schema` の `S.Struct` を用いて定義されます。
  - **型安全性と不変性**: `Schema` から生成される型はデフォルトでプロパティが `readonly` となるため、意図しない変更が防止されます。
  - **ランタイムスキーマ**: 各コンポーネントは自身のスキーマ情報を保持しており、セーブ/ロード機能で安全なシリアライズを実現します。

```typescript
// src/domain/components.ts
import * as S from 'effect/Schema'
import { Float } from './common'

export const Position = S.Struct({
  x: Float,
  y: Float,
  z: Float,
})
export type Position = S.Schema.Type<typeof Position>
```

---

## Archetype (アーキタイプ)

- **定義**: 特定のコンポーネントの組み合わせを持つエンティティを生成するためのテンプレート（雛形）です。
- **実装**: `src/domain/archetypes.ts` で定義されています。`createPlayer`, `createBlock` のようなファクトリ関数を通じて利用されます。これにより、エンティティの構成がカプセル化され、一貫性が保たれます。

```typescript
// src/domain/archetypes.ts
export const createArchetype = (builder: ArchetypeBuilder): Effect.Effect<Archetype> => {
  // ...
}
```

---

## Query (クエリ)

- **定義**: 「`Position` と `Velocity` を持ち、かつ `Frozen` を持たないエンティティ」のように、特定の条件に合致するエンティティの集合を効率的に検索するための定義です。
- **実装**: `src/domain/queries.ts` で一元管理されています。システムはこれらのクエリを `World` サービスに渡すことで、目的のエンティティ群を高速に取得します。

```typescript
// src/domain/queries.ts
export const playerMovementQuery: Query = createQuery({
  all: [Player, InputState, Velocity, CameraState],
})
```

---

## System (システム)

- **定義**: ゲームのロジックを実装する部分です。クエリを使ってエンティティの集合を取得し、それらのコンポーネントを読み書きしてゲームの状態を更新します。
- **実装**: 各システムは `Effect.Effect<void, E, R>` 型の `Effect` プログラムとして実装されます。
  - **`void`**: システムは通常、値を返さず、`World` の状態変更という副作用を引き起こすことが目的のため、成功時の型は `void` です。
  - **`E` (Error)**: システムが失敗する可能性のあるエラーの型。
  - **`R` (Context/Requirements)**: `World` サービスや `InputManager` など、システムが実行に必要とする依存関係（サービス）の型。これにより、依存関係が型レベルで明確になります。
  - **宣言的なロジック**: `Effect.gen` (do記法) を用いることで、非同期処理やエラー処理を含む複雑なロジックを、同期的で直線的なコードのように記述できます。

```typescript
// src/systems/player-movement.ts (概念コード)
import { Effect } from 'effect'
import { playerMovementQuery } from '@/application/queries'
import { World } from '@/domain/world'
import { InputManager } from '@/infrastructure/input-browser'
import { PLAYER_SPEED } from '@/domain/world-constants'

export const playerMovementSystem = Effect.gen(function* (_) {
  // 1. DI: 必要なサービスをコンテキスト(`R`)から安全に取得
  const world = yield* _(World)
  const input = yield* _(InputManager)

  // 2. クエリ: 対象エンティティのコンポーネントをSoA形式で取得
  const { entities, components } = yield* _(world.querySoA(playerMovementQuery))

  // 3. ロジック: 状態を読み取り、新しい状態を書き込む
  for (let i = 0; i < entities.length; i++) {
    if (components.inputState.forward[i]) {
      components.velocity.dz[i] = -PLAYER_SPEED
    }
  }
})
```

---

## World (ワールド)

`World` は、すべてのエンティティとコンポーネントの状態を一元管理するサービスです。本プロジェクトの `World` は、パフォーマンスを最大化するために **Archetype** と **Structure of Arrays (SoA)** アーキテクチャを組み合わせて採用しています。

この設計により、CPUキャッシュのヒット率が劇的に向上し（**データ局所性**）、クエリやイテレーションが大幅に高速化されます。また、`world.querySoA()` APIを通じて内部ストレージへの直接参照を取得することで、GC負荷の原因となる中間オブジェクトを一切生成することなく、データを効率的に読み書きできます。

詳細は **[World内部設計 (World Architecture)](./world-performance.md)** のドキュメントを参照してください。

---

## システムの実行順序

各システムは独立したロジックの単位ですが、ゲーム全体として正しく動作するためには、それらを特定の順序で実行する必要があります（例: `入力受付` → `物理演算` → `レンダリング`）。

本プロジェクトでは、`src/main.ts` 内でシステムの実行順序を静的な配列として定義しています。

```typescript
// src/main.ts
const systems = [
  inputPollingSystem,
  playerMovementSystem,
  physicsSystem,
  collisionSystem,
  // ... other systems
]

yield * _(gameLoop(systems))
```

これにより、フレームごとにどのシステムがどの順番で実行されるかが明確に制御されます。詳細は **[システムスケジューラ](./system-scheduler.md)** のドキュメントを参照してください。

---

## DDD層構造におけるECS配置

本プロジェクトでは、ECSの各要素がDDDの層構造に明確に配置されています。これにより、ビジネスロジックの整理とパフォーマンスの両立を実現しています。

### Domain Layer (ドメイン層)

#### Entity ID とビジネスエンティティ

```typescript
// src/domain/entities/entity.entity.ts
export type EntityId = string & Brand.Brand<'EntityId'>
export const EntityId = Brand.nominal<EntityId>()

// ビジネスエンティティはData.Classで定義
export class Player extends Data.Class<{
  readonly id: EntityId
  readonly name: string
}> {
  static readonly schema = S.Struct({
    id: EntityIdSchema,
    name: S.String.pipe(S.minLength(1)),
  })
}
```

#### Component Schema定義

```typescript
// src/domain/entities/components/physics/physics-components.ts
export const Position = S.Struct({
  x: S.Number.pipe(S.finite()),
  y: S.Number.pipe(S.between(0, 255)),
  z: S.Number.pipe(S.finite()),
})
export type Position = S.Schema.Type<typeof Position>

export const Velocity = S.Struct({
  dx: S.Number.pipe(S.finite()),
  dy: S.Number.pipe(S.finite()),
  dz: S.Number.pipe(S.finite()),
})
export type Velocity = S.Schema.Type<typeof Velocity>
```

#### World as Aggregate Root

```typescript
// src/domain/entities/world.entity.ts
export class World extends Data.Class<{
  readonly seed: number
  readonly loadedChunks: ReadonlyMap<string, Chunk>
  readonly entities: ReadonlySet<EntityId>
}> {
  // Aggregateとしてのビジネスルール
  canPlaceBlock(position: Position, blockType: BlockType): boolean {
    // ドメインルールの実装
    if (position.y === 0) return false // 岩盤層には設置不可
    return true
  }

  // 整合性を保つメソッド
  addEntity(entity: EntityId): Effect.Effect<World, EntityError> {
    return Effect.gen(function* () {
      if (this.entities.has(entity)) {
        return yield* Effect.fail(new EntityAlreadyExistsError({ entity }))
      }

      return new World({
        ...this,
        entities: new Set([...this.entities, entity]),
      })
    })
  }
}
```

### Application Layer (アプリケーション層)

#### クエリシステム

```typescript
// src/application/queries/queries.ts
export const movableEntitiesQuery = createQuery({
  all: [Position, Velocity],
  none: [Frozen],
})

export const renderableEntitiesQuery = createQuery({
  all: [Position, Mesh],
  any: [Visible, AlwaysRender],
})
```

#### Archetypeパターン

```typescript
// src/application/use-cases/entity-creation.use-case.ts
export const createPlayerUseCase = (name: string, spawnPosition: Position): Effect.Effect<EntityId, PlayerCreationError, WorldService | EntityService> =>
  Effect.gen(function* () {
    const world = yield* WorldService
    const entityService = yield* EntityService

    // ドメインエンティティの作成
    const player = new Player({
      id: EntityId(crypto.randomUUID()),
      name,
    })

    // ECSエンティティとコンポーネントの作成
    const entityId = yield* entityService.createEntity()
    yield* entityService.addComponent(entityId, 'position', spawnPosition)
    yield* entityService.addComponent(entityId, 'player', player)
    yield* entityService.addComponent(entityId, 'health', { current: 100, max: 100 })

    // Worldに追加
    yield* world.addEntity(entityId)

    return entityId
  })
```

#### システム as ワークフロー

```typescript
// src/application/workflows/player-movement.ts
export const playerMovementWorkflow = Effect.gen(function* () {
  const world = yield* WorldService
  const physics = yield* PhysicsService
  const input = yield* InputService

  // クエリによるエンティティ取得
  const { entities, components } = yield* world.querySoA(movableEntitiesQuery)

  // ビジネスロジックの適用
  for (let i = 0; i < entities.length; i++) {
    const inputState = components.input[i]
    const currentPos = components.position[i]

    // ドメインサービスによる移動計算
    const newVelocity = yield* physics.calculateMovement(inputState)
    const newPosition = yield* physics.applyMovement(currentPos, newVelocity)

    // 整合性チェック
    const canMove = yield* world.validateMovement(entities[i], newPosition)

    if (canMove) {
      components.position[i] = newPosition
      components.velocity[i] = newVelocity
    }
  }
})
```

### Infrastructure Layer (インフラ層)

#### ワールドリポジトリ実装

```typescript
// src/infrastructure/repositories/world.repository.ts
export const worldRepositoryLive = Layer.effect(
  WorldRepository,
  Effect.gen(function* () {
    const storage = yield* StorageService

    return WorldRepository.of({
      save: (world) =>
        Effect.gen(function* () {
          // ECSデータのシリアライゼーション
          const worldData = {
            seed: world.seed,
            chunks: Array.from(world.loadedChunks.entries()),
            entities: Array.from(world.entities),
          }

          yield* storage.write('world.json', JSON.stringify(worldData))
        }),

      load: () =>
        Effect.gen(function* () {
          const data = yield* storage.read('world.json')
          const worldData = JSON.parse(data)

          return new World({
            seed: worldData.seed,
            loadedChunks: new Map(worldData.chunks),
            entities: new Set(worldData.entities),
          })
        }),
    })
  }),
)
```

### Presentation Layer (プレゼンテーション層)

#### コントローラー

```typescript
// src/presentation/controllers/game.controller.ts
export const gameController = Effect.gen(function* () {
  const playerMovement = yield* PlayerMovementUseCase
  const blockPlacement = yield* BlockPlacementUseCase

  return {
    handlePlayerInput: (input: PlayerInput) =>
      Match.value(input.type).pipe(
        Match.when('move', () => playerMovement(input.playerId, input.direction)),
        Match.when('place', () => blockPlacement(input.playerId, input.position, input.blockType)),
        Match.orElse(() => Effect.unit),
      ),
  }
})
```

## DDD + ECS統合のメリット

### 1. 明確な責任分界

- **Domain Layer**: ビジネスルールとエンティティの定義
- **Application Layer**: ユースケースとECSシステムの実装
- **Infrastructure Layer**: データ永続化とパフォーマンス最適化
- **Presentation Layer**: ユーザーインターフェース

### 2. テスタビリティ

```typescript
// ドメインロジックのテスト
describe('World Business Logic', () => {
  it.effect('should prevent block placement at bedrock level', () =>
    Effect.gen(function* () {
      const world = createTestWorld()
      const canPlace = world.canPlaceBlock(new Position({ x: 10, y: 0, z: 10 }), BlockType.Stone)
      expect(canPlace).toBe(false)
    }),
  )
})

// アプリケーションワークフローのテスト
describe('Player Movement Workflow', () => {
  it.effect('should move player when input is valid', () =>
    Effect.gen(function* () {
      const workflow = yield* PlayerMovementWorkflow
      const initialPosition = yield* getPlayerPosition('player1')

      yield* workflow()

      const newPosition = yield* getPlayerPosition('player1')
      expect(newPosition).not.toEqual(initialPosition)
    }).pipe(Effect.provide(TestApplicationLayer)),
  )
})
```

### 3. パフォーマンス最適化

- **SoA (Structure of Arrays)**: キャッシュ効率の最適化
- **Query最適化**: 事前計算されたインデックスによる高速検索
- **Layer分離**: 必要な部分のみの更新

### 4. 拡張性

新しいコンポーネントやシステムの追加が各層で独立して可能：

```typescript
// 新しいコンポーネント追加（Domain Layer）
export const MagicPower = S.Struct({
  mana: S.Number.pipe(S.between(0, 1000)),
  spells: S.Array(SpellSchema),
})

// 新しいシステム追加（Application Layer）
export const magicSystem = Effect.gen(function* () {
  const world = yield* WorldService
  const { entities, components } = yield* world.querySoA(magicQuery)

  // 魔法システムのロジック
})

// 新しいアダプター追加（Infrastructure Layer）
export const magicEffectRendererLive = Layer.effect(
  MagicEffectRenderer,
  Effect.gen(function* () {
    // 魔法エフェクトのレンダリング実装
  }),
)
```

## まとめ

DDD + ECS + Effect-TSの統合により、以下を同時に実現：

1. **ビジネスロジックの明確性**: DDDによる適切な関心事の分離
2. **高いパフォーマンス**: ECSによるデータ指向設計
3. **型安全性**: Effect-TSによる包括的な型システム
4. **テスタビリティ**: 純粋関数による予測可能なテスト
5. **保守性**: 明確な層構造による変更の局所化

この統合アーキテクチャは、複雑なゲームエンジンを構築する際の強力な基盤を提供します。
