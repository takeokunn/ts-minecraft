# 純粋関数型コア
## 1. Effect-TSの中核概念

Effect-TSは、TypeScriptで純粋関数型プログラミングを実現するための包括的なエコシステムです。すべての副作用を型レベルで追跡し、予測可能で合成可能なプログラムを構築します。

### 1.1 Effect型の本質

```typescript
// Effect<Success, Error, Requirements>
// Success: 成功時の値の型
// Error: 失敗時のエラーの型
// Requirements: 実行に必要な依存性の型

type PureComputation<A> = Effect.Effect<A, never, never>
type Fallible<A, E> = Effect.Effect<A, E, never>
type Dependent<A, R> = Effect.Effect<A, never, R>
type Complete<A, E, R> = Effect.Effect<A, E, R>
```

## 2. 純粋関数の設計原則
### 2.1 参照透過性の保証

```typescript
// ❌ 参照透過性を破る関数
let counter = 0
const impureIncrement = (): number => {
  counter += 1  // 外部状態の変更
  return counter
}

console.log(impureIncrement()) // 1
console.log(impureIncrement()) // 2 - 同じ入力で異なる出力！

// ✅ 参照透過な関数
const pureIncrement = (counter: number): number => counter + 1

console.log(pureIncrement(0)) // 1
console.log(pureIncrement(0)) // 1 - 常に同じ結果
```

### 2.2 副作用の明示的管理

```typescript
// 副作用を Effect として表現

// ランダム値生成（副作用）
export const randomInt = (min: number, max: number): Effect.Effect<number> =>
  Effect.sync(() => Math.floor(Math.random() * (max - min + 1)) + min)

// 現在時刻取得（副作用）
export const currentTime = (): Effect.Effect<number> =>
  Effect.sync(() => Date.now())

// ログ出力（副作用）
export const log = (message: string): Effect.Effect<void> =>
  Effect.sync(() => console.log(message))

// 純粋な計算
export const calculateDamage = (
  attackPower: number,
  defense: number
): number => Math.max(0, attackPower - defense)

// 副作用を含む戦闘処理
export const processCombat = (
  attacker: Entity,
  defender: Entity
): Effect.Effect<CombatResult> =>
  Effect.gen(function* () {
    // ランダムクリティカル判定
    const criticalRoll = yield* randomInt(1, 100)
    const isCritical = criticalRoll > 90

    // ダメージ計算（純粋）
    const baseDamage = calculateDamage(attacker.attack, defender.defense)
    const finalDamage = isCritical ? baseDamage * 2 : baseDamage

    // ログ出力
    yield* log(`${attacker.name} deals ${finalDamage} damage to ${defender.name}`)

    return {
      damage: finalDamage,
      isCritical,
      timestamp: yield* currentTime()
    }
  })
```

## 3. 不変データ構造

### 3.1 Data.Structによる不変構造体

```typescript
import { Schema, Effect, HashMap, pipe, Equal } from "effect"

// エラー型の定義（Schema使用）
const InvalidMoveError = Schema.Struct({
  _tag: Schema.Literal("InvalidMoveError"),
  delta: Schema.Number,
  reason: Schema.String
})
type InvalidMoveError = Schema.Schema.Type<typeof InvalidMoveError>

const InventoryError = Schema.Struct({
  _tag: Schema.Literal("InventoryError"),
  reason: Schema.String,
  itemId: Schema.String
})
type InventoryError = Schema.Schema.Type<typeof InventoryError>

// 不変データ構造の定義（Data.Structを使用）
export interface Position {
  readonly x: number
  readonly y: number
  readonly z: number
}

// Schema による型安全な Position 定義
export const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

type Position = Schema.Schema.Type<typeof Position>

// ファクトリー関数
export const createPosition = (x: number, y: number, z: number): Position => ({ x, y, z })

// 更新関数は新しいインスタンスを返す
// 早期リターンとバリデーション付きの move 関数
export const movePosition = (
  pos: Position,
  dx: number,
  dy: number,
  dz: number
): Effect.Effect<Position, InvalidMoveError> => {
  // 単一責務: 移動量のバリデーション
  const validateMovement = (delta: number): Effect.Effect<number, InvalidMoveError> =>
    Math.abs(delta) > 1000
      ? Effect.fail(new InvalidMoveError({ delta, reason: "Movement too large" }))
      : Effect.succeed(delta)

  return Effect.gen(function* () {
    const validatedDx = yield* validateMovement(dx)
    const validatedDy = yield* validateMovement(dy)
    const validatedDz = yield* validateMovement(dz)

    return {
      x: pos.x + validatedDx,
      y: pos.y + validatedDy,
      z: pos.z + validatedDz
    }
  })
}

// 純粋関数版（バリデーションなし）
export const movePositionPure = (
  pos: Position,
  dx: number,
  dy: number,
  dz: number
): Position => ({
  x: pos.x + dx,
  y: pos.y + dy,
  z: pos.z + dz
})

const pos1 = createPosition(0, 0, 0)
const pos2 = movePositionPure(pos1, 1, 0, 0)

console.log(pos1 === pos2)  // false - 異なるインスタンス
console.log(Equal.equals(pos1, pos2))  // false - 異なる値

// Effect版の使用例
const safeMove = Effect.gen(function* () {
  const newPos = yield* movePosition(pos1, 1, 0, 0)
  yield* Effect.logInfo(`Moved to position: ${JSON.stringify(newPos)}`)
  return newPos
})
```

### 3.2 永続データ構造

```typescript
import { HashMap, HashSet, List, Chunk } from "effect"

// 永続データ構造

// Schema定義と型安全な永続ハッシュマップ
const ItemId = Schema.String.pipe(Schema.brand("ItemId"))
type ItemId = Schema.Schema.Type<typeof ItemId>

const ItemStack = Schema.Struct({
  count: Schema.Number.pipe(Schema.positive()),
  durability: Schema.Number.pipe(Schema.between(0, 100))
})
type ItemStack = Schema.Schema.Type<typeof ItemStack>

// 単一責務: インベントリ作成
export const createEmptyInventory = (): HashMap.HashMap<ItemId, ItemStack> =>
  HashMap.empty()

// 単一責務: アイテム追加
export const addItemToInventory = (
  inventory: HashMap.HashMap<ItemId, ItemStack>,
  itemId: ItemId,
  stack: ItemStack
): Effect.Effect<HashMap.HashMap<ItemId, ItemStack>, InventoryError> => {
  // 早期リターン: バリデーション
  if (stack.count <= 0) {
    return Effect.fail(new InventoryError({ reason: "Count must be positive", itemId }))
  }

  return Effect.succeed(HashMap.set(inventory, itemId, stack))
}

// 初期インベントリの作成（純粋関数）
export const createInitialInventory = (): HashMap.HashMap<ItemId, ItemStack> =>
  pipe(
    createEmptyInventory(),
    HashMap.set("sword" as ItemId, { count: 1, durability: 100 }),
    HashMap.set("shield" as ItemId, { count: 1, durability: 50 })
  )

// バリデーション付きインベントリ更新
export const updateInventory = (
  inventory: HashMap.HashMap<ItemId, ItemStack>,
  itemId: ItemId,
  stack: ItemStack
): Effect.Effect<HashMap.HashMap<ItemId, ItemStack>, InventoryError> =>
  Effect.gen(function* () {
    // 早期リターン: スタック検証
    const validatedStack = yield* Schema.decodeUnknown(ItemStack)(stack).pipe(
      Effect.mapError(error => new InventoryError({ reason: "Invalid stack data", itemId }))
    )

    return HashMap.set(inventory, itemId, validatedStack)
  })

// 永続リスト
// Quest スキーマ定義
const Quest = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("QuestId")),
  title: Schema.String.pipe(Schema.minLength(1)),
  description: Schema.String,
  completed: Schema.Boolean,
  priority: Schema.Number.pipe(Schema.between(1, 5))
})
type Quest = Schema.Schema.Type<typeof Quest>

// 単一責務: クエストログ作成
export const createQuestLog = (quests: ReadonlyArray<Quest>): List.List<Quest> =>
  quests.reduce(
    (log, quest) => List.prepend(log, quest),
    List.empty<Quest>()
  )

// バリデーション付きクエスト追加
export const addQuestToLog = (
  log: List.List<Quest>,
  quest: unknown
): Effect.Effect<List.List<Quest>, QuestValidationError> =>
  Effect.gen(function* () {
    const validatedQuest = yield* Schema.decodeUnknown(Quest)(quest).pipe(
      Effect.mapError(error => new QuestValidationError({ parseError: error }))
    )

    return List.prepend(log, validatedQuest)
  })

// 永続セット
// Achievement 型定義
const AchievementId = Schema.String.pipe(Schema.brand("AchievementId"))
type AchievementId = Schema.Schema.Type<typeof AchievementId>

const Achievement = Schema.Struct({
  id: AchievementId,
  name: Schema.String.pipe(Schema.minLength(1)),
  description: Schema.String,
  unlockedAt: Schema.optional(Schema.DateTimeUtc)
})
type Achievement = Schema.Schema.Type<typeof Achievement>

// 単一責務: アチーブメントセット作成
export const createAchievementSet = (achievements: ReadonlyArray<AchievementId>): HashSet.HashSet<AchievementId> =>
  achievements.reduce(
    (set, achievement) => HashSet.add(set, achievement),
    HashSet.empty<AchievementId>()
  )

// 早期リターンでのアチーブメント追加
export const addAchievement = (
  achievements: HashSet.HashSet<AchievementId>,
  achievementId: AchievementId
): Effect.Effect<HashSet.HashSet<AchievementId>, AchievementError> => {
  // 既に存在する場合は早期リターン
  if (HashSet.has(achievements, achievementId)) {
    return Effect.fail(new AchievementError({
      reason: "Achievement already exists",
      achievementId
    }))
  }

  return Effect.succeed(HashSet.add(achievements, achievementId))
}

// Chunk - 高性能な不変配列
// Entity スキーマ定義
const EntityId = Schema.String.pipe(Schema.brand("EntityId"))
type EntityId = Schema.Schema.Type<typeof EntityId>

const Entity = Schema.Struct({
  id: EntityId,
  position: Position,
  active: Schema.Boolean,
  type: Schema.Union(
    Schema.Literal("player"),
    Schema.Literal("npc"),
    Schema.Literal("item"),
    Schema.Literal("block")
  )
})
type Entity = Schema.Schema.Type<typeof Entity>

// 単一責務: エンティティバッファ作成
export const createEntityBuffer = (entities: ReadonlyArray<Entity>): Chunk.Chunk<Entity> =>
  Chunk.fromIterable(entities)

// バリデーション付きエンティティ追加
export const addEntityToBuffer = (
  buffer: Chunk.Chunk<Entity>,
  entity: unknown
): Effect.Effect<Chunk.Chunk<Entity>, EntityValidationError> =>
  Effect.gen(function* () {
    const validatedEntity = yield* Schema.decodeUnknown(Entity)(entity).pipe(
      Effect.mapError(error => new EntityValidationError({ parseError: error }))
    )

    return Chunk.append(buffer, validatedEntity)
  })
```

## 4. 関数合成パターン

### 4.1 パイプラインによる合成

```typescript
import { pipe, flow, Equal, List, HashSet, Chunk, Option, Stream } from "effect"

// 追加のエラー型定義
const QuestValidationError = Schema.Struct({
  _tag: Schema.Literal("QuestValidationError"),
  parseError: Schema.Unknown
})
type QuestValidationError = Schema.Schema.Type<typeof QuestValidationError>

const AchievementError = Schema.Struct({
  _tag: Schema.Literal("AchievementError"),
  reason: Schema.String,
  achievementId: Schema.String
})
type AchievementError = Schema.Schema.Type<typeof AchievementError>

const EntityValidationError = Schema.Struct({
  _tag: Schema.Literal("EntityValidationError"),
  parseError: Schema.Unknown
})
type EntityValidationError = Schema.Schema.Type<typeof EntityValidationError>

// 追加のエラー型定義
const InputValidationError = Schema.Struct({
  _tag: Schema.Literal("InputValidationError"),
  parseError: Schema.Unknown
})
type InputValidationError = Schema.Schema.Type<typeof InputValidationError>

const InputProcessingError = Schema.Struct({
  _tag: Schema.Literal("InputProcessingError"),
  stage: Schema.String,
  error: Schema.Unknown
})
type InputProcessingError = Schema.Schema.Type<typeof InputProcessingError>

const ProcessingError = Schema.Struct({
  _tag: Schema.Literal("ProcessingError"),
  stage: Schema.String,
  value: Schema.Unknown
})
type ProcessingError = Schema.Schema.Type<typeof ProcessingError>

const ValidationError = Schema.Struct({
  _tag: Schema.Literal("ValidationError"),
  reason: Schema.String
})
type ValidationError = Schema.Schema.Type<typeof ValidationError>

// 座標系の型定義
const WorldCoordinates = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})
type WorldCoordinates = Schema.Schema.Type<typeof WorldCoordinates>

// 補助関数
const applyDeadzone = (input: ValidatedInput): ValidatedInput => ({
  ...input,
  x: Math.abs(input.x) < 0.1 ? 0 : input.x,
  y: Math.abs(input.y) < 0.1 ? 0 : input.y
})

const scaleToWorldCoordinates = (input: ValidatedInput): WorldCoordinates => ({
  x: input.x * 10,
  y: input.y * 10,
  z: 0
})

const clampToValidRange = (coords: WorldCoordinates): WorldCoordinates => ({
  x: Math.max(-100, Math.min(100, coords.x)),
  y: Math.max(-100, Math.min(100, coords.y)),
  z: Math.max(-100, Math.min(100, coords.z))
})

const isValidForProcessing = (value: unknown): boolean => {
  return value != null && typeof value === 'object'
}

// 入力処理に必要な型定義
const RawInput = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  timestamp: Schema.Number
})
type RawInput = Schema.Schema.Type<typeof RawInput>

const ValidatedInput = Schema.Struct({
  x: Schema.Number.pipe(Schema.between(-1, 1)),
  y: Schema.Number.pipe(Schema.between(-1, 1)),
  timestamp: Schema.Number.pipe(Schema.positive())
})
type ValidatedInput = Schema.Schema.Type<typeof ValidatedInput>

// 単一責務の検証関数
const validateInput = (input: RawInput): Effect.Effect<ValidatedInput, InputValidationError> =>
  Schema.decodeUnknown(ValidatedInput)(input).pipe(
    Effect.mapError(error => new InputValidationError({ parseError: error }))
  )

// 単一責務の正規化関数
const normalizeInput = (input: ValidatedInput): ValidatedInput => ({
  ...input,
  x: Math.max(-1, Math.min(1, input.x)),
  y: Math.max(-1, Math.min(1, input.y))
})

// パイプラインによる変換の連鎖（Effect版）
export const processPlayerInput = (input: unknown): Effect.Effect<WorldCoordinates, InputProcessingError> =>
  Effect.gen(function* () {
    const rawInput = yield* Schema.decodeUnknown(RawInput)(input).pipe(
      Effect.mapError(error => new InputProcessingError({ stage: "parsing", error }))
    )

    const validated = yield* validateInput(rawInput).pipe(
      Effect.mapError(error => new InputProcessingError({ stage: "validation", error }))
    )

    const normalized = normalizeInput(validated)
    const deadzoned = applyDeadzone(normalized)
    const scaled = scaleToWorldCoordinates(deadzoned)
    const clamped = clampToValidRange(scaled)

    return clamped
  })

// 純粋関数版（エラーハンドリングなし）
export const processPlayerInputPure = (input: RawInput): WorldCoordinates =>
  pipe(
    input,
    normalizeInput,
    applyDeadzone,
    scaleToWorldCoordinates,
    clampToValidRange
  )

// flow による純粋関数合成
export const composedTransform = flow(
  normalizeInput,
  applyDeadzone,
  scaleToWorldCoordinates,
  clampToValidRange
)

// Effect版の関数合成
export const composedEffectTransform = (input: unknown) =>
  pipe(
    input,
    Schema.decodeUnknown(RawInput),
    Effect.flatMap(validateInput),
    Effect.map(normalizeInput),
    Effect.map(applyDeadzone),
    Effect.map(scaleToWorldCoordinates),
    Effect.map(clampToValidRange)
  )
```

### 4.2 Effect の合成

```typescript
// Effect の合成パターン

// 型安全な逐次実行パターン
export const sequential = <A, E1, R1, B, E2, R2, C, E3, R3, Result>(
  effectA: Effect.Effect<A, E1, R1>,
  effectB: (a: A) => Effect.Effect<B, E2, R2>,
  effectC: (b: B) => Effect.Effect<C, E3, R3>,
  combine: (a: A, b: B, c: C) => Result
): Effect.Effect<Result, E1 | E2 | E3, R1 | R2 | R3> =>
  Effect.gen(function* () {
    const a = yield* effectA
    const b = yield* effectB(a)
    const c = yield* effectC(b)
    return combine(a, b, c)
  })

// 早期リターン付きの逐次処理
export const sequentialWithEarlyReturn = <A, B, C, E, R>(
  effectA: Effect.Effect<A, E, R>,
  effectB: (a: A) => Effect.Effect<B, E, R>,
  effectC: (b: B) => Effect.Effect<C, E, R>
): Effect.Effect<C, E, R> =>
  Effect.gen(function* () {
    const a = yield* effectA
    // 早期リターン: aが無効な場合は処理を停止
    if (!isValidForProcessing(a)) {
      return yield* Effect.fail(new ProcessingError({ stage: "A", value: a }))
    }

    const b = yield* effectB(a)
    if (!isValidForProcessing(b)) {
      return yield* Effect.fail(new ProcessingError({ stage: "B", value: b }))
    }

    return yield* effectC(b)
  })

// 型安全な並列実行パターン
export const parallel = <A, E1, R1, B, E2, R2, C, E3, R3>(
  effectA: Effect.Effect<A, E1, R1>,
  effectB: Effect.Effect<B, E2, R2>,
  effectC: Effect.Effect<C, E3, R3>
): Effect.Effect<{ a: A; b: B; c: C }, E1 | E2 | E3, R1 | R2 | R3> =>
  Effect.all({
    a: effectA,
    b: effectB,
    c: effectC
  })

// 部分的失敗を許容する並列実行
export const parallelWithPartialFailure = <A, B, C, E, R>(
  effectA: Effect.Effect<A, E, R>,
  effectB: Effect.Effect<B, E, R>,
  effectC: Effect.Effect<C, E, R>
): Effect.Effect<{ a: Option.Option<A>; b: Option.Option<B>; c: Option.Option<C> }, never, R> =>
  Effect.all({
    a: effectA.pipe(Effect.option),
    b: effectB.pipe(Effect.option),
    c: effectC.pipe(Effect.option)
  })

// 型安全な条件分岐パターン
export const conditional = <A, B, E, R>(
  condition: boolean,
  trueBranch: Effect.Effect<A, E, R>,
  falseBranch: Effect.Effect<B, E, R>
): Effect.Effect<A | B, E, R> =>
  condition ? trueBranch : falseBranch

// 早期リターン付き条件分岐
export const conditionalWithValidation = <T, A, B, E, R>(
  value: T,
  predicate: (value: T) => boolean,
  trueBranch: (value: T) => Effect.Effect<A, E, R>,
  falseBranch: (value: T) => Effect.Effect<B, E, R>
): Effect.Effect<A | B, E, R> => {
  // 早期リターン: null/undefined チェック
  if (value == null) {
    return Effect.fail(new ValidationError({ reason: "Value cannot be null or undefined" }) as E)
  }

  return predicate(value) ? trueBranch(value) : falseBranch(value)
}

// 複数条件の処理
export const multiConditional = <T, R1, R2, R3, E, Req>(
  value: T,
  conditions: {
    first: (value: T) => boolean
    second: (value: T) => boolean
    third: (value: T) => boolean
  },
  handlers: {
    first: (value: T) => Effect.Effect<R1, E, Req>
    second: (value: T) => Effect.Effect<R2, E, Req>
    third: (value: T) => Effect.Effect<R3, E, Req>
    default: (value: T) => Effect.Effect<R1 | R2 | R3, E, Req>
  }
): Effect.Effect<R1 | R2 | R3, E, Req> => {
  if (conditions.first(value)) return handlers.first(value)
  if (conditions.second(value)) return handlers.second(value)
  if (conditions.third(value)) return handlers.third(value)
  return handlers.default(value)
}

// ネットワークエラー型定義
const NetworkError = Schema.Struct({
  _tag: Schema.Literal("NetworkError"),
  code: Schema.Number,
  message: Schema.String,
  retryable: Schema.Boolean
})
type NetworkError = Schema.Schema.Type<typeof NetworkError>

// 型安全なエラーハンドリング付き合成
export const withErrorHandling = <A, E, R>(
  riskyOperation: Effect.Effect<A, NetworkError | E, R>,
  defaultValue: A,
  fallbackValue: A
): Effect.Effect<A, E, R> =>
  pipe(
    riskyOperation,
    Effect.catchTag("NetworkError", (networkError) => {
      // 早期リターン: 再試行可能なエラーの場合
      if (networkError.retryable) {
        return Effect.succeed(defaultValue)
      }
      return Effect.succeed(fallbackValue)
    }),
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* logError(error)
        return fallbackValue
      })
    )
  )

// 特定エラーのみを処理し、他は伝播
export const withSpecificErrorHandling = <A, E1, E2, R>(
  operation: Effect.Effect<A, E1 | E2, R>,
  handleSpecificError: (error: E1) => Effect.Effect<A, E2, R>
): Effect.Effect<A, E2, R> =>
  pipe(
    operation,
    Effect.catchSome((error) => {
      // 特定エラーのみハンドルし、他は Option.none() で伝播
      if (isSpecificError(error)) {
        return Option.some(handleSpecificError(error as E1))
      }
      return Option.none()
    })
  )

const logError = (error: unknown): Effect.Effect<void> =>
  Effect.logError(`Error occurred: ${JSON.stringify(error)}`)

const isSpecificError = (error: unknown): boolean => {
  return typeof error === 'object' && error != null && '_tag' in error
}
```

## 5. 高階関数パターン

### 5.1 マップ・フィルター・リデュース

```typescript
// 高階関数パターン

// 型安全なマップ操作
export const mapEntities = <A, B>(
  entities: ReadonlyArray<A>,
  transform: (a: A, index: number) => B
): ReadonlyArray<B> => {
  // 早期リターン: 空配列チェック
  if (entities.length === 0) {
    return []
  }

  return entities.map(transform)
}

// バリデーション付きマップ
export const mapEntitiesWithValidation = <A, B, E>(
  entities: ReadonlyArray<A>,
  transform: (a: A) => Effect.Effect<B, E, never>
): Effect.Effect<ReadonlyArray<B>, E, never> => {
  if (entities.length === 0) {
    return Effect.succeed([])
  }

  return Effect.all(entities.map(transform))
}

// 型ガード付きフィルター
interface ActiveEntity {
  readonly active: boolean
}

export const filterActive = <T extends ActiveEntity>(
  items: ReadonlyArray<T>
): ReadonlyArray<T> => {
  // 早期リターン: 空配列チェック
  if (items.length === 0) {
    return []
  }

  return items.filter((item): item is T => {
    // 型ガードで安全性を確保
    return item != null && typeof item.active === 'boolean' && item.active
  })
}

// 複数条件フィルター
export const filterByMultipleConditions = <T>(
  items: ReadonlyArray<T>,
  conditions: ReadonlyArray<(item: T) => boolean>
): ReadonlyArray<T> => {
  if (items.length === 0 || conditions.length === 0) {
    return items
  }

  return items.filter(item =>
    conditions.every(condition => condition(item))
  )
}

// Effect版フィルター
export const filterActiveWithEffect = <T extends ActiveEntity, E>(
  items: ReadonlyArray<T>,
  validator: (item: T) => Effect.Effect<boolean, E, never>
): Effect.Effect<ReadonlyArray<T>, E, never> => {
  if (items.length === 0) {
    return Effect.succeed([])
  }

  return Effect.gen(function* () {
    const results: T[] = []
    for (const item of items) {
      const isValid = yield* validator(item)
      if (isValid && item.active) {
        results.push(item)
      }
    }
    return results
  })
}

// Attack 型定義
const Attack = Schema.Struct({
  damage: Schema.Number.pipe(Schema.nonnegative()),
  type: Schema.Union(
    Schema.Literal("physical"),
    Schema.Literal("magical"),
    Schema.Literal("true")
  ),
  critical: Schema.Boolean
})
type Attack = Schema.Schema.Type<typeof Attack>

// 安全なリデュース操作
export const totalDamage = (
  attacks: ReadonlyArray<Attack>
): number => {
  // 早期リターン: 空配列チェック
  if (attacks.length === 0) {
    return 0
  }

  return attacks.reduce((total, attack) => {
    // 安全性チェック
    const damage = attack.damage ?? 0
    return total + (damage >= 0 ? damage : 0)
  }, 0)
}

// 特定タイプのダメージ集計
export const totalDamageByType = (
  attacks: ReadonlyArray<Attack>,
  targetType: Attack['type']
): number =>
  attacks
    .filter(attack => attack.type === targetType)
    .reduce((total, attack) => total + attack.damage, 0)

// Effect版リデュース
export const totalDamageWithValidation = (
  attacks: ReadonlyArray<unknown>
): Effect.Effect<number, AttackValidationError, never> =>
  Effect.gen(function* () {
    if (attacks.length === 0) {
      return 0
    }

    const validatedAttacks = yield* Effect.all(
      attacks.map(attack =>
        Schema.decodeUnknown(Attack)(attack).pipe(
          Effect.mapError(error => new AttackValidationError({ parseError: error }))
        )
      )
    )

    return validatedAttacks.reduce((total, attack) => total + attack.damage, 0)
  })

// エラー型定義
const AttackValidationError = Schema.Struct({
  _tag: Schema.Literal("AttackValidationError"),
  parseError: Schema.Unknown
})
type AttackValidationError = Schema.Schema.Type<typeof AttackValidationError>

// 同期数制御付きEffectマップ
export const mapEffect = <A, B, E, R>(
  items: ReadonlyArray<A>,
  f: (a: A) => Effect.Effect<B, E, R>,
  options?: { concurrency?: number | "unbounded" }
): Effect.Effect<ReadonlyArray<B>, E, R> => {
  if (items.length === 0) {
    return Effect.succeed([])
  }

  return Effect.forEach(items, f, {
    concurrency: options?.concurrency ?? "unbounded"
  })
}

// バッチ処理版
export const mapEffectInBatches = <A, B, E, R>(
  items: ReadonlyArray<A>,
  f: (a: A) => Effect.Effect<B, E, R>,
  batchSize: number = 10
): Effect.Effect<ReadonlyArray<B>, E, R> => {
  if (items.length === 0) {
    return Effect.succeed([])
  }

  const batches: ReadonlyArray<ReadonlyArray<A>> = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }

  return Effect.gen(function* () {
    const results: B[][] = []
    for (const batch of batches) {
      const batchResults = yield* Effect.forEach(batch, f, {
        concurrency: "unbounded"
      })
      results.push(batchResults)
    }
    return results.flat()
  })
}

// 高性能Effectフィルター
export const filterEffect = <A, E, R>(
  items: ReadonlyArray<A>,
  predicate: (a: A) => Effect.Effect<boolean, E, R>,
  options?: { concurrency?: number | "unbounded" }
): Effect.Effect<ReadonlyArray<A>, E, R> => {
  if (items.length === 0) {
    return Effect.succeed([])
  }

  return Effect.gen(function* () {
    const predicateResults = yield* Effect.forEach(
      items,
      predicate,
      { concurrency: options?.concurrency ?? "unbounded" }
    )

    return items.filter((_, index) => predicateResults[index])
  })
}

// ファイルファストフィルター（最初のエラーで停止）
export const filterEffectFailFast = <A, E, R>(
  items: ReadonlyArray<A>,
  predicate: (a: A) => Effect.Effect<boolean, E, R>
): Effect.Effect<ReadonlyArray<A>, E, R> => {
  if (items.length === 0) {
    return Effect.succeed([])
  }

  return Effect.gen(function* () {
    const results: A[] = []
    for (const item of items) {
      const shouldInclude = yield* predicate(item)
      if (shouldInclude) {
        results.push(item)
      }
    }
    return results
  })
}
```

### 5.2 カリー化と部分適用

```typescript
// カリー化と部分適用

// 型安全なカリー化関数
export const add = (a: number) => (b: number): number => {
  // 早期リターン: 数値検証
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error(`Invalid numbers: a=${a}, b=${b}`)
  }
  return a + b
}

export const multiply = (a: number) => (b: number): number => {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error(`Invalid numbers: a=${a}, b=${b}`)
  }
  return a * b
}

// Effect版数値演算
export const addSafe = (a: number) => (b: number): Effect.Effect<number, MathError, never> => {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return Effect.fail(new MathError({ operation: "add", operands: [a, b] }))
  }
  return Effect.succeed(a + b)
}

export const multiplySafe = (a: number) => (b: number): Effect.Effect<number, MathError, never> => {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return Effect.fail(new MathError({ operation: "multiply", operands: [a, b] }))
  }
  return Effect.succeed(a * b)
}

// 部分適用と特化関数
export const double = multiply(2)
export const triple = multiply(3)
export const quadruple = multiply(4)

// Effect版部分適用
export const doubleSafe = addSafe(0) // a => a + 0 ではなく multiplySafe(2) を使用
export const tripleSafe = multiplySafe(3)

// 高階関数としての部分適用
export const createMultiplier = (factor: number) =>
  (value: number): Effect.Effect<number, MathError, never> =>
    multiplySafe(factor)(value)

// 数学エラー型
const MathError = Schema.Struct({
  _tag: Schema.Literal("MathError"),
  operation: Schema.String,
  operands: Schema.Array(Schema.Number)
})
type MathError = Schema.Schema.Type<typeof MathError>

// ダメージ計算パラメータ型
const DamageCalculatorParams = Schema.Struct({
  baseDamage: Schema.Number.pipe(Schema.nonnegative()),
  critMultiplier: Schema.Number.pipe(Schema.between(1, 10)),
  defenseReduction: Schema.Number.pipe(Schema.nonnegative()),
  isCritical: Schema.Boolean
})
type DamageCalculatorParams = Schema.Schema.Type<typeof DamageCalculatorParams>

// 型安全なダメージ計算器ファクトリ
export const createDamageCalculator = (
  baseDamage: number
) => (
  critMultiplier: number
) => (
  defenseReduction: number
) => (
  isCritical: boolean
): Effect.Effect<number, DamageCalculationError, never> => {
  // 早期リターン: パラメータ検証
  if (baseDamage < 0 || defenseReduction < 0 || critMultiplier < 1) {
    return Effect.fail(new DamageCalculationError({
      reason: "Invalid damage calculation parameters",
      params: { baseDamage, critMultiplier, defenseReduction, isCritical }
    }))
  }

  const damage = Math.max(0, baseDamage - defenseReduction)
  const finalDamage = isCritical ? damage * critMultiplier : damage

  return Effect.succeed(Math.floor(finalDamage))
}

// 純粋関数版（パフォーマンス重視）
export const createDamageCalculatorPure = (
  baseDamage: number
) => (
  critMultiplier: number
) => (
  defenseReduction: number
) => (
  isCritical: boolean
): number => {
  const damage = Math.max(0, baseDamage - defenseReduction)
  return isCritical ? Math.floor(damage * critMultiplier) : Math.floor(damage)
}

const DamageCalculationError = Schema.Struct({
  _tag: Schema.Literal("DamageCalculationError"),
  reason: Schema.String,
  params: Schema.Unknown
})
type DamageCalculationError = Schema.Schema.Type<typeof DamageCalculationError>

// ゲームルール用特化計算機
export const normalDamageCalculator = createDamageCalculatorPure(10)(2)
export const bossDamageCalculator = createDamageCalculatorPure(50)(3)
export const magicDamageCalculator = createDamageCalculatorPure(25)(2.5)

// Effect版特化計算機
export const normalDamageEffect = createDamageCalculator(10)(2)
export const bossDamageEffect = createDamageCalculator(50)(3)

// 計算機のバリデーション付き使用
export const calculateDamageWithValidation = (
  calculatorType: "normal" | "boss" | "magic",
  defenseReduction: number,
  isCritical: boolean
): Effect.Effect<number, DamageCalculationError, never> => {
  const calculator = (() => {
    switch (calculatorType) {
      case "normal": return normalDamageEffect
      case "boss": return bossDamageEffect
      case "magic": return createDamageCalculator(25)(2.5)
      default: return normalDamageEffect
    }
  })()

  return calculator(defenseReduction)(isCritical)
}
```

## 6. モナディック合成

### 6.1 Option モナド

```typescript
import { Option } from "effect"

// Option モナドパターン

// 安全な値の取得
export const findEntity = (
  id: EntityId,
  entityMap: Map<EntityId, Entity>
): Option.Option<Entity> =>
  Option.fromNullable(entityMap.get(id))

// Option の連鎖
export const getPlayerWeaponDamage = (
  playerId: PlayerId,
  findPlayer: (id: PlayerId) => Option.Option<Player>
): Option.Option<number> =>
  pipe(
    findPlayer(playerId),
    Option.flatMap(player => Option.fromNullable(player.equippedWeapon)),
    Option.flatMap(weapon => Option.fromNullable(weapon.damage))
  )

// デフォルト値の提供
export const getDamageOrDefault = (
  playerId: PlayerId,
  findPlayer: (id: PlayerId) => Option.Option<Player>
): number =>
  pipe(
    getPlayerWeaponDamage(playerId, findPlayer),
    Option.getOrElse(() => 1)  // 素手のダメージ
  )
```

### 6.2 Either モナド

```typescript
import { Either } from "effect"

// Either モナドパターン

// エラーまたは成功値
export const parseCoordinate = (
  input: string
): Either.Either<CoordinateError, Coordinate> =>
  pipe(
    input.split(","),
    (parts) => parts.length === 3
      ? Either.right({
          x: parseInt(parts[0]),
          y: parseInt(parts[1]),
          z: parseInt(parts[2])
        })
      : Either.left(new CoordinateError("Invalid format"))
  )

// Either の合成
export const validateAndTransform = (
  input: string,
  validateCoordinate: (coord: Coordinate) => Either.Either<ValidationError, Coordinate>,
  coordinateToPosition: (coord: Coordinate) => Position
): Either.Either<ValidationError, Position> =>
  pipe(
    parseCoordinate(input),
    Either.flatMap(validateCoordinate),
    Either.map(coordinateToPosition)
  )
```

## 7. レンズとオプティクス

### 7.1 不変更新のためのレンズ

```typescript
import { Optic } from "@effect/optics"

// レンズとオプティクスパターン

// レンズの定義用インターフェース
export interface LensPlayer {
  readonly name: string
  readonly stats: {
    readonly health: number
    readonly mana: number
    readonly stamina: number
  }
  readonly inventory: {
    readonly items: ReadonlyArray<Item>
    readonly gold: number
  }
}

// レンズの作成
export const createHealthLens = () =>
  Optic.id<LensPlayer>()
    .at("stats")
    .at("health")

export const createGoldLens = () =>
  Optic.id<LensPlayer>()
    .at("inventory")
    .at("gold")

// レンズを使った更新
export const takeDamageWithLens = (player: LensPlayer, damage: number): LensPlayer => {
  const healthLens = createHealthLens()
  return Optic.modify(healthLens)(health => Math.max(0, health - damage))(player)
}

export const addGoldWithLens = (player: LensPlayer, amount: number): LensPlayer => {
  const goldLens = createGoldLens()
  return Optic.modify(goldLens)(gold => gold + amount)(player)
}

// 複数の更新を合成
export const rewardPlayer = (player: LensPlayer, gold: number, health: number): LensPlayer => {
  const healthLens = createHealthLens()
  return pipe(
    player,
    (p) => addGoldWithLens(p, gold),
    Optic.modify(healthLens)(h => Math.min(100, h + health))
  )
}
```

## 8. 遅延評価

### 8.1 サンクとメモ化

```typescript
// 遅延評価パターン

// サンク: 遅延評価される値
export const createLazyValue = (
  expensiveComputation: () => number
) => Effect.suspend(() => {
  console.log("Computing expensive value...")
  return Effect.succeed(expensiveComputation())
})

// メモ化: 一度だけ計算
export const createMemoized = (
  lazyValue: Effect.Effect<number>
) => Effect.cached(lazyValue)

// 無限ストリーム
export const infiniteNumbers = Stream.iterate(0, n => n + 1)

// 必要な分だけ評価
export const getFirstTenPrimes = (
  isPrime: (n: number) => boolean
) => pipe(
  infiniteNumbers,
  Stream.filter(isPrime),
  Stream.take(10),
  Stream.runCollect
)
```

## 9. 型レベルプログラミング

### 9.1 ファントム型

```typescript
// ファントム型パターン

// ブランド型で単位を表現
export type Meters = number & { readonly _brand: "Meters" }
export type Seconds = number & { readonly _brand: "Seconds" }
export type MetersPerSecond = number & { readonly _brand: "MetersPerSecond" }

export const meters = (value: number): Meters => value as Meters
export const seconds = (value: number): Seconds => value as Seconds

// 型安全な物理計算
export const velocity = (
  distance: Meters,
  time: Seconds
): MetersPerSecond =>
  (distance / time) as MetersPerSecond

// コンパイルエラー: 型が合わない
// const wrong = velocity(seconds(10), meters(5))
```

## 10. まとめ

純粋関数型コアにより：
- **予測可能性**: 副作用の完全な制御
- **合成可能性**: 小さな関数から複雑な処理を構築
- **テスト容易性**: 純粋関数は簡単にテスト可能
- **並列性**: 不変データによる安全な並列処理

次のドキュメント：
- [01-effect-composition.md](./01-effect-composition.md) - Effect合成パターン
- [02-layer-system.md](./02-layer-system.md) - Layerシステム
