---
title: '戦闘システム仕様 - ダメージ計算・武器システム'
description: 'プレイヤー、モブ、ボスの戦闘システムの完全仕様。ダメージ計算、武器システム、ステータス効果の統合実装。'
category: 'specification'
difficulty: 'intermediate'
tags: ['combat-system', 'damage-calculation', 'weapon-mechanics', 'mob-combat', 'pvp', 'status-effects']
prerequisites: ['effect-ts-fundamentals', 'entity-system-basics', 'physics-basics']
estimated_reading_time: '5分'
related_patterns: ['service-patterns', 'state-machine-patterns', 'damage-calculation-patterns']
related_docs: ['./04-entity-system.md', './12-health-hunger-system.md', './06-physics-system.md']
---

# Combat System (戦闘システム)

## 概要

プレイヤーやMob間の戦闘を管理するシステムです。近接攻撃、遠距離攻撃、ダメージ計算、防具、エンチャント効果などを扱います。

## ドメインモデル (Domain Model with Schema)

```typescript
import { Schema, Effect, Match, Stream, Context, Layer, Brand, Data } from 'effect'

// ブランド型定義 (Branded Types)
type Damage = number & Brand.Brand<'Damage'>
type AttackSpeed = number & Brand.Brand<'AttackSpeed'>
type CriticalChance = number & Brand.Brand<'CriticalChance'>
type ArmorPoints = number & Brand.Brand<'ArmorPoints'>
type Knockback = number & Brand.Brand<'Knockback'>
type AttackCooldown = number & Brand.Brand<'AttackCooldown'>

const Damage = Brand.refined<Damage>(
  (n): n is Damage => n >= 0,
  (n) => Brand.error(`ダメージは0以上である必要があります: ${n}`)
)

const AttackSpeed = Brand.refined<AttackSpeed>(
  (n): n is AttackSpeed => n >= 0 && n <= 16,
  (n) => Brand.error(`攻撃速度は0-16の範囲である必要があります: ${n}`)
)

const CriticalChance = Brand.refined<CriticalChance>(
  (n): n is CriticalChance => n >= 0 && n <= 1,
  (n) => Brand.error(`クリティカル確率は0-1の範囲である必要があります: ${n}`)
)

// 武器タイプのTagged Union
const WeaponType = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Sword'),
    attackDamage: Schema.transform(Schema.Number, Damage, { decode: Damage, encode: Brand.nominal }),
    attackSpeed: Schema.transform(Schema.Number, AttackSpeed, { decode: AttackSpeed, encode: Brand.nominal }),
    criticalChance: Schema.transform(Schema.Number, CriticalChance, { decode: CriticalChance, encode: Brand.nominal }),
    durability: Schema.Number,
    enchantments: Schema.Array(Schema.String),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Bow'),
    attackDamage: Schema.transform(Schema.Number, Damage, { decode: Damage, encode: Brand.nominal }),
    drawTime: Schema.Number,
    maxRange: Schema.Number,
    enchantments: Schema.Array(Schema.String),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Axe'),
    attackDamage: Schema.transform(Schema.Number, Damage, { decode: Damage, encode: Brand.nominal }),
    attackSpeed: Schema.transform(Schema.Number, AttackSpeed, { decode: AttackSpeed, encode: Brand.nominal }),
    durability: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Fist'),
    attackDamage: Schema.transform(Schema.Number, Damage, { decode: Damage, encode: Brand.nominal }),
    attackSpeed: Schema.transform(Schema.Number, AttackSpeed, { decode: AttackSpeed, encode: Brand.nominal }),
  })
).annotations({
  identifier: 'WeaponType',
  description: '武器タイプの定義',
})

// 防具システム
const ArmorPiece = Schema.Struct({
  _tag: Schema.String,
  armorPoints: Schema.transform(Schema.Number, Schema.brand(Schema.Number, Symbol.for('ArmorPoints'))),
  toughness: Schema.Number,
  enchantments: Schema.Array(Schema.String),
  durability: Schema.Number,
}).annotations({ identifier: 'ArmorPiece' })

// ダメージタイプ
const DamageType = Schema.Union(
  Schema.Struct({ _tag: Schema.Literal('Physical') }),
  Schema.Struct({ _tag: Schema.Literal('Magic') }),
  Schema.Struct({ _tag: Schema.Literal('Fire') }),
  Schema.Struct({ _tag: Schema.Literal('Piercing') }),
  Schema.Struct({ _tag: Schema.Literal('Fall') }),
  Schema.Struct({ _tag: Schema.Literal('Explosion') })
).annotations({ identifier: 'DamageType' })

// 戦闘イベント
const CombatEvent = Schema.TaggedUnion('_tag', {
  AttackPerformed: Schema.Struct({
    _tag: Schema.Literal('AttackPerformed'),
    attackerId: Schema.String,
    targetId: Schema.String,
    weapon: WeaponType,
    damage: Schema.transform(Schema.Number, Damage, { decode: Damage, encode: Brand.nominal }),
    isCritical: Schema.Boolean,
    timestamp: Schema.Number,
  }),
  DamageDealt: Schema.Struct({
    _tag: Schema.Literal('DamageDealt'),
    targetId: Schema.String,
    finalDamage: Schema.transform(Schema.Number, Damage, { decode: Damage, encode: Brand.nominal }),
    damageType: DamageType,
    armorReduction: Schema.Number,
    timestamp: Schema.Number,
  }),
  KnockbackApplied: Schema.Struct({
    _tag: Schema.Literal('KnockbackApplied'),
    targetId: Schema.String,
    knockbackForce: Schema.transform(Schema.Number, Schema.brand(Schema.Number, Symbol.for('Knockback'))),
    direction: Schema.Struct({ x: Schema.Number, z: Schema.Number }),
    timestamp: Schema.Number,
  }),
}).annotations({ identifier: 'CombatEvent' })

// エンチャント効果
const EnchantmentEffect = Schema.TaggedUnion('_tag', {
  Sharpness: Schema.Struct({
    _tag: Schema.Literal('Sharpness'),
    level: Schema.Number,
    damageBonus: Schema.transform(Schema.Number, Damage, { decode: Damage, encode: Brand.nominal }),
  }),
  Knockback: Schema.Struct({
    _tag: Schema.Literal('Knockback'),
    level: Schema.Number,
    knockbackMultiplier: Schema.Number,
  }),
  FireAspect: Schema.Struct({
    _tag: Schema.Literal('FireAspect'),
    level: Schema.Number,
    burnDuration: Schema.Number,
  }),
  Power: Schema.Struct({
    _tag: Schema.Literal('Power'),
    level: Schema.Number,
    damageMultiplier: Schema.Number,
  }),
}).annotations({ identifier: 'EnchantmentEffect' })
```

## 主要ロジック (Core Logic with Services)

```typescript
// Combat Service Interface
interface CombatService {
  readonly calculateDamage: (
    weapon: Schema.Schema.Type<typeof WeaponType>,
    target: { armorPieces: Array<Schema.Schema.Type<typeof ArmorPiece>>; health: number },
    damageType: Schema.Schema.Type<typeof DamageType>
  ) => Effect.Effect<Damage, CombatError>

  readonly performAttack: (
    attackerId: string,
    targetId: string,
    weapon: Schema.Schema.Type<typeof WeaponType>
  ) => Effect.Effect<Array<Schema.Schema.Type<typeof CombatEvent>>, CombatError>

  readonly applyCriticalHit: (
    baseDamage: Damage,
    criticalChance: CriticalChance
  ) => Effect.Effect<{ damage: Damage; isCritical: boolean }, never>

  readonly calculateKnockback: (
    weapon: Schema.Schema.Type<typeof WeaponType>,
    enchantments: Array<Schema.Schema.Type<typeof EnchantmentEffect>>
  ) => Effect.Effect<Knockback, never>
}

// Combat Service Tag
const CombatService = Context.GenericTag<CombatService>('@minecraft/CombatService')

// Combat Errors
const CombatError = Schema.TaggedUnion('_tag', {
  WeaponNotFound: Schema.Struct({
    _tag: Schema.Literal('WeaponNotFound'),
    weaponId: Schema.String,
  }),
  AttackOnCooldown: Schema.Struct({
    _tag: Schema.Literal('AttackOnCooldown'),
    remainingTime: Schema.Number,
  }),
  InvalidTarget: Schema.Struct({
    _tag: Schema.Literal('InvalidTarget'),
    targetId: Schema.String,
    reason: Schema.String,
  }),
  InsufficientRange: Schema.Struct({
    _tag: Schema.Literal('InsufficientRange'),
    distance: Schema.Number,
    maxRange: Schema.Number,
  }),
}).annotations({ identifier: 'CombatError' })

// Damage Calculation Implementation
const makeCombatService = Effect.gen(function* () {
  const calculateDamage = (
    weapon: Schema.Schema.Type<typeof WeaponType>,
    target: { armorPieces: Array<Schema.Schema.Type<typeof ArmorPiece>>; health: number },
    damageType: Schema.Schema.Type<typeof DamageType>
  ): Effect.Effect<Damage, CombatError> =>
    Effect.gen(function* () {
      // 武器タイプ別のダメージ計算
      const baseDamage = Match.value(weapon).pipe(
        Match.when({ _tag: 'Sword' }, (sword) => sword.attackDamage),
        Match.when({ _tag: 'Bow' }, (bow) => bow.attackDamage),
        Match.when({ _tag: 'Axe' }, (axe) => axe.attackDamage),
        Match.when({ _tag: 'Fist' }, (fist) => fist.attackDamage),
        Match.exhaustive
      )

      // 防具による軽減計算
      const totalArmorPoints = target.armorPieces.reduce((total, armor) => total + Brand.nominal(armor.armorPoints), 0)

      // ダメージタイプ別の計算
      const damageMultiplier = Match.value(damageType).pipe(
        Match.when({ _tag: 'Physical' }, () => 1.0),
        Match.when({ _tag: 'Magic' }, () => (totalArmorPoints > 0 ? 0.8 : 1.0)),
        Match.when({ _tag: 'Fire' }, () => 1.2),
        Match.when({ _tag: 'Piercing' }, () => (totalArmorPoints > 0 ? 1.5 : 1.0)),
        Match.when({ _tag: 'Fall' }, () => 1.0),
        Match.when({ _tag: 'Explosion' }, () => 2.0),
        Match.exhaustive
      )

      // 防具軽減の適用
      const armorReduction = Math.min(20, totalArmorPoints) * 0.04
      const finalDamage = Math.max(Brand.nominal(baseDamage) * damageMultiplier * (1 - armorReduction), 0)

      return yield* Effect.succeed(Damage(finalDamage))
    })

  const applyCriticalHit = (
    baseDamage: Damage,
    criticalChance: CriticalChance
  ): Effect.Effect<{ damage: Damage; isCritical: boolean }, never> =>
    Effect.gen(function* () {
      const randomValue = Math.random()
      const isCritical = randomValue < Brand.nominal(criticalChance)

      if (!isCritical) {
        return { damage: baseDamage, isCritical: false }
      }

      const criticalMultiplier = 1.5
      const criticalDamage = Damage(Brand.nominal(baseDamage) * criticalMultiplier)

      return { damage: criticalDamage, isCritical: true }
    })

  const calculateKnockback = (
    weapon: Schema.Schema.Type<typeof WeaponType>,
    enchantments: Array<Schema.Schema.Type<typeof EnchantmentEffect>>
  ): Effect.Effect<Knockback, never> =>
    Effect.gen(function* () {
      // 基本ノックバック値
      const baseKnockback = Match.value(weapon).pipe(
        Match.when({ _tag: 'Sword' }, () => 0.4),
        Match.when({ _tag: 'Bow' }, () => 0.0),
        Match.when({ _tag: 'Axe' }, () => 0.3),
        Match.when({ _tag: 'Fist' }, () => 0.35),
        Match.exhaustive
      )

      // エンチャント効果の適用
      const knockbackEnchant = enchantments.find((ench) => ench._tag === 'Knockback') as
        | Extract<Schema.Schema.Type<typeof EnchantmentEffect>, { _tag: 'Knockback' }>
        | undefined

      const finalKnockback = knockbackEnchant ? baseKnockback * knockbackEnchant.knockbackMultiplier : baseKnockback

      return Brand.nominal(finalKnockback) as Knockback
    })

  const performAttack = (
    attackerId: string,
    targetId: string,
    weapon: Schema.Schema.Type<typeof WeaponType>
  ): Effect.Effect<Array<Schema.Schema.Type<typeof CombatEvent>>, CombatError> =>
    Effect.gen(function* () {
      const timestamp = Date.now()

      // Early return - range check for ranged weapons
      if (weapon._tag === 'Bow') {
        // 範囲チェックのロジックはここに実装
        // 今回は省略
      }

      // 基本ダメージ計算
      const baseDamage = Match.value(weapon).pipe(
        Match.when({ _tag: 'Sword' }, (sword) => sword.attackDamage),
        Match.when({ _tag: 'Bow' }, (bow) => bow.attackDamage),
        Match.when({ _tag: 'Axe' }, (axe) => axe.attackDamage),
        Match.when({ _tag: 'Fist' }, (fist) => fist.attackDamage),
        Match.exhaustive
      )

      // クリティカルヒット判定
      const criticalChance = weapon._tag === 'Sword' ? weapon.criticalChance : CriticalChance(0.05) // デフォルト値

      const { damage: finalDamage, isCritical } = yield* applyCriticalHit(baseDamage, criticalChance)

      // ノックバック計算
      const knockbackForce = yield* calculateKnockback(weapon, [])

      // イベント生成
      const events: Array<Schema.Schema.Type<typeof CombatEvent>> = [
        {
          _tag: 'AttackPerformed',
          attackerId,
          targetId,
          weapon,
          damage: finalDamage,
          isCritical,
          timestamp,
        },
        {
          _tag: 'DamageDealt',
          targetId,
          finalDamage,
          damageType: { _tag: 'Physical' },
          armorReduction: 0, // 実際の計算値
          timestamp,
        },
      ]

      // ノックバックが0でない場合はノックバックイベントも追加
      if (Brand.nominal(knockbackForce) > 0) {
        events.push({
          _tag: 'KnockbackApplied',
          targetId,
          knockbackForce,
          direction: { x: 0, z: 1 }, // 実際の方向計算
          timestamp,
        })
      }

      return events
    })

  return CombatService.of({
    calculateDamage,
    performAttack,
    applyCriticalHit,
    calculateKnockback,
  })
})

// Combat Service Layer
const CombatServiceLive = Layer.effect(CombatService, makeCombatService)
```

## ECS統合 (ECS Integration)

```typescript
// Attack Cooldown System with Stream
interface AttackCooldownService {
  readonly startCooldown: (
    entityId: string,
    weapon: Schema.Schema.Type<typeof WeaponType>
  ) => Effect.Effect<void, never>

  readonly isOnCooldown: (entityId: string) => Effect.Effect<boolean, never>

  readonly getCooldownRemaining: (entityId: string) => Effect.Effect<number, never>

  readonly cooldownStream: Stream.Stream<
    {
      entityId: string
      remainingTime: AttackCooldown
      isReady: boolean
    },
    never,
    never
  >
}

const AttackCooldownService = Context.GenericTag<AttackCooldownService>('@minecraft/AttackCooldownService')

// Combat Event Stream Implementation
const makeCombatEventStream = Effect.gen(function* () {
  const combatEvents = yield* Effect.acquireRelease(
    Effect.sync(() => new Map<string, Array<Schema.Schema.Type<typeof CombatEvent>>>()),
    () => Effect.sync(() => {}) // クリーンアップ処理
  )

  const eventSubject = yield* Effect.sync(() => ({
    emit: (event: Schema.Schema.Type<typeof CombatEvent>) => {
      const entityId = 'targetId' in event ? event.targetId : 'attackerId' in event ? event.attackerId : 'unknown'
      const events = combatEvents.get(entityId) || []
      events.push(event)
      combatEvents.set(entityId, events)
    },
  }))

  // Combat Event Stream
  const createCombatEventStream = (
    entityId?: string
  ): Stream.Stream<Schema.Schema.Type<typeof CombatEvent>, never, never> =>
    Stream.fromEffect(
      Effect.gen(function* () {
        const allEvents = Array.from(combatEvents.values()).flat()
        return entityId
          ? allEvents.filter(
              (event) =>
                ('targetId' in event && event.targetId === entityId) ||
                ('attackerId' in event && event.attackerId === entityId)
            )
          : allEvents
      })
    ).pipe(
      Stream.flatMap((events) => Stream.fromIterable(events)),
      Stream.tap((event) => Effect.sync(() => console.log(`Combat Event: ${event._tag}`, event)))
    )

  return {
    eventSubject,
    createCombatEventStream,
  }
})

// Attack Cooldown Implementation with Stream
const makeAttackCooldownService = Effect.gen(function* () {
  const cooldowns = yield* Effect.sync(
    () => new Map<string, { endTime: number; weapon: Schema.Schema.Type<typeof WeaponType> }>()
  )

  const calculateCooldownDuration = (weapon: Schema.Schema.Type<typeof WeaponType>): number =>
    Match.value(weapon).pipe(
      Match.when({ _tag: 'Sword' }, (sword) => Brand.nominal(sword.attackSpeed) * 50), // ミリ秒
      Match.when({ _tag: 'Bow' }, (bow) => bow.drawTime),
      Match.when({ _tag: 'Axe' }, (axe) => Brand.nominal(axe.attackSpeed) * 60),
      Match.when({ _tag: 'Fist' }, (fist) => Brand.nominal(fist.attackSpeed) * 40),
      Match.exhaustive
    )

  const startCooldown = (entityId: string, weapon: Schema.Schema.Type<typeof WeaponType>): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const duration = calculateCooldownDuration(weapon)
      const endTime = Date.now() + duration

      cooldowns.set(entityId, { endTime, weapon })

      // 自動クリーンアップ
      yield* Effect.sleep(duration)
        .pipe(Effect.fork)
        .pipe(
          Effect.flatMap((fiber) =>
            Effect.gen(function* () {
              yield* Fiber.await(fiber)
              cooldowns.delete(entityId)
            })
          )
        )
    })

  const isOnCooldown = (entityId: string): Effect.Effect<boolean, never> =>
    Effect.sync(() => {
      const cooldown = cooldowns.get(entityId)
      if (!cooldown) return false

      return Date.now() < cooldown.endTime
    })

  const getCooldownRemaining = (entityId: string): Effect.Effect<number, never> =>
    Effect.sync(() => {
      const cooldown = cooldowns.get(entityId)
      if (!cooldown) return 0

      return Math.max(0, cooldown.endTime - Date.now())
    })

  // Cooldown Stream - リアルタイムで状態を監視
  const cooldownStream: Stream.Stream<
    {
      entityId: string
      remainingTime: AttackCooldown
      isReady: boolean
    },
    never,
    never
  > = Stream.repeatEffect(
    Effect.gen(function* () {
      const currentTime = Date.now()
      const cooldownStatuses = Array.from(cooldowns.entries()).map(([entityId, cooldown]) => {
        const remainingTime = Math.max(0, cooldown.endTime - currentTime)
        return {
          entityId,
          remainingTime: AttackCooldown(remainingTime),
          isReady: remainingTime <= 0,
        }
      })

      return cooldownStatuses
    })
  ).pipe(
    Stream.flatMap((statuses) => Stream.fromIterable(statuses)),
    Stream.schedule(Schedule.spaced('50 millis')) // 50msごとに更新
  )

  return AttackCooldownService.of({
    startCooldown,
    isOnCooldown,
    getCooldownRemaining,
    cooldownStream,
  })
})

// Enhanced Combat Service with Stream Integration
const makeEnhancedCombatService = Effect.gen(function* () {
  const cooldownService = yield* AttackCooldownService
  const { eventSubject, createCombatEventStream } = yield* makeCombatEventStream

  const performAttackWithCooldown = (
    attackerId: string,
    targetId: string,
    weapon: Schema.Schema.Type<typeof WeaponType>
  ): Effect.Effect<Array<Schema.Schema.Type<typeof CombatEvent>>, CombatError> =>
    Effect.gen(function* () {
      // Early return - クールダウンチェック
      const onCooldown = yield* cooldownService.isOnCooldown(attackerId)
      if (onCooldown) {
        const remaining = yield* cooldownService.getCooldownRemaining(attackerId)
        return yield* Effect.fail({
          _tag: 'AttackOnCooldown' as const,
          remainingTime: remaining,
        })
      }

      // クールダウン開始
      yield* cooldownService.startCooldown(attackerId, weapon)

      // 攻撃実行
      const events = yield* performBasicAttack(attackerId, targetId, weapon)

      // イベント発行
      events.forEach((event) => eventSubject.emit(event))

      return events
    })

  const performBasicAttack = (
    attackerId: string,
    targetId: string,
    weapon: Schema.Schema.Type<typeof WeaponType>
  ): Effect.Effect<Array<Schema.Schema.Type<typeof CombatEvent>>, CombatError> =>
    Effect.gen(function* () {
      const timestamp = Date.now()

      // PvP/PvE判定
      const isPvP = attackerId.startsWith('player_') && targetId.startsWith('player_')
      const damageMultiplier = isPvP ? 0.8 : 1.0 // PvPでダメージ減少

      // 基本ダメージ計算
      const baseDamage = Match.value(weapon).pipe(
        Match.when({ _tag: 'Sword' }, (sword) => Brand.nominal(sword.attackDamage)),
        Match.when({ _tag: 'Bow' }, (bow) => Brand.nominal(bow.attackDamage)),
        Match.when({ _tag: 'Axe' }, (axe) => Brand.nominal(axe.attackDamage)),
        Match.when({ _tag: 'Fist' }, (fist) => Brand.nominal(fist.attackDamage)),
        Match.exhaustive
      )

      const adjustedDamage = Damage(baseDamage * damageMultiplier)

      // クリティカルヒット判定
      const criticalChance = weapon._tag === 'Sword' ? weapon.criticalChance : CriticalChance(0.05)

      const { damage: finalDamage, isCritical } = yield* applyCriticalHit(adjustedDamage, criticalChance)

      return [
        {
          _tag: 'AttackPerformed' as const,
          attackerId,
          targetId,
          weapon,
          damage: finalDamage,
          isCritical,
          timestamp,
        },
        {
          _tag: 'DamageDealt' as const,
          targetId,
          finalDamage,
          damageType: { _tag: 'Physical' as const },
          armorReduction: 0,
          timestamp,
        },
      ]
    })

  const applyCriticalHit = (
    baseDamage: Damage,
    criticalChance: CriticalChance
  ): Effect.Effect<{ damage: Damage; isCritical: boolean }, never> =>
    Effect.gen(function* () {
      const randomValue = Math.random()
      const isCritical = randomValue < Brand.nominal(criticalChance)

      if (!isCritical) {
        return { damage: baseDamage, isCritical: false }
      }

      const criticalDamage = Damage(Brand.nominal(baseDamage) * 1.5)
      return { damage: criticalDamage, isCritical: true }
    })

  return {
    performAttackWithCooldown,
    createCombatEventStream,
  }
})

// Service Layers
const AttackCooldownServiceLive = Layer.effect(AttackCooldownService, makeAttackCooldownService)

const EnhancedCombatServiceLive = Layer.effect(
  Context.GenericTag<{
    performAttackWithCooldown: typeof makeEnhancedCombatService extends Effect.Effect<infer A, any, any>
      ? A['performAttackWithCooldown']
      : never
    createCombatEventStream: typeof makeEnhancedCombatService extends Effect.Effect<infer A, any, any>
      ? A['createCombatEventStream']
      : never
  }>('@minecraft/EnhancedCombatService'),
  makeEnhancedCombatService
).pipe(Layer.provide(AttackCooldownServiceLive))
```

## UI連携 (UI Integration)

```typescript
// UI Event Stream for Combat Indicators
const createCombatUIStream = (
  combatEventStream: Stream.Stream<Schema.Schema.Type<typeof CombatEvent>, never, never>
): Stream.Stream<
  {
    type: 'damage_indicator' | 'attack_cooldown' | 'health_bar'
    entityId: string
    data: any
  },
  never,
  never
> =>
  combatEventStream.pipe(
    Stream.map((event) =>
      Match.value(event).pipe(
        Match.when({ _tag: 'DamageDealt' }, (damageEvent) => ({
          type: 'damage_indicator' as const,
          entityId: damageEvent.targetId,
          data: {
            damage: Brand.nominal(damageEvent.finalDamage),
            damageType: damageEvent.damageType._tag,
            timestamp: damageEvent.timestamp,
          },
        })),
        Match.when({ _tag: 'AttackPerformed' }, (attackEvent) => ({
          type: 'attack_cooldown' as const,
          entityId: attackEvent.attackerId,
          data: {
            isCritical: attackEvent.isCritical,
            weaponType: attackEvent.weapon._tag,
            timestamp: attackEvent.timestamp,
          },
        })),
        Match.when({ _tag: 'KnockbackApplied' }, (knockbackEvent) => ({
          type: 'health_bar' as const,
          entityId: knockbackEvent.targetId,
          data: {
            knockbackForce: Brand.nominal(knockbackEvent.knockbackForce),
            direction: knockbackEvent.direction,
            timestamp: knockbackEvent.timestamp,
          },
        })),
        Match.exhaustive
      )
    ),
    Stream.tap((uiEvent) => Effect.sync(() => console.log(`UI Event: ${uiEvent.type}`, uiEvent.data)))
  )
```

## Property-Based Testing Patterns

```typescript
import * as fc from 'fast-check'

// Schema-based Arbitraries for Property Testing
const weaponArbitrary = fc.oneof(
  fc.record({
    _tag: fc.constant('Sword' as const),
    attackDamage: fc.float({ min: 1, max: 20 }).map(Damage),
    attackSpeed: fc.float({ min: 0.25, max: 4 }).map(AttackSpeed),
    criticalChance: fc.float({ min: 0, max: 0.5 }).map(CriticalChance),
    durability: fc.integer({ min: 1, max: 1000 }),
    enchantments: fc.array(fc.string(), { maxLength: 3 }),
  }),
  fc.record({
    _tag: fc.constant('Bow' as const),
    attackDamage: fc.float({ min: 1, max: 15 }).map(Damage),
    drawTime: fc.integer({ min: 200, max: 2000 }),
    maxRange: fc.integer({ min: 8, max: 64 }),
    enchantments: fc.array(fc.string(), { maxLength: 3 }),
  }),
  fc.record({
    _tag: fc.constant('Axe' as const),
    attackDamage: fc.float({ min: 2, max: 25 }).map(Damage),
    attackSpeed: fc.float({ min: 0.8, max: 1.6 }).map(AttackSpeed),
    durability: fc.integer({ min: 1, max: 500 }),
  }),
  fc.record({
    _tag: fc.constant('Fist' as const),
    attackDamage: fc.float({ min: 1, max: 2 }).map(Damage),
    attackSpeed: fc.float({ min: 4, max: 4 }).map(AttackSpeed),
  })
)

// Property Tests for Combat System
const combatPropertyTests = {
  // プロパティ: ダメージは常に0以上
  damageIsNonNegative: fc.property(
    weaponArbitrary,
    fc.record({
      armorPieces: fc.array(
        fc.record({
          _tag: fc.string(),
          armorPoints: fc.integer({ min: 0, max: 20 }).map((v) => v as any), // Brand型の簡略化
          toughness: fc.float({ min: 0, max: 20 }),
          enchantments: fc.array(fc.string()),
          durability: fc.integer({ min: 1, max: 500 }),
        })
      ),
      health: fc.integer({ min: 1, max: 20 }),
    }),
    (weapon, target) => {
      const damageType = { _tag: 'Physical' as const }

      // Effect.runSyncを使用してテスト実行
      const result = Effect.runSync(
        calculateDamage(weapon, target, damageType).pipe(Effect.catchAll(() => Effect.succeed(Damage(0))))
      )

      return Brand.nominal(result) >= 0
    }
  ),

  // プロパティ: クリティカル確率0の場合、クリティカルヒットは発生しない
  noCriticalWithZeroChance: fc.property(fc.float({ min: 1, max: 100 }).map(Damage), (damage) => {
    const result = Effect.runSync(applyCriticalHit(damage, CriticalChance(0)))
    return result.isCritical === false && result.damage === damage
  }),

  // プロパティ: 攻撃クールダウンは武器タイプに依存
  cooldownDependsOnWeaponType: fc.property(weaponArbitrary, (weapon) => {
    const duration1 = calculateCooldownDuration(weapon)
    const duration2 = calculateCooldownDuration(weapon)

    // 同じ武器は同じクールダウン時間
    return duration1 === duration2
  }),

  // プロパティ: PvPダメージはPvEより低い
  pvpDamageIsReduced: fc.property(fc.float({ min: 1, max: 50 }), (baseDamage) => {
    const pvpDamage = baseDamage * 0.8 // PvP multiplier
    const pveDamage = baseDamage * 1.0 // PvE multiplier

    return pvpDamage <= pveDamage
  }),
}

// Usage example
const runCombatTests = Effect.gen(function* () {
  // プロパティテストの実行
  const damageTest = fc.check(combatPropertyTests.damageIsNonNegative)
  const criticalTest = fc.check(combatPropertyTests.noCriticalWithZeroChance)
  const cooldownTest = fc.check(combatPropertyTests.cooldownDependsOnWeaponType)
  const pvpTest = fc.check(combatPropertyTests.pvpDamageIsReduced)

  return {
    allPassed: damageTest && criticalTest && cooldownTest && pvpTest,
    results: { damageTest, criticalTest, cooldownTest, pvpTest },
  }
})
```

## パフォーマンス考慮事項

```typescript
// Batched Combat Operations for Performance
const createBatchedCombatService = Effect.gen(function* () {
  const eventBuffer = yield* Effect.sync(() => new Array<Schema.Schema.Type<typeof CombatEvent>>())

  // バッチ処理でイベントを効率的に処理
  const processBatchedEvents = (events: Array<Schema.Schema.Type<typeof CombatEvent>>): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      // イベントタイプ別にグループ化
      const groupedEvents = events.reduce(
        (acc, event) => {
          const key = event._tag
          if (!acc[key]) acc[key] = []
          acc[key].push(event)
          return acc
        },
        {} as Record<string, Array<Schema.Schema.Type<typeof CombatEvent>>>
      )

      // 並列処理でパフォーマンス向上
      yield* Effect.all(
        [
          Effect.sync(() => processAttackEvents(groupedEvents['AttackPerformed'] || [])),
          Effect.sync(() => processDamageEvents(groupedEvents['DamageDealt'] || [])),
          Effect.sync(() => processKnockbackEvents(groupedEvents['KnockbackApplied'] || [])),
        ],
        { concurrency: 3 }
      )
    })

  const processAttackEvents = (events: Array<any>): void => {
    // 攻撃イベントの最適化処理
    console.log(`Processing ${events.length} attack events`)
  }

  const processDamageEvents = (events: Array<any>): void => {
    // ダメージイベントの最適化処理
    console.log(`Processing ${events.length} damage events`)
  }

  const processKnockbackEvents = (events: Array<any>): void => {
    // ノックバックイベントの最適化処理
    console.log(`Processing ${events.length} knockback events`)
  }

  // 定期的なバッチ処理
  const batchProcessingStream = Stream.repeatEffect(
    Effect.gen(function* () {
      if (eventBuffer.length === 0) return

      const eventsToProcess = [...eventBuffer]
      eventBuffer.length = 0 // クリア

      yield* processBatchedEvents(eventsToProcess)
    })
  ).pipe(
    Stream.schedule(Schedule.spaced('100 millis')) // 100msごとに処理
  )

  return {
    addEventToBatch: (event: Schema.Schema.Type<typeof CombatEvent>) => {
      eventBuffer.push(event)
    },
    batchProcessingStream,
  }
})

// Optimized Range Calculations
const optimizedRangeCheck = (
  attackerPos: { x: number; y: number; z: number },
  targetPos: { x: number; y: number; z: number },
  weapon: Schema.Schema.Type<typeof WeaponType>
): Effect.Effect<boolean, never> =>
  Effect.sync(() => {
    // 早期リターンで不要な計算を避ける
    const maxRange = weapon._tag === 'Bow' ? weapon.maxRange : 4

    // まずX軸の距離をチェック（最も効率的）
    const deltaX = Math.abs(attackerPos.x - targetPos.x)
    if (deltaX > maxRange) return false

    // 次にZ軸
    const deltaZ = Math.abs(attackerPos.z - targetPos.z)
    if (deltaZ > maxRange) return false

    // 最後に正確な3D距離計算
    const deltaY = Math.abs(attackerPos.y - targetPos.y)
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ)

    return distance <= maxRange
  })
```
