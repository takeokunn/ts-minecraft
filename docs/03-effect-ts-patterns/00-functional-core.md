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
import { Data } from "effect"

// 不変データ構造の定義（Data.Structを使用）
export interface Position {
  readonly x: number
  readonly y: number
  readonly z: number
}

// Data.Structで不変データ構造を作成
export const Position = Data.struct<Position>({
  x: 0,
  y: 0,
  z: 0
})

// 更新関数は新しいインスタンスを返す
export const movePosition = (
  pos: Position,
  dx: number,
  dy: number,
  dz: number
): Position => ({
  x: pos.x + dx,
  y: pos.y + dy,
  z: pos.z + dz
})

const pos1 = Position({ x: 0, y: 0, z: 0 })
const pos2 = movePosition(pos1, 1, 0, 0)

console.log(pos1 === pos2)  // false - 異なるインスタンス
console.log(Data.equals(pos1, pos2))  // false - 異なる値
```

### 3.2 永続データ構造

```typescript
import { HashMap, HashSet, List, Chunk } from "effect"

// 永続データ構造

// 永続ハッシュマップ
export const createInventory = () =>
  HashMap.empty<ItemId, ItemStack>()
    .pipe(HashMap.set("sword", { count: 1, durability: 100 }))
    .pipe(HashMap.set("shield", { count: 1, durability: 50 }))

// 元のマップは変更されない
export const updateInventory = (
  inventory: HashMap.HashMap<ItemId, ItemStack>,
  itemId: ItemId,
  stack: ItemStack
) => HashMap.set(inventory, itemId, stack)

// 永続リスト
export const createQuestLog = (quests: Quest[]) =>
  quests.reduce(
    (log, quest) => List.prepend(log, quest),
    List.empty<Quest>()
  )

// 永続セット
export const createAchievements = (achievements: AchievementId[]) =>
  achievements.reduce(
    (set, achievement) => HashSet.add(set, achievement),
    HashSet.empty<AchievementId>()
  )

// Chunk - 高性能な不変配列
export const createEntityBuffer = (entities: Entity[]) =>
  Chunk.fromIterable(entities)
```

## 4. 関数合成パターン

### 4.1 パイプラインによる合成

```typescript
import { pipe, flow } from "effect/Function"

// パイプラインによる変換の連鎖
export const processPlayerInput = (input: RawInput) =>
  pipe(
    input,
    validateInput,
    normalizeInput,
    applyDeadzone,
    scaleToWorldCoordinates,
    clampToValidRange
  )

// flow による関数合成
export const composedTransform = flow(
  validateInput,
  normalizeInput,
  applyDeadzone,
  scaleToWorldCoordinates,
  clampToValidRange
)
```

### 4.2 Effect の合成

```typescript
// Effect の合成パターン

// 逐次実行
export const sequential = <A, B, C>(
  effectA: Effect.Effect<A>,
  effectB: (a: A) => Effect.Effect<B>,
  effectC: (b: B) => Effect.Effect<C>,
  combine: (a: A, b: B, c: C) => any
) =>
  Effect.gen(function* () {
    const a = yield* effectA
    const b = yield* effectB(a)
    const c = yield* effectC(b)
    return combine(a, b, c)
  })

// 並列実行
export const parallel = <A, B, C>(
  effectA: Effect.Effect<A>,
  effectB: Effect.Effect<B>,
  effectC: Effect.Effect<C>
) =>
  Effect.all({
    a: effectA,
    b: effectB,
    c: effectC
  })

// 条件分岐
export const conditional = (condition: boolean) =>
  condition
    ? Effect.succeed("true branch")
    : Effect.succeed("false branch")

// エラーハンドリング付き合成
export const withErrorHandling = <A>(
  riskyOperation: Effect.Effect<A, NetworkError>,
  defaultValue: A,
  fallbackValue: A
) =>
  pipe(
    riskyOperation,
    Effect.catchTag("NetworkError", () =>
      Effect.succeed(defaultValue)
    ),
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* logError(error)
        return fallbackValue
      })
    )
  )
```

## 5. 高階関数パターン

### 5.1 マップ・フィルター・リデュース

```typescript
// 高階関数パターン

// マップ: 変換
export const mapEntities = <A, B>(
  entities: ReadonlyArray<A>,
  transform: (a: A) => B
): ReadonlyArray<B> =>
  entities.map(transform)

// フィルター: 選択
export const filterActive = <T extends { active: boolean }>(
  items: ReadonlyArray<T>
): ReadonlyArray<T> =>
  items.filter(item => item.active)

// リデュース: 集約
export const totalDamage = (
  attacks: ReadonlyArray<Attack>
): number =>
  attacks.reduce((total, attack) => total + attack.damage, 0)

// Effect版の高階関数
export const mapEffect = <A, B, E, R>(
  items: ReadonlyArray<A>,
  f: (a: A) => Effect.Effect<B, E, R>
): Effect.Effect<ReadonlyArray<B>, E, R> =>
  Effect.forEach(items, f)

export const filterEffect = <A, E, R>(
  items: ReadonlyArray<A>,
  predicate: (a: A) => Effect.Effect<boolean, E, R>
): Effect.Effect<ReadonlyArray<A>, E, R> =>
  Effect.gen(function* () {
    const results: A[] = []
    for (const item of items) {
      if (yield* predicate(item)) {
        results.push(item)
      }
    }
    return results
  })
```

### 5.2 カリー化と部分適用

```typescript
// カリー化と部分適用

// カリー化された関数
export const add = (a: number) => (b: number): number => a + b

export const multiply = (a: number) => (b: number): number => a * b

// 部分適用
export const double = multiply(2)
export const triple = multiply(3)

// より複雑な例
export const createDamageCalculator =
  (baseDamage: number) =>
  (critMultiplier: number) =>
  (defenseReduction: number) =>
  (isCritical: boolean): number => {
    const damage = baseDamage - defenseReduction
    return isCritical ? damage * critMultiplier : damage
  }

// 特定のゲームルール用の計算機
export const normalDamage = createDamageCalculator(10)(2)
export const bossDamage = createDamageCalculator(50)(3)
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
