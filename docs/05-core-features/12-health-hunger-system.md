# Health & Hunger System（体力・飢餓システム）

## 概要

プレイヤーの生存を管理するMinecraftの中核システムです。体力（Health）と飢餓（Hunger）の2つの主要指標を通じて、プレイヤーのサバイバル体験を提供します。

## アーキテクチャ設計

### Schema定義

```typescript
import { Schema } from "effect"

// 体力・飢餓の基本構造
export const PlayerVitals = Schema.Struct({
  // 体力システム（20ハート = 40HP）
  health: Schema.Struct({
    current: Schema.Number.pipe(Schema.min(0), Schema.max(40)),
    maximum: Schema.Number.pipe(Schema.default(() => 40)),
    lastDamageTime: Schema.Number.pipe(Schema.default(() => 0)),
    invulnerabilityTicks: Schema.Number.pipe(Schema.default(() => 0))
  }),

  // 飢餓システム（20ポイント）
  hunger: Schema.Struct({
    foodLevel: Schema.Number.pipe(Schema.min(0), Schema.max(20)),
    saturationLevel: Schema.Number.pipe(Schema.min(0), Schema.max(20)),
    exhaustionLevel: Schema.Number.pipe(Schema.min(0), Schema.max(4))
  }),

  // 状態管理
  status: Schema.Struct({
    isRegenerating: Schema.Boolean.pipe(Schema.default(() => false)),
    isStarving: Schema.Boolean.pipe(Schema.default(() => false)),
    lastHealTime: Schema.Number.pipe(Schema.default(() => 0)),
    lastDamageSource: Schema.optional(Schema.String)
  })
})

export type PlayerVitals = Schema.Schema.Type<typeof PlayerVitals>

// ダメージソース定義
export const DamageSource = Schema.Union(
  Schema.Literal("fall"),          // 落下ダメージ
  Schema.Literal("drowning"),      // 溺死
  Schema.Literal("fire"),          // 炎上
  Schema.Literal("lava"),          // 溶岩
  Schema.Literal("starvation"),    // 飢餓
  Schema.Literal("poison"),        // 毒
  Schema.Literal("wither"),        // ウィザー効果
  Schema.Literal("void"),          // 奈落
  Schema.Literal("explosion"),     // 爆発
  Schema.Literal("projectile"),    // 飛び道具
  Schema.Literal("mob_attack"),    // モブ攻撃
  Schema.Literal("player_attack"), // プレイヤー攻撃
  Schema.Literal("environmental") // 環境ダメージ
)

export type DamageSource = Schema.Schema.Type<typeof DamageSource>

// ダメージイベント
export const DamageEvent = Schema.Struct({
  _tag: Schema.Literal("DamageEvent"),
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  source: DamageSource,
  amount: Schema.Number.pipe(Schema.positive()),
  position: Position,
  timestamp: Schema.DateTimeUtc,
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

export type DamageEvent = Schema.Schema.Type<typeof DamageEvent>

// 回復イベント
export const HealingEvent = Schema.Struct({
  _tag: Schema.Literal("HealingEvent"),
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  source: Schema.Union(
    Schema.Literal("natural"),      // 自然回復
    Schema.Literal("food"),         // 食べ物
    Schema.Literal("potion"),       // ポーション
    Schema.Literal("golden_apple"), // 金りんご
    Schema.Literal("beacon"),       // ビーコン
    Schema.Literal("bed")          // ベッド
  ),
  amount: Schema.Number.pipe(Schema.positive()),
  timestamp: Schema.DateTimeUtc
})

export type HealingEvent = Schema.Schema.Type<typeof HealingEvent>

// 食べ物アイテム定義
export const FoodItem = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("FoodItemId")),
  name: Schema.String,
  hungerRestore: Schema.Number.pipe(Schema.min(0), Schema.max(20)),
  saturationModifier: Schema.Number.pipe(Schema.min(0), Schema.max(2)),
  alwaysEdible: Schema.Boolean.pipe(Schema.default(() => false)),
  eatDurationTicks: Schema.Number.pipe(Schema.default(() => 32)),
  effects: Schema.Array(
    Schema.Struct({
      effectType: Schema.String,
      duration: Schema.Number,
      amplifier: Schema.Number,
      probability: Schema.Number.pipe(Schema.min(0), Schema.max(1))
    })
  ).pipe(Schema.default(() => []))
})

export type FoodItem = Schema.Schema.Type<typeof FoodItem>
```

### Service定義

```typescript
// Health & Hunger Service Interface
export interface HealthHungerServiceInterface {
  // 体力管理
  readonly getCurrentHealth: (playerId: string) =>
    Effect.Effect<number, PlayerNotFoundError>
  readonly setHealth: (playerId: string, health: number) =>
    Effect.Effect<void, PlayerNotFoundError | InvalidHealthError>
  readonly damagePlayer: (playerId: string, damage: number, source: DamageSource) =>
    Effect.Effect<boolean, PlayerNotFoundError | DamageApplicationError> // true = 死亡
  readonly healPlayer: (playerId: string, amount: number, source: string) =>
    Effect.Effect<void, PlayerNotFoundError | HealingError>

  // 飢餓管理
  readonly getCurrentHunger: (playerId: string) =>
    Effect.Effect<{ foodLevel: number; saturationLevel: number }, PlayerNotFoundError>
  readonly addHunger: (playerId: string, food: number, saturation: number) =>
    Effect.Effect<void, PlayerNotFoundError>
  readonly addExhaustion: (playerId: string, exhaustion: number) =>
    Effect.Effect<void, PlayerNotFoundError>

  // 食べ物システム
  readonly feedPlayer: (playerId: string, foodItem: FoodItem) =>
    Effect.Effect<boolean, PlayerNotFoundError | FeedingError> // true = 食べた
  readonly canEat: (playerId: string, foodItem: FoodItem) =>
    Effect.Effect<boolean, PlayerNotFoundError>

  // 状態管理
  readonly getPlayerVitals: (playerId: string) =>
    Effect.Effect<PlayerVitals, PlayerNotFoundError>
  readonly updateVitals: (playerId: string, deltaTime: number) =>
    Effect.Effect<void, PlayerNotFoundError>
  readonly isPlayerAlive: (playerId: string) =>
    Effect.Effect<boolean, PlayerNotFoundError>
}

export const HealthHungerService = Context.GenericTag<HealthHungerServiceInterface>("@app/HealthHungerService")
```

### 実装パターン

```typescript
// Health & Hunger Service実装
export const HealthHungerServiceLive = Layer.effect(
  HealthHungerService,
  Effect.gen(function* () {
    const playerStates = yield* Ref.make(new Map<string, PlayerVitals>())
    const gameTime = yield* GameTimeService

    return HealthHungerService.of({
      damagePlayer: (playerId, damage, source) =>
        Effect.gen(function* () {
          const states = yield* Ref.get(playerStates)
          const currentVitals = states.get(playerId)

          if (!currentVitals) {
            return yield* Effect.fail(new PlayerNotFoundError({ playerId }))
          }

          // 無敵時間チェック
          const currentTime = yield* gameTime.getCurrentTick()
          if (currentTime - currentVitals.health.lastDamageTime < currentVitals.health.invulnerabilityTicks) {
            return false // ダメージなし
          }

          // ダメージ計算とクランプ
          const newHealth = Math.max(0, currentVitals.health.current - damage)
          const isDead = newHealth === 0

          // 状態更新
          const updatedVitals: PlayerVitals = {
            ...currentVitals,
            health: {
              ...currentVitals.health,
              current: newHealth,
              lastDamageTime: currentTime,
              invulnerabilityTicks: isDead ? 0 : 10 // 0.5秒の無敵時間
            },
            status: {
              ...currentVitals.status,
              lastDamageSource: source,
              isRegenerating: false
            }
          }

          yield* Ref.update(playerStates, map => map.set(playerId, updatedVitals))

          // ダメージイベントの発行
          yield* EventBus.publish({
            _tag: "DamageEvent" as const,
            playerId,
            source,
            amount: damage,
            position: yield* PlayerService.getPosition(playerId),
            timestamp: new Date(),
            metadata: { resultingHealth: newHealth, wasFatal: isDead }
          })

          return isDead
        }),

      updateVitals: (playerId, deltaTime) =>
        Effect.gen(function* () {
          const states = yield* Ref.get(playerStates)
          const vitals = states.get(playerId)

          if (!vitals) {
            return yield* Effect.fail(new PlayerNotFoundError({ playerId }))
          }

          const currentTime = yield* gameTime.getCurrentTick()
          let updatedVitals = { ...vitals }

          // 飢餓による疲労蓄積の処理
          if (vitals.hunger.exhaustionLevel >= 4) {
            const newExhaustion = Math.max(0, vitals.hunger.exhaustionLevel - 4)
            const newSaturation = Math.max(0, vitals.hunger.saturationLevel - 1)
            const newFoodLevel = newSaturation === 0 ?
              Math.max(0, vitals.hunger.foodLevel - 1) : vitals.hunger.foodLevel

            updatedVitals.hunger = {
              foodLevel: newFoodLevel,
              saturationLevel: newSaturation,
              exhaustionLevel: newExhaustion
            }
          }

          // 自然回復の処理（満腹度18以上で体力回復）
          if (updatedVitals.hunger.foodLevel >= 18 &&
              updatedVitals.health.current < updatedVitals.health.maximum &&
              currentTime - updatedVitals.status.lastHealTime >= 80) { // 4秒間隔

            updatedVitals.health.current = Math.min(
              updatedVitals.health.maximum,
              updatedVitals.health.current + 1
            )
            updatedVitals.status.lastHealTime = currentTime
            updatedVitals.status.isRegenerating = true

            // 回復時に飢餓値を少し消費
            updatedVitals.hunger.exhaustionLevel = Math.min(4, updatedVitals.hunger.exhaustionLevel + 6)
          }

          // 飢餓ダメージの処理（満腹度0で体力減少）
          if (updatedVitals.hunger.foodLevel === 0 &&
              currentTime - updatedVitals.health.lastDamageTime >= 80) {

            const starvationDamage = 1
            const newHealth = Math.max(1, updatedVitals.health.current - starvationDamage) // 飢餓では死なない（ハードコア除く）

            updatedVitals.health.current = newHealth
            updatedVitals.health.lastDamageTime = currentTime
            updatedVitals.status.isStarving = true
          } else {
            updatedVitals.status.isStarving = false
          }

          yield* Ref.update(playerStates, map => map.set(playerId, updatedVitals))
        }),

      feedPlayer: (playerId, foodItem) =>
        Effect.gen(function* () {
          const canPlayerEat = yield* HealthHungerService.canEat(playerId, foodItem)
          if (!canPlayerEat) {
            return false
          }

          const states = yield* Ref.get(playerStates)
          const vitals = states.get(playerId)

          if (!vitals) {
            return yield* Effect.fail(new PlayerNotFoundError({ playerId }))
          }

          // 満腹度と隠し満腹度の計算
          const newFoodLevel = Math.min(20, vitals.hunger.foodLevel + foodItem.hungerRestore)
          const saturationToAdd = foodItem.hungerRestore * foodItem.saturationModifier * 2
          const newSaturation = Math.min(newFoodLevel, vitals.hunger.saturationLevel + saturationToAdd)

          const updatedVitals: PlayerVitals = {
            ...vitals,
            hunger: {
              ...vitals.hunger,
              foodLevel: newFoodLevel,
              saturationLevel: newSaturation
            }
          }

          yield* Ref.update(playerStates, map => map.set(playerId, updatedVitals))

          // 食べ物効果の適用
          if (foodItem.effects.length > 0) {
            yield* Effect.forEach(foodItem.effects, effect =>
              Effect.gen(function* () {
                const random = yield* Random.next
                if (random < effect.probability) {
                  yield* PotionEffectsService.applyEffect(
                    playerId,
                    effect.effectType,
                    effect.duration,
                    effect.amplifier
                  )
                }
              })
            )
          }

          return true
        })
    })
  })
)
```

## ゲームメカニズム詳細

### 体力システム

#### 基本仕様
- **最大体力**: 20ハート（40HP）
- **無敵時間**: ダメージ後0.5秒間（10tick）
- **自然回復**: 満腹度18以上で4秒ごとに1HP回復

#### ダメージタイプ別仕様

```typescript
// ダメージ計算の実装例
export const calculateDamage = (
  source: DamageSource,
  baseDamage: number,
  playerState: PlayerVitals,
  environment: EnvironmentState
): number => {
  let finalDamage = baseDamage

  switch (source) {
    case "fall":
      // 落下ダメージ = (落下距離 - 3) * 1HP
      finalDamage = Math.max(0, environment.fallDistance - 3)
      break

    case "drowning":
      // 溺死ダメージ = 2HP/秒
      finalDamage = 2
      break

    case "fire":
      // 炎上ダメージ = 1HP/秒
      finalDamage = 1
      break

    case "starvation":
      // 飢餓ダメージ = 1HP/4秒（最低1HPまで）
      finalDamage = playerState.health.current > 1 ? 1 : 0
      break
  }

  return Math.floor(finalDamage)
}
```

### 飢餓システム

#### 疲労蓄積ルール
```typescript
export const addExhaustionForAction = (
  action: PlayerAction,
  currentExhaustion: number
): number => {
  const exhaustionMap: Record<string, number> = {
    "sprint": 0.1,        // スプリント走行（メートルあたり）
    "jump": 0.05,         // ジャンプ
    "swim": 0.01,         // 水泳
    "break_block": 0.005, // ブロック破壊
    "attack": 0.1,        // 攻撃
    "take_damage": 0.1,   // ダメージを受ける
    "heal": 6.0           // 自然回復時
  }

  return Math.min(4, currentExhaustion + (exhaustionMap[action] || 0))
}
```

### 食べ物データベース

```typescript
export const FOOD_ITEMS: Record<string, FoodItem> = {
  apple: {
    id: "apple",
    name: "Apple",
    hungerRestore: 4,
    saturationModifier: 0.3,
    alwaysEdible: false,
    eatDurationTicks: 32,
    effects: []
  },

  golden_apple: {
    id: "golden_apple",
    name: "Golden Apple",
    hungerRestore: 4,
    saturationModifier: 1.2,
    alwaysEdible: true,
    eatDurationTicks: 32,
    effects: [
      { effectType: "regeneration", duration: 100, amplifier: 1, probability: 1.0 },
      { effectType: "absorption", duration: 2400, amplifier: 0, probability: 1.0 }
    ]
  },

  bread: {
    id: "bread",
    name: "Bread",
    hungerRestore: 5,
    saturationModifier: 0.6,
    alwaysEdible: false,
    eatDurationTicks: 32,
    effects: []
  },

  cooked_beef: {
    id: "cooked_beef",
    name: "Steak",
    hungerRestore: 8,
    saturationModifier: 0.8,
    alwaysEdible: false,
    eatDurationTicks: 32,
    effects: []
  }
}
```

## UI統合

### Health & Hunger表示
```typescript
export const HealthHungerUI = () => {
  const [vitals, setVitals] = useState<PlayerVitals | null>(null)

  useEffect(() => {
    const updateVitals = async () => {
      const healthHungerService = await HealthHungerService
      const playerVitals = await healthHungerService.getPlayerVitals("main_player").pipe(
        Effect.runPromise
      )
      setVitals(playerVitals)
    }

    const interval = setInterval(updateVitals, 100) // 5FPSで更新
    return () => clearInterval(interval)
  }, [])

  if (!vitals) return null

  return (
    <div className="health-hunger-display">
      {/* ハート表示 */}
      <div className="hearts">
        {Array.from({ length: 10 }, (_, i) => (
          <HeartIcon
            key={i}
            filled={vitals.health.current > i * 2}
            halfFilled={vitals.health.current === i * 2 + 1}
          />
        ))}
      </div>

      {/* 飢餓ゲージ表示 */}
      <div className="hunger">
        {Array.from({ length: 10 }, (_, i) => (
          <HungerIcon
            key={i}
            filled={vitals.hunger.foodLevel > i * 2}
            halfFilled={vitals.hunger.foodLevel === i * 2 + 1}
          />
        ))}
      </div>
    </div>
  )
}
```

## パフォーマンス考慮事項

### 最適化戦略
- **バッチ更新**: 複数プレイヤーの状態を並行更新
- **変更検出**: 値が変化した場合のみUI更新
- **ティック最適化**: 重要でない計算を低頻度で実行

```typescript
export const optimizedVitalsUpdate = (
  playerIds: ReadonlyArray<string>,
  deltaTime: number
) => Effect.gen(function* () {
  // 並行処理でバッチ更新
  yield* Effect.forEach(
    playerIds,
    (playerId) => HealthHungerService.updateVitals(playerId, deltaTime),
    { concurrency: 8 } // 8プレイヤー並行
  )
})
```

## テスト戦略

```typescript
describe("Health & Hunger System", () => {
  const TestLayer = Layer.mergeAll(
    HealthHungerServiceLive,
    TestPlayerServiceLayer,
    TestGameTimeLayer
  )

  test("プレイヤーは満腹時に自然回復する", () =>
    Effect.gen(function* () {
      const service = yield* HealthHungerService

      // 満腹状態のプレイヤーを作成
      yield* service.setHealth("test-player", 10)
      yield* service.addHunger("test-player", 20, 20) // 満腹

      // 4秒経過をシミュレート
      yield* TestClock.adjust("4 seconds")
      yield* service.updateVitals("test-player", 4000)

      const health = yield* service.getCurrentHealth("test-player")
      expect(health).toBe(11) // 1HP回復
    }).pipe(Effect.provide(TestLayer)))

  test("飢餓時にはダメージを受ける", () =>
    Effect.gen(function* () {
      const service = yield* HealthHungerService

      // 飢餓状態のプレイヤーを作成
      yield* service.setHealth("test-player", 10)
      yield* service.addHunger("test-player", 0, 0) // 飢餓

      // 4秒経過
      yield* TestClock.adjust("4 seconds")
      yield* service.updateVitals("test-player", 4000)

      const health = yield* service.getCurrentHealth("test-player")
      expect(health).toBe(9) // 1HP減少
    }))
})
```

## 次の統合システム

本システムは以下のシステムとの統合が必要です：
- **Combat System**: ダメージソース・戦闘ダメージ
- **Death System**: 死亡判定・リスポーン
- **Potion Effects**: 効果による体力・飢餓への影響
- **Player System**: 移動・アクションと疲労の連携
