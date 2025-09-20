---
title: 'Effect-TS 3.17+ 基礎マスター - 実践的コアパターン習得'
description: 'Effect.gen、Schema.Struct、Context.GenericTagを使った実践的パターン学習。リアルタイム実行環境で即座に理解できるハンズオン形式のEffect-TS入門。'
category: 'tutorial'
difficulty: 'intermediate'
tags: ['effect-ts', 'fundamentals', 'schema-struct', 'effect-gen', 'context-generic-tag', 'hands-on']
prerequisites: ['typescript-intermediate', 'functional-programming-basics']
estimated_reading_time: '20分'
---

# Effect-TS 基本概念

> 📚 **最新ライブラリドキュメント**: Effect-TSの最新APIドキュメントとコード例はContext7で参照可能です。
>
> ```bash
> # Context7で最新のEffect-TSドキュメントを参照
> # Library ID: /effect/effect
> ```

## 🎆 Zero-Wait Learning Experience

**⚙️ 学習時間2**: 30分 | **🔄 進捗フロー**: [15分 Quick Start] → **[30分 Effect-TS基礎]** → [45分 アーキテクチャ] → [60分 実装] → [15分 デプロイ]

> 📍 **Navigation**: ← [Quick Start](../../getting-started/README.md) | → [Services & DI](./effect-ts-services.md)

このドキュメントでは、TypeScript Minecraftプロジェクトにおける**Effect-TS 3.17+** の実践的なハンズオン学習を提供します。即座に実行・編集できる実例を通じて、コアパターンを体験的に習得できます。

> 📖 **関連ドキュメント**:
>
> - **理論的背景**: [関数型プログラミング哲学](../../explanations/design-patterns/functional-programming-philosophy.md)
> - **次のステップ**: [Effect-TS サービスパターン](./effect-ts-services.md) | [Effect-TS エラーハンドリング](./effect-ts-error-handling.md)
> - **最新APIリファレンス**: Context7で `/effect/effect` を参照

## 1. 基本思想: すべてはEffect

あらゆる副作用（ファイルI/O、ネットワーク、DOM操作、乱数生成、現在時刻の取得など）は `Effect` 型でカプセル化します。これにより、副作用を型シグネチャレベルで明示し、プログラムの予測可能性とテスト容易性を高めます。

### 🚀 実行可能サンプル: Effect基本パターン

以下のコードは即座に実行・編集できます。TypeScript Minecraftプロジェクトで実際に使用されているパターンです。

````typescript
// [LIVE_EXAMPLE: effect-basics]
// 🌟 LIVE CODE - このコードは即座に実行・編集可能です
// CodeSandbox: https://codesandbox.io/s/effect-ts-basics
// StackBlitz: https://stackblitz.com/edit/effect-ts-minecraft-basics
import { Effect, Schema, Console } from "@effect/platform"

// 📚 Schema定義の詳細は Schema API リファレンス を参照
// → https://docs/reference/api/effect-ts-schema-api.md#11-統合パターンライブラリ

// 1. 学習用の簡易PlayerSchema（実際のプロジェクトでは上記リファレンスを使用）
const LearningPlayerSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  health: Schema.Number
})

type LearningPlayer = Schema.Schema.Type<typeof LearningPlayerSchema>

// 2. Effect.genパターン学習（標準パターンは上記リファレンスを参照）
const createPlayerForLearning = (name: string) =>
  Effect.gen(function* () {
    yield* Console.log(`Creating player: ${name}`)

    const player: LearningPlayer = {
      id: crypto.randomUUID(),
      name,
      position: { x: 0, y: 64, z: 0 },
      health: 20
    }

    // 実際のプロジェクトでは StandardPlayerSchema を使用
    const validatedPlayer = yield* Schema.decode(LearningPlayerSchema)(player)
    yield* Console.log(`Player created: ${JSON.stringify(validatedPlayer)}`)

    return validatedPlayer
  })

// 3. 学習用実行例
const learningProgram = Effect.gen(function* () {
  const steve = yield* createPlayerForLearning("Steve")
  const alex = yield* createPlayerForLearning("Alex")

  yield* Console.log(`Tutorial completed: 2 players created`)
  return [steve, alex]
})

// 🎮 実行してみてください！
// Effect.runSync(learningProgram)
// [/LIVE_EXAMPLE]

**💡 Interactive Challenge**: 上記コードで player の health を負の値に変更して、バリデーションエラーを確認してみましょう。

**🎯 Learning Outcomes Tracker**:
- [x] `Effect.gen` による副作用の合成パターン
- [x] `Schema.Struct` による実行時型検証
- [x] `yield*` による Effect の線形実行
- [x] 型安全性とランタイム安全性の両立

**⏱️ Completion Time**: 5分 | **🔄 Progress**: 25% of Effect-TS Fundamentals

### 1.1 Effect-TSアーキテクチャ概観

以下の図は、Effect-TS 3.17+パターンによる純粋関数型プログラミングアーキテクチャを示しています。

```mermaid
%%{init: {"theme": "neutral", "themeVariables": {"primaryColor": "#4285f4", "primaryTextColor": "#ffffff", "primaryBorderColor": "#ffffff", "lineColor": "#4285f4", "sectionBkgColor": "#f5f7fa", "tertiaryColor": "#f5f7fa"}}}%%
graph TB
    subgraph EffectCore ["Effect コア抽象化"]
        subgraph DataLayer ["データ層 - Schema駆動"]
            SchemaStruct["Schema.Struct<br/>📋 データ定義<br/>型安全・バリデーション"]
            BrandTypes["Brand Types<br/>🏷️ 型安全性強化<br/>PlayerId, EntityId"]
            ValidationLayer["Validation Layer<br/>✅ 実行時検証<br/>decode・encode"]
        end

        subgraph EffectLayer ["Effect管理層"]
            EffectGen["Effect.gen<br/>🔄 合成パターン<br/>yield* + 線形フロー"]
            ErrorHandling["Error Handling<br/>❌ 型安全エラー<br/>catchTag・fail"]
            ResourceMgmt["Resource Management<br/>🔧 リソース管理<br/>acquire・release"]
        end

        subgraph ServiceLayer ["サービス層"]
            ContextTag["Context.Tag<br/>🏢 サービス定義<br/>class extends Context.Tag"]
            LayerSystem["Layer System<br/>🧱 依存性注入<br/>Layer.effect・provide"]
            ServiceComposition["Service Composition<br/>🔗 合成・組み立て<br/>pipe・compose"]
        end
    end

    subgraph PatternLayer ["パターン適用層"]
        subgraph MatchingLayer ["パターンマッチング"]
            MatchValue["Match.value<br/>🎯 安全なマッチング<br/>網羅性チェック"]
            TaggedUnions["Tagged Unions<br/>📝 判別可能合併型<br/>_tag ベース"]
        end

        subgraph FunctionalLayer ["関数型パターン"]
            PureFunctions["Pure Functions<br/>🧮 純粋関数<br/>副作用分離"]
            ImmutableData["Immutable Data<br/>📚 不変データ<br/>ReadonlyArray・HashMap"]
            EarlyReturn["Early Return<br/>⚡ 早期リターン<br/>ガード節・フェイルファスト"]
        end
    end

    SchemaStruct --> ValidationLayer
    ValidationLayer --> BrandTypes
    BrandTypes --> EffectGen

    EffectGen --> ErrorHandling
    ErrorHandling --> ResourceMgmt
    ResourceMgmt --> ContextTag

    ContextTag --> LayerSystem
    LayerSystem --> ServiceComposition

    ServiceComposition --> MatchValue
    MatchValue --> TaggedUnions
    TaggedUnions --> PureFunctions

    PureFunctions --> ImmutableData
    ImmutableData --> EarlyReturn

    classDef dataStyle fill:#e3f2fd,stroke:#1976d2,stroke-width:2px,color:#0d47a1
    classDef effectStyle fill:#e8f5e8,stroke:#388e3c,stroke-width:2px,color:#1b5e20
    classDef serviceStyle fill:#fff3e0,stroke:#f57c00,stroke-width:2px,color:#e65100
    classDef patternStyle fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#4a148c
    classDef functionalStyle fill:#fce4ec,stroke:#c2185b,stroke-width:2px,color:#880e4f

    class SchemaStruct,BrandTypes,ValidationLayer dataStyle
    class EffectGen,ErrorHandling,ResourceMgmt effectStyle
    class ContextTag,LayerSystem,ServiceComposition serviceStyle
    class MatchValue,TaggedUnions patternStyle
    class PureFunctions,ImmutableData,EarlyReturn functionalStyle
````

### 1.2 Effect-TSデータフロー

以下は、典型的なEffect-TSアプリケーションにおけるデータの流れを示しています。すべての副作用がEffect型で管理され、型安全な合成が実現されています。

```mermaid
%%{init: {"theme": "neutral", "themeVariables": {"primaryColor": "#4285f4", "primaryTextColor": "#ffffff", "primaryBorderColor": "#ffffff", "lineColor": "#4285f4", "sectionBkgColor": "#f5f7fa", "tertiaryColor": "#f5f7fa"}}}%%
sequenceDiagram
    participant Client as クライアント
    participant Schema as Schema層
    participant Effect as Effect層
    participant Service as サービス層
    participant Resource as リソース層

    Client->>Schema: 1. 生データ入力
    Schema->>Schema: 2. バリデーション<br/>decode・型検証
    alt バリデーション成功
        Schema->>Effect: 3. 型安全データ
        Effect->>Effect: 4. Effect.gen<br/>yield* 合成
        Effect->>Service: 5. サービス呼び出し<br/>Context.Tag
        Service->>Resource: 6. リソースアクセス<br/>Layer.effect
        Resource-->>Service: 7. 結果・エラー
        Service-->>Effect: 8. Effect型レスポンス
        Effect->>Effect: 9. エラーハンドリング<br/>catchTag・Match
        Effect-->>Schema: 10. 型安全結果
        Schema-->>Client: 11. エンコード済みレスポンス
    else バリデーション失敗
        Schema-->>Client: Schema.ParseError
    end

    Note over Schema,Resource: すべての操作がEffect型で管理される
    Note over Effect: 副作用の明示・テスト可能性
    Note over Service,Resource: 依存性注入・モック可能性
```

## 2. コアパターン

### 2.1. `Effect.gen` + `yield*` による合成（最新推奨）

**Effect-TS 3.17+ 最新パターン**: `Effect.gen` と `yield*` を使用した線形な処理フローが推奨されます。これにより、非同期処理を同期的に記述でき、可読性が向上します。

```typescript
// [LIVE_EXAMPLE: complex-operations]
// 🔄 Advanced Effect Composition - CodeSandbox Ready
import { Effect, Schema, Context, Stream, Match } from 'effect'

// ✅ 最新パターン（Effect.gen + yield* + Schema統合）
const complexOperation = Effect.gen(function* () {
  const config = yield* getConfig()

  // ✅ Schema検証付きデータ取得（最新API使用）
  const data = yield* fetchData(config.apiUrl).pipe(
    Effect.flatMap((raw) =>
      Effect.try({
        try: () => Schema.decodeUnknownSync(DataSchema)(raw),
        catch: (error) => new ValidationError({ cause: error, input: raw }),
      })
    )
  )

  const processed = yield* processData(data)
  yield* saveResult(processed)
  return processed
})
// [/LIVE_EXAMPLE]

// ✅ 早期リターンパターンと包括的エラーハンドリング
import { Match, pipe } from 'effect'

const operationWithErrorHandling = Effect.gen(function* () {
  const config = yield* getConfig()

  // ✅ Match.when による設定検証 - if文の完全な代替
  yield* pipe(
    Match.value(config.enabled),
    Match.when(false, () =>
      Effect.fail(
        Schema.encodeSync(ConfigError)({
          _tag: 'ConfigDisabledError',
          message: '設定が無効です',
        })
      )
    ),
    Match.orElse(() => Effect.succeed(undefined))
  )

  // ✅ 包括的エラー処理とフォールバック
  const data = yield* fetchData(config.apiUrl).pipe(
    Effect.catchTags({
      NetworkError: (error) =>
        Effect.gen(function* () {
          yield* Effect.log(`ネットワークエラー: ${error.message}, デフォルトデータを使用`)
          return defaultData
        }),
      TimeoutError: () =>
        Effect.gen(function* () {
          yield* Effect.log('タイムアウト: キャッシュデータを試行')
          return yield* getCachedData().pipe(Effect.orElse(() => Effect.succeed(defaultData)))
        }),
    })
  )

  return yield* processData(data)
})

// ✅ 高度な並列処理とバッチング
const parallelOperation = Effect.gen(function* () {
  // ✅ bindAllで並列実行とエラー処理
  const result = yield* Effect.Do.pipe(
    Effect.bind('timestamp', () => Effect.sync(() => Date.now())),
    Effect.bindAll(
      ({ timestamp }) => ({
        userData: fetchUserData().pipe(
          Effect.timeout('5 seconds'),
          Effect.retry(Schedule.exponential('100 millis', 2).pipe(Schedule.compose(Schedule.recurs(3))))
        ),
        configData: fetchConfigData(),
        settingsData: fetchSettingsData(),
      }),
      { concurrency: 'unbounded', mode: 'either' }
    ),
    Effect.tap(({ timestamp }) => Effect.log(`並列操作完了: ${Date.now() - timestamp}ms`))
  )

  // ✅ エラー結果の処理
  const userData = yield* Match.value(result.userData).pipe(
    Match.tag('Right', ({ right }) => Effect.succeed(right)),
    Match.tag('Left', ({ left }) =>
      Effect.gen(function* () {
        yield* Effect.log(`ユーザーデータ取得失敗: ${left}`)
        return yield* getDefaultUserData()
      })
    ),
    Match.exhaustive
  )

  return {
    userData,
    configData: result.configData,
    settingsData: result.settingsData,
    timestamp: result.timestamp,
  }
})
```

### 2.2. `Schema` による学習アプローチ

> 📚 **完全なSchema定義**: 本格的なPosition、Player、Service定義は [Schema API リファレンス](../../reference/api/effect-ts-schema-api.md#112-標準schema定義パターン) を参照してください。

チュートリアルでは、Schema.Structの**学習プロセス**に焦点を当てます：

```typescript
// [LIVE_EXAMPLE: schema-learning]
// 📋 Schema Learning Path - Interactive Tutorial
import { Schema, Brand, Effect } from 'effect'

// 🎯 学習ステップ1: 基本的なSchema構造の理解
const LearningPositionSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})

// 🎯 学習ステップ2: バリデーション追加の体験
const ValidatedPositionSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  y: Schema.Number.pipe(Schema.int(), Schema.between(-64, 320)),
  z: Schema.Number.pipe(Schema.int()),
})

// 🎯 学習ステップ3: Brand型による型安全性の理解
const LearningPlayerId = Schema.String.pipe(Schema.brand('PlayerId'))
type LearningPlayerId = Schema.Schema.Type<typeof LearningPlayerId>

// 🎯 学習ステップ4: 実行時バリデーションの体験
const validateAndCreatePosition = (input: unknown) =>
  Effect.gen(function* () {
    // バリデーション失敗を体験できる
    const position = yield* Schema.decodeUnknown(ValidatedPositionSchema)(input)

    yield* Effect.log(`Valid position created: ${JSON.stringify(position)}`)
    return position
  })

// 💡 学習練習: 次のデータでバリデーションを試してみよう
const testInputs = [
  { x: 10, y: 64, z: -50 }, // ✅ 正常
  { x: 10.5, y: 64, z: -50 }, // ❌ 整数以外
  { x: 10, y: -100, z: -50 }, // ❌ Y座標範囲外
  { x: '10', y: 64, z: -50 }, // ❌ 文字列
]

// 実際のプロジェクトではStandardPlayerSchemaを使用します
// （詳細は上記リファレンス参照）
```

// ✅ カスタムSchema変換
const Vector3 = Schema.transform(
Schema.Struct({
x: Schema.Number,
y: Schema.Number,
z: Schema.Number
}),
Position,
{
// decode: Vector3 -> Position
decode: (vector) => ({
x: Math.round(vector.x),
y: Math.round(vector.y),
z: Math.round(vector.z)
}),
// encode: Position -> Vector3
encode: (position) => ({
x: position.x,
y: position.y,
z: position.z
})
}
);
// [/LIVE_EXAMPLE]

````

### 2.3. `Match.value` によるパターンマッチング

`if/else` や `switch` 文の代わりに `Match.value` を使用します。これにより、網羅性チェックと型安全性が保証されます。

```typescript
// [LIVE_EXAMPLE: pattern-matching]
// 🎯 Type-Safe Pattern Matching - Interactive Examples
import { Match, Option, Either, Effect } from "effect";

// ✅ 基本的なパターンマッチング
const processDirection = (direction: Direction) =>
  Match.value(direction).pipe(
    Match.when("north", () => ({ x: 0, z: -1 })),
    Match.when("south", () => ({ x: 0, z: 1 })),
    Match.when("east", () => ({ x: 1, z: 0 })),
    Match.when("west", () => ({ x: -1, z: 0 })),
    Match.when("up", () => ({ x: 0, y: 1 })),
    Match.when("down", () => ({ x: 0, y: -1 })),
    Match.exhaustive  // コンパイル時に網羅性をチェック
  );
// [/LIVE_EXAMPLE]

// ✅ Option型との組み合わせ（最新Match.tags パターン）
const handleOptionalData = (data: Option.Option<string>) =>
  Match.value(data).pipe(
    Match.tags({
      Some: ({ value }) => Effect.succeed(`データ: ${value}`),
      None: () => Effect.fail(new Error("データが見つかりません"))
    })
  );

// ✅ Either型との組み合わせ（Match.tags 最新パターン）
const handleResult = <E, A>(result: Either.Either<E, A>) =>
  Match.value(result).pipe(
    Match.tags({
      Right: ({ right }) => Effect.succeed(right),
      Left: ({ left }) => Effect.fail(left)
    })
  );

// ✅ 複合的なパターンマッチング
const processGameInput = (input: GameInput) =>
  Match.value(input).pipe(
    Match.when(
      (i): i is KeyboardInput => i._tag === "KeyboardInput",
      (input) => handleKeyboardInput(input.key, input.modifiers)
    ),
    Match.when(
      (i): i is MouseInput => i._tag === "MouseInput",
      (input) => handleMouseInput(input.button, input.position)
    ),
    Match.when(
      (i): i is TouchInput => i._tag === "TouchInput",
      (input) => handleTouchInput(input.touches)
    ),
    Match.exhaustive
  );
````

### 2.4. 不変データ構造

すべてのデータ構造は不変（immutable）として扱います。Effect-TSの提供するデータ構造を活用します。

```typescript
import { HashMap, Array as Arr, Record, Schema } from 'effect'

// ✅ 不変コレクションの使用
const GameState = Schema.Struct({
  players: Schema.ReadonlyMap({
    key: Schema.String.pipe(Schema.brand('PlayerId')),
    value: PlayerSchema,
  }),
  blocks: Schema.ReadonlyMap({
    key: Schema.String.pipe(Schema.brand('BlockId')),
    value: BlockSchema,
  }),
  chunks: Schema.ReadonlyArray(ChunkSchema),
})
type GameState = Schema.Schema.Type<typeof GameState>

// ✅ 不変更新パターン
const updatePlayerPosition = (
  state: GameState,
  playerId: PlayerId,
  newPosition: Position
): Effect.Effect<GameState, PlayerNotFoundError> =>
  Effect.gen(function* () {
    const currentPlayer = state.players.get(playerId)

    // ✅ Option.match による型安全なパターンマッチング - if文不要
    yield* pipe(
      currentPlayer,
      Option.match({
        onNone: () =>
          Effect.fail({
            _tag: 'PlayerNotFoundError' as const,
            playerId,
            message: `プレイヤー ${playerId} が見つかりません`,
          }),
        onSome: () => Effect.succeed(undefined),
      })
    )

    const updatedPlayer = {
      ...currentPlayer.value,
      position: newPosition,
      lastUpdated: new Date().toISOString(),
    }

    return {
      ...state,
      players: state.players.set(playerId, updatedPlayer),
    }
  })

// ✅ 配列操作の不変パターン
const addBlockToChunk = (chunk: Chunk, block: Block): Chunk => ({
  ...chunk,
  blocks: Arr.append(chunk.blocks, block),
  lastModified: new Date().toISOString(),
})

const removeBlockFromChunk = (chunk: Chunk, blockId: BlockId): Chunk => ({
  ...chunk,
  blocks: Arr.filter(chunk.blocks, (block) => block.id !== blockId),
  lastModified: new Date().toISOString(),
})
```

### 2.5. 純粋関数の分離と早期リターンパターン

副作用のない純粋関数と副作用のある関数を明確に分離し、早期リターンパターンを活用します。

```typescript
// ✅ 純粋関数: 副作用なし
const calculateDistance = (pos1: Position, pos2: Position): number =>
  Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2) + Math.pow(pos2.z - pos1.z, 2))

const isWithinRange = (pos1: Position, pos2: Position, maxDistance: number): boolean =>
  calculateDistance(pos1, pos2) <= maxDistance

const getChunkCoordinate = (position: Position): ChunkCoordinate => ({
  x: Math.floor(position.x / 16),
  z: Math.floor(position.z / 16),
})

// ✅ Effect関数: 副作用あり + Match パターン
import { Match, pipe, Option } from 'effect'

const movePlayer = (
  playerId: PlayerId,
  newPosition: Position
): Effect.Effect<Player, PlayerMoveError, GameStateService> =>
  Effect.gen(function* () {
    const gameState = yield* GameStateService

    // ✅ 早期リターン: プレイヤー存在チェック
    const currentPlayer = yield* gameState.getPlayer(playerId).pipe(
      Effect.mapError(() => ({
        _tag: 'PlayerNotFoundError' as const,
        playerId,
        message: 'プレイヤーが見つかりません',
      }))
    )

    // ✅ Match.when による位置バリデーション - if文を排除
    const isValidPosition = yield* validateWorldPosition(newPosition)
    yield* pipe(
      Match.value(isValidPosition),
      Match.when(false, () =>
        Effect.fail({
          _tag: 'InvalidPositionError' as const,
          position: newPosition,
          message: '無効な位置です',
        })
      ),
      Match.orElse(() => Effect.succeed(undefined))
    )

    // ✅ Match.when による移動距離チェック - if文の代替
    const distance = calculateDistance(currentPlayer.position, newPosition)
    yield* pipe(
      Match.value(distance),
      Match.when(
        (d) => d > MAX_MOVE_DISTANCE,
        () =>
          Effect.fail({
            _tag: 'TooFarMoveError' as const,
            from: currentPlayer.position,
            to: newPosition,
            distance,
            maxDistance: MAX_MOVE_DISTANCE,
          })
      ),
      Match.orElse(() => Effect.succeed(undefined))
    )

    // ✅ 正常パス: プレイヤー更新
    const updatedPlayer = {
      ...currentPlayer,
      position: newPosition,
      lastMoved: new Date().toISOString(),
    }

    yield* gameState.updatePlayer(playerId, updatedPlayer)
    yield* logPlayerMove(playerId, currentPlayer.position, newPosition)

    return updatedPlayer
  })
```

## 3. Effect型シグネチャの読み方

Effect-TSの型シグネチャを正しく読み理解することは重要です。

```typescript
// Effect<Success, Error, Requirements>の構造
type MyEffect = Effect.Effect<
  string, // Success: 成功時の戻り値型
  NetworkError, // Error: 失敗時のエラー型
  DatabaseService // Requirements: 必要な依存関係
>

// ✅ 複数のエラー型
type MultiErrorEffect = Effect.Effect<
  User,
  UserNotFoundError | ValidationError | DatabaseError,
  DatabaseService | LoggingService
>

// ✅ エラーなしのEffect
type SafeEffect = Effect.Effect<string, never, ConfigService>

// ✅ 依存関係なしのEffect
type IndependentEffect = Effect.Effect<number, ParseError, never>

// ✅ Context要件の明示的管理
interface AppServices extends WorldService, PlayerService, ChunkService {}
```

## まとめ

このドキュメントで解説した基本パターンは、すべてのEffect-TSコードの基礎となります：

### 必須パターン（Effect-TS 3.17+）

1. **Effect.gen + yield\*** による線形な合成
2. **Schema.Struct** による型安全なデータ定義（Data.struct使用禁止）
3. **Context.GenericTag** による依存性注入
4. **Match.value + Match.tags** による網羅的パターンマッチング
5. **不変データ構造** の一貫した使用
6. **純粋関数と副作用の分離**
7. **早期リターンパターン** による最大3レベルネスト
8. **Effect.catchTags** による型安全エラーハンドリング
9. **PBTフレンドリー** な単一責任関数設計

### 禁止パターン（Effect-TS 3.17+）

1. **class** ベースの設計（Context.GenericTagを使用）
2. **Data.struct** の使用（Schema.Structを使用）
3. **if/else/switch** の多用（Match.value + Match.tagsを使用）
4. **任意の型（any、unknown）** の使用
5. **可変データ構造** の使用
6. **try/catch** による例外処理（Effect.catchTagsを使用）
7. **3レベル超えのネスト** （早期リターンで解決）
8. **単一責任原則違反の関数** （PBTフレンドリー設計）
9. **手動エラーハンドリング** （Schema.TaggedError使用）

---

## 関連ドキュメント

### 理論的背景

- **設計哲学**: [関数型プログラミング哲学](../../explanations/design-patterns/functional-programming-philosophy.md) - なぜEffect-TSを選ぶのか
- **アーキテクチャ**: [スケーラブルアーキテクチャ設計](../../explanations/architecture/scalable-architecture-design.md) - 大規模プロジェクトでの設計原則

### 次のステップ

- **サービス設計**: [Effect-TS サービス](./effect-ts-services.md) - Context.GenericTagとLayer管理
- **エラーハンドリング**: [Effect-TS エラーハンドリング](./effect-ts-error-handling.md) - 型安全なエラー処理戦略
- **実践パターン**: [Effect-TS パターン集](./effect-ts-patterns.md) - 高度な応用パターン

### 実践的な適用

- **移行作業**: [Effect-TS移行ガイド](../../how-to/development/effect-ts-migration-guide.md) - 既存コードからの段階的移行
- **テスト戦略**: [Effect-TSテスト](./effect-ts-testing.md) - 効果的なテスト手法

---

## 🚀 Next Steps - Staged Learning Path

### ✅ Completed Learning Outcomes

- [x] Effect-TS基本概念の理解
- [x] Schema.Structによる型安全なデータモデリング
- [x] Effect.gen + yield\*パターンの習得
- [x] Match.valueパターンマッチング

### 🎯 Next Module: Services & Dependency Injection (15分)

→ **[サービスパターン](./effect-ts-services.md)** - Context.GenericTag、Layer、依存性注入

### 🗺️ Full Learning Path

1. **✅ Effect-TS Basics** (現在のモジュール)
2. **→ [Services & DI](./effect-ts-services.md)** - 15分
3. **→ [Error Handling](./effect-ts-error-handling.md)** - 10分
4. **→ [Testing Patterns](./06d-effect-ts-testing.md)** - 15分
5. **→ [Advanced Patterns](./06e-effect-ts-advanced.md)** - 15分

**Total Learning Time**: 75分 | **Progress**: 30/75 (40%)

> 📌 **Quick Navigation**: [← Back to Quick Start](../../getting-started/README.md) | [→ Continue to Services](./06b-effect-ts-services.md)
