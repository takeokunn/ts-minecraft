---
title: 'Mob AIシステム仕様 - 知的行動制御・パスファインディング・群体行動'
description: 'Minecraft Cloneにおけるモブ（生物）の人工知能システム。行動ツリー、パスファインディング、知覚システム、群体行動制御の完全仕様とEffect-TS実装パターン。'
category: 'specification'
difficulty: 'advanced'
tags: ['mob-ai', 'behavior-tree', 'pathfinding', 'entity-system', 'artificial-intelligence', 'ecs', 'game-ai']
prerequisites: ['effect-ts-fundamentals', 'ecs-architecture', 'pathfinding-algorithms', 'behavior-tree-concepts']
estimated_reading_time: '25分'
related_patterns: ['entity-component-patterns', 'behavior-tree-patterns', 'ai-decision-patterns']
related_docs: ['./overview.md', '../core-features/entity-system.md', '../core-features/physics-system.md']
search_keywords:
  primary: ['mob-ai', 'behavior-tree', 'pathfinding', 'game-ai']
  secondary: ['entity-behavior', 'artificial-intelligence', 'npc-control']
  context: ['minecraft-mobs', 'game-development', 'ai-programming']
---

# Mob AI System

## 概要

Mob AI System は、Minecraft クローンにおけるモブ（生物）の知的な行動を管理するエンハンス機能です。Entity System と Physics System の上に構築され、複雑な AI 行動をパフォーマンス効率的に実現します。

### 責務

- モブの知的行動制御（移動、攻撃、繁殖等）
- パスファインディングによる最適経路計算
- 知覚システムによる環境認識
- 群体行動の制御とコーディネーション
- 戦闘・ダメージシステムとの統合

## アーキテクチャ設計

### Core Architecture Pattern

```typescript
// ✅ AIシステムのメインインターフェース
interface MobAIServiceInterface {
  readonly updateBehaviors: (deltaTime: number) => Effect.Effect<void, AIError>
  readonly addMob: (mobConfig: MobConfig) => Effect.Effect<EntityId, AIError>
  readonly removeMob: (entityId: EntityId) => Effect.Effect<void, AIError>
  readonly setBehaviorGoal: (entityId: EntityId, goal: BehaviorGoal) => Effect.Effect<void, AIError>
}

const MobAIService = Context.GenericTag<MobAIServiceInterface>('@app/MobAIService')
```

### 行動ツリー (Behavior Tree) 実装

```typescript
// ✅ 行動ノードの定義
const BehaviorNode = Schema.TaggedUnion('type', {
  Sequence: Schema.Struct({
    type: Schema.Literal('Sequence'),
    children: Schema.Array(Schema.suspend(() => BehaviorNode)),
  }),
  Selector: Schema.Struct({
    type: Schema.Literal('Selector'),
    children: Schema.Array(Schema.suspend(() => BehaviorNode)),
  }),
  Action: Schema.Struct({
    type: Schema.Literal('Action'),
    actionType: Schema.String,
    parameters: Schema.Record(Schema.String, Schema.Unknown),
  }),
  Condition: Schema.Struct({
    type: Schema.Literal('Condition'),
    conditionType: Schema.String,
    parameters: Schema.Record(Schema.String, Schema.Unknown),
  }),
})

type BehaviorNode = Schema.Schema.Type<typeof BehaviorNode>

// ✅ 行動実行結果
type BehaviorResult = 'SUCCESS' | 'FAILURE' | 'RUNNING'

// ✅ 行動ツリー実行エンジン
const executeBehaviorNode = (node: BehaviorNode, context: BehaviorContext): Effect.Effect<BehaviorResult, AIError> =>
  Match.value(node).pipe(
    Match.tag('Sequence', ({ children }) => executeSequence(children, context)),
    Match.tag('Selector', ({ children }) => executeSelector(children, context)),
    Match.tag('Action', ({ actionType, parameters }) => executeAction(actionType, parameters, context)),
    Match.tag('Condition', ({ conditionType, parameters }) => evaluateCondition(conditionType, parameters, context)),
    Match.exhaustive
  )
```

### ゴール指向 AI (Goal-Oriented Behavior)

```typescript
// ✅ AIゴールの定義
const BehaviorGoal = Schema.TaggedUnion('type', {
  Idle: Schema.Struct({
    type: Schema.Literal('Idle'),
    wanderRadius: Schema.Number.pipe(Schema.default(() => 8)),
  }),
  Seek: Schema.Struct({
    type: Schema.Literal('Seek'),
    targetPosition: PositionSchema,
    acceptanceRadius: Schema.Number.pipe(Schema.default(() => 1)),
  }),
  Follow: Schema.Struct({
    type: Schema.Literal('Follow'),
    targetEntityId: EntityIdSchema,
    followDistance: Schema.Number.pipe(Schema.default(() => 3)),
  }),
  Attack: Schema.Struct({
    type: Schema.Literal('Attack'),
    targetEntityId: EntityIdSchema,
    attackRange: Schema.Number.pipe(Schema.default(() => 2)),
  }),
  Flee: Schema.Struct({
    type: Schema.Literal('Flee'),
    dangerPosition: PositionSchema,
    fleeDistance: Schema.Number.pipe(Schema.default(() => 10)),
  }),
  Reproduce: Schema.Struct({
    type: Schema.Literal('Reproduce'),
    partnerEntityId: Schema.optional(EntityIdSchema),
    breedingCooldown: Schema.Number.pipe(Schema.default(() => 300)),
  }),
})

type BehaviorGoal = Schema.Schema.Type<typeof BehaviorGoal>
```

## モブ種別システム

### モブタイプ分類

```typescript
// ✅ モブの分類と特性定義
const MobType = Schema.TaggedUnion('category', {
  Passive: Schema.Struct({
    category: Schema.Literal('Passive'),
    type: Schema.Literal('cow' | 'sheep' | 'pig' | 'chicken'),
    fleeOnDamage: Schema.Boolean.pipe(Schema.default(() => true)),
    breedable: Schema.Boolean.pipe(Schema.default(() => true)),
  }),
  Neutral: Schema.Struct({
    category: Schema.Literal('Neutral'),
    type: Schema.Literal('wolf' | 'bee' | 'iron_golem' | 'enderman'),
    aggroOnDamage: Schema.Boolean.pipe(Schema.default(() => true)),
    aggroRadius: Schema.Number.pipe(Schema.default(() => 6)),
  }),
  Hostile: Schema.Struct({
    category: Schema.Literal('Hostile'),
    type: Schema.Literal('zombie' | 'skeleton' | 'spider' | 'creeper'),
    attackRadius: Schema.Number.pipe(Schema.default(() => 8)),
    wanderAtNight: Schema.Boolean.pipe(Schema.default(() => true)),
  }),
  Boss: Schema.Struct({
    category: Schema.Literal('Boss'),
    type: Schema.Literal('ender_dragon' | 'wither'),
    phases: Schema.Array(BossPhaseSchema),
    immuneToDamageTypes: Schema.Array(Schema.String),
  }),
})

type MobType = Schema.Schema.Type<typeof MobType>

// ✅ モブ設定の定義
const MobConfig = Schema.Struct({
  mobType: MobType,
  health: Schema.Number.pipe(Schema.positive()),
  speed: Schema.Number.pipe(Schema.positive()),
  attackDamage: Schema.Number.pipe(Schema.nonnegative()),
  perceptionRange: Schema.Number.pipe(Schema.positive()),
  aiUpdateFrequency: Schema.Number.pipe(Schema.default(() => 50)), // ms
})

type MobConfig = Schema.Schema.Type<typeof MobConfig>
```

### モブ特性システム

```typescript
// ✅ 行動特性の実行
const executeMobBehavior = (mobType: MobType, context: BehaviorContext): Effect.Effect<BehaviorResult, AIError> =>
  Match.value(mobType).pipe(
    Match.tag('Passive', ({ type, fleeOnDamage }) =>
      Effect.gen(function* () {
        if (context.lastDamageTime && fleeOnDamage && context.currentTime - context.lastDamageTime < 5000) {
          return yield* executeFleeBehavior(context)
        }
        return yield* executePassiveBehavior(type, context)
      })
    ),
    Match.tag('Neutral', ({ aggroOnDamage, aggroRadius }) =>
      Effect.gen(function* () {
        const nearbyThreats = yield* findNearbyThreats(context.position, aggroRadius)
        if (nearbyThreats.length > 0) {
          return yield* executeDefensiveBehavior(nearbyThreats[0], context)
        }
        return yield* executeNeutralBehavior(context)
      })
    ),
    Match.tag('Hostile', ({ attackRadius }) =>
      Effect.gen(function* () {
        const nearbyTargets = yield* findNearbyTargets(context.position, attackRadius)
        if (nearbyTargets.length > 0) {
          return yield* executeAttackBehavior(nearbyTargets[0], context)
        }
        return yield* executePatrolBehavior(context)
      })
    ),
    Match.tag('Boss', ({ phases, immuneToDamageTypes }) => executeBossBehavior(phases, context)),
    Match.exhaustive
  )
```

## 基本行動システム

### 移動行動の実装

```typescript
// ✅ 移動コマンドの定義
const MovementCommand = Schema.TaggedUnion('type', {
  MoveTo: Schema.Struct({
    type: Schema.Literal('MoveTo'),
    destination: PositionSchema,
    speed: Schema.Number,
  }),
  Wander: Schema.Struct({
    type: Schema.Literal('Wander'),
    centerPoint: PositionSchema,
    radius: Schema.Number,
  }),
  Follow: Schema.Struct({
    type: Schema.Literal('Follow'),
    targetId: EntityIdSchema,
    distance: Schema.Number,
  }),
  Stop: Schema.Struct({
    type: Schema.Literal('Stop'),
  }),
})

type MovementCommand = Schema.Schema.Type<typeof MovementCommand>

// ✅ 移動実行エンジン
const executeMovementCommand = (
  command: MovementCommand,
  entityId: EntityId,
  deltaTime: number
): Effect.Effect<void, AIError> =>
  Match.value(command).pipe(
    Match.tag('MoveTo', ({ destination, speed }) =>
      Effect.gen(function* () {
        const currentPos = yield* getEntityPosition(entityId)
        const direction = calculateDirection(currentPos, destination)
        const distance = Math.min((speed * deltaTime) / 1000, calculateDistance(currentPos, destination))

        if (distance < 0.1) {
          return // 到達済み
        }

        const newPosition = movePosition(currentPos, direction, distance)
        yield* validateMovement(entityId, currentPos, newPosition)
        yield* updateEntityPosition(entityId, newPosition)
      })
    ),
    Match.tag('Wander', ({ centerPoint, radius }) =>
      Effect.gen(function* () {
        const currentPos = yield* getEntityPosition(entityId)
        const distanceFromCenter = calculateDistance(currentPos, centerPoint)

        if (distanceFromCenter > radius) {
          const returnDirection = calculateDirection(currentPos, centerPoint)
          return yield* executeDirectionalMovement(entityId, returnDirection, deltaTime)
        }

        const randomDirection = generateRandomDirection()
        return yield* executeDirectionalMovement(entityId, randomDirection, deltaTime)
      })
    ),
    Match.tag('Follow', ({ targetId, distance }) =>
      Effect.gen(function* () {
        const targetPos = yield* getEntityPosition(targetId)
        const currentPos = yield* getEntityPosition(entityId)
        const currentDistance = calculateDistance(currentPos, targetPos)

        if (currentDistance > distance) {
          const followDirection = calculateDirection(currentPos, targetPos)
          return yield* executeDirectionalMovement(entityId, followDirection, deltaTime)
        }
      })
    ),
    Match.tag('Stop', () => Effect.succeed(undefined)),
    Match.exhaustive
  )
```

### 攻撃・戦闘行動

```typescript
// ✅ 攻撃行動の定義
const AttackBehavior = Schema.Struct({
  targetId: EntityIdSchema,
  attackType: Schema.Literal('melee' | 'ranged' | 'special'),
  damage: Schema.Number.pipe(Schema.positive()),
  cooldown: Schema.Number.pipe(Schema.positive()),
  range: Schema.Number.pipe(Schema.positive()),
})

type AttackBehavior = Schema.Schema.Type<typeof AttackBehavior>

// ✅ 戦闘システム統合
const executeAttackBehavior = (
  behavior: AttackBehavior,
  attackerId: EntityId,
  context: BehaviorContext
): Effect.Effect<BehaviorResult, AIError> =>
  Effect.gen(function* () {
    const attackerPos = yield* getEntityPosition(attackerId)
    const targetPos = yield* getEntityPosition(behavior.targetId)
    const distance = calculateDistance(attackerPos, targetPos)

    // 範囲外の場合は移動
    if (distance > behavior.range) {
      yield* executeMovementCommand(
        {
          type: 'MoveTo',
          destination: targetPos,
          speed: context.baseSpeed,
        },
        attackerId,
        context.deltaTime
      )
      return 'RUNNING'
    }

    // クールダウン確認
    const lastAttackTime = yield* getLastAttackTime(attackerId)
    if (context.currentTime - lastAttackTime < behavior.cooldown) {
      return 'RUNNING'
    }

    // 攻撃実行
    yield* executeDamage({
      attackerId,
      targetId: behavior.targetId,
      damage: behavior.damage,
      damageType: behavior.attackType,
    })

    yield* setLastAttackTime(attackerId, context.currentTime)
    return 'SUCCESS'
  })
```

### 繁殖・食事・睡眠行動

```typescript
// ✅ 生活行動の定義
const LifeBehavior = Schema.TaggedUnion('type', {
  Feed: Schema.Struct({
    type: Schema.Literal('Feed'),
    foodType: Schema.String,
    hungerThreshold: Schema.Number.pipe(Schema.default(() => 30)),
  }),
  Sleep: Schema.Struct({
    type: Schema.Literal('Sleep'),
    bedPosition: Schema.optional(PositionSchema),
    sleepDuration: Schema.Number.pipe(Schema.default(() => 8000)),
  }),
  Breed: Schema.Struct({
    type: Schema.Literal('Breed'),
    partnerId: Schema.optional(EntityIdSchema),
    breedingItem: Schema.optional(Schema.String),
  }),
})

type LifeBehavior = Schema.Schema.Type<typeof LifeBehavior>

const executeLifeBehavior = (
  behavior: LifeBehavior,
  entityId: EntityId,
  context: BehaviorContext
): Effect.Effect<BehaviorResult, AIError> =>
  Match.value(behavior).pipe(
    Match.tag('Feed', ({ foodType, hungerThreshold }) =>
      Effect.gen(function* () {
        const hunger = yield* getHungerLevel(entityId)
        if (hunger > hungerThreshold) {
          return 'SUCCESS' // 満腹
        }

        const nearbyFood = yield* findNearbyFood(context.position, foodType, 8)
        if (nearbyFood.length === 0) {
          return 'FAILURE' // 食べ物が見つからない
        }

        const closestFood = nearbyFood[0]
        yield* executeMovementCommand(
          {
            type: 'MoveTo',
            destination: closestFood.position,
            speed: context.baseSpeed,
          },
          entityId,
          context.deltaTime
        )

        const distance = calculateDistance(context.position, closestFood.position)
        if (distance < 1) {
          yield* consumeFood(entityId, closestFood.id)
          return 'SUCCESS'
        }

        return 'RUNNING'
      })
    ),
    Match.tag('Sleep', ({ bedPosition, sleepDuration }) =>
      Effect.gen(function* () {
        const sleepStart = yield* getSleepStartTime(entityId)
        if (sleepStart === null) {
          // 就寝開始
          const bedPos = bedPosition ?? context.position
          yield* setSleepStartTime(entityId, context.currentTime)
          yield* executeMovementCommand(
            {
              type: 'MoveTo',
              destination: bedPos,
              speed: context.baseSpeed * 0.5,
            },
            entityId,
            context.deltaTime
          )
          return 'RUNNING'
        }

        if (context.currentTime - sleepStart >= sleepDuration) {
          yield* setSleepStartTime(entityId, null)
          return 'SUCCESS'
        }

        return 'RUNNING'
      })
    ),
    Match.tag('Breed', ({ partnerId, breedingItem }) =>
      Effect.gen(function* () {
        const partner = partnerId ?? (yield* findBreedingPartner(entityId, context.position, 5))
        if (!partner) {
          return 'FAILURE'
        }

        if (breedingItem) {
          const hasItem = yield* hasBreedingItem(entityId, breedingItem)
          if (!hasItem) {
            return 'FAILURE'
          }
        }

        const distance = calculateDistance(context.position, yield* getEntityPosition(partner))
        if (distance > 2) {
          yield* executeMovementCommand(
            {
              type: 'MoveTo',
              destination: yield* getEntityPosition(partner),
              speed: context.baseSpeed,
            },
            entityId,
            context.deltaTime
          )
          return 'RUNNING'
        }

        yield* spawnOffspring(entityId, partner, context.position)
        return 'SUCCESS'
      })
    ),
    Match.exhaustive
  )
```

## パスファインディング

### A\* アルゴリズム実装

```typescript
// ✅ A* パスファインディング
const AStarNode = Schema.Struct({
  position: PositionSchema,
  gCost: Schema.Number, // スタートからのコスト
  hCost: Schema.Number, // ゴールまでの推定コスト
  fCost: Schema.Number, // gCost + hCost
  parent: Schema.optional(Schema.suspend(() => AStarNode)),
})

type AStarNode = Schema.Schema.Type<typeof AStarNode>

const findPath = (
  start: Position,
  goal: Position,
  worldBounds: WorldBounds,
  obstacles: Set<string>
): Effect.Effect<Position[], PathfindingError> =>
  Effect.gen(function* () {
    // 早期リターン: 開始位置と目標位置の検証
    if (!isValidPosition(start, worldBounds) || !isValidPosition(goal, worldBounds)) {
      return yield* Effect.fail(createPathfindingError('Invalid start or goal position'))
    }

    const openSet = new MinHeap<AStarNode>((a, b) => a.fCost - b.fCost)
    const closedSet = new Set<string>()
    const startNode: AStarNode = {
      position: start,
      gCost: 0,
      hCost: calculateHeuristic(start, goal),
      fCost: calculateHeuristic(start, goal),
      parent: undefined,
    }

    openSet.insert(startNode)

    while (!openSet.isEmpty()) {
      const current = openSet.extract()
      const posKey = positionToKey(current.position)

      if (closedSet.has(posKey)) continue
      closedSet.add(posKey)

      // ゴール到達確認
      if (positionsEqual(current.position, goal)) {
        return reconstructPath(current)
      }

      const neighbors = getNeighbors(current.position, worldBounds)
      for (const neighborPos of neighbors) {
        const neighborKey = positionToKey(neighborPos)

        if (closedSet.has(neighborKey) || obstacles.has(neighborKey)) continue

        const gCost = current.gCost + calculateMoveCost(current.position, neighborPos)
        const hCost = calculateHeuristic(neighborPos, goal)
        const neighbor: AStarNode = {
          position: neighborPos,
          gCost,
          hCost,
          fCost: gCost + hCost,
          parent: current,
        }

        openSet.insert(neighbor)
      }
    }

    return yield* Effect.fail(createPathfindingError('No path found'))
  })

// ✅ ヒューリスティック関数（マンハッタン距離）
const calculateHeuristic = (from: Position, to: Position): number =>
  Math.abs(to.x - from.x) + Math.abs(to.y - from.y) + Math.abs(to.z - from.z)

// ✅ パス再構築
const reconstructPath = (node: AStarNode): Position[] => {
  const path: Position[] = []
  let current: AStarNode | undefined = node

  while (current) {
    path.unshift(current.position)
    current = current.parent
  }

  return path
}
```

### JPS (Jump Point Search) 最適化

```typescript
// ✅ Jump Point Search実装
const jumpPointSearch = (
  start: Position,
  goal: Position,
  worldBounds: WorldBounds,
  obstacles: Set<string>
): Effect.Effect<Position[], PathfindingError> =>
  Effect.gen(function* () {
    const openSet = new MinHeap<JPSNode>((a, b) => a.fCost - b.fCost)
    const closedSet = new Map<string, JPSNode>()

    const startNode: JPSNode = {
      position: start,
      gCost: 0,
      hCost: calculateHeuristic(start, goal),
      fCost: calculateHeuristic(start, goal),
      parent: undefined,
      direction: undefined,
    }

    openSet.insert(startNode)

    while (!openSet.isEmpty()) {
      const current = openSet.extract()
      const posKey = positionToKey(current.position)

      if (positionsEqual(current.position, goal)) {
        return reconstructPath(current)
      }

      closedSet.set(posKey, current)

      const successors = yield* identifySuccessors(current, goal, worldBounds, obstacles)
      for (const successor of successors) {
        const succKey = positionToKey(successor.position)
        const existing = closedSet.get(succKey)

        if (existing && existing.gCost <= successor.gCost) continue

        openSet.insert(successor)
      }
    }

    return yield* Effect.fail(createPathfindingError('No path found with JPS'))
  })

// ✅ ジャンプポイント発見
const jump = (
  current: Position,
  direction: Direction,
  goal: Position,
  worldBounds: WorldBounds,
  obstacles: Set<string>
): Effect.Effect<Position | null, PathfindingError> =>
  Effect.gen(function* () {
    const next = movePosition(current, direction, 1)

    if (!isValidPosition(next, worldBounds) || obstacles.has(positionToKey(next))) {
      return null
    }

    if (positionsEqual(next, goal)) {
      return next
    }

    // 強制的隣接ノードをチェック
    if (yield* hasForcedNeighbors(next, direction, worldBounds, obstacles)) {
      return next
    }

    // 対角線移動の場合は水平・垂直方向もチェック
    if (isDiagonalDirection(direction)) {
      const horizontalJump = yield* jump(next, getHorizontalComponent(direction), goal, worldBounds, obstacles)
      const verticalJump = yield* jump(next, getVerticalComponent(direction), goal, worldBounds, obstacles)

      if (horizontalJump || verticalJump) {
        return next
      }
    }

    return yield* jump(next, direction, goal, worldBounds, obstacles)
  })
```

### 群衆回避システム

```typescript
// ✅ 群衆回避 (Crowd Avoidance)
const CrowdAvoidanceConfig = Schema.Struct({
  separationRadius: Schema.Number.pipe(Schema.default(() => 2)),
  separationStrength: Schema.Number.pipe(Schema.default(() => 1.5)),
  avoidanceRadius: Schema.Number.pipe(Schema.default(() => 3)),
  maxAvoidanceForce: Schema.Number.pipe(Schema.default(() => 2)),
})

type CrowdAvoidanceConfig = Schema.Schema.Type<typeof CrowdAvoidanceConfig>

const applyCrowdAvoidance = (
  entityId: EntityId,
  desiredVelocity: Vector3,
  config: CrowdAvoidanceConfig
): Effect.Effect<Vector3, AIError> =>
  Effect.gen(function* () {
    const position = yield* getEntityPosition(entityId)
    const nearbyEntities = yield* findNearbyEntities(position, config.avoidanceRadius)

    if (nearbyEntities.length === 0) {
      return desiredVelocity
    }

    // 分離力の計算
    const separationForce = calculateSeparationForce(
      position,
      nearbyEntities,
      config.separationRadius,
      config.separationStrength
    )

    // RVO (Reciprocal Velocity Obstacles) による衝突回避
    const avoidanceForce = yield* calculateRVOForce(entityId, position, desiredVelocity, nearbyEntities, config)

    const combinedForce = addVectors(separationForce, avoidanceForce)
    const clampedForce = clampVector(combinedForce, config.maxAvoidanceForce)

    return addVectors(desiredVelocity, clampedForce)
  })

// ✅ RVO計算
const calculateRVOForce = (
  entityId: EntityId,
  position: Position,
  velocity: Vector3,
  nearbyEntities: EntityInfo[],
  config: CrowdAvoidanceConfig
): Effect.Effect<Vector3, AIError> =>
  Effect.gen(function* () {
    let avoidanceForce = createZeroVector()

    for (const entity of nearbyEntities) {
      if (entity.id === entityId) continue

      const relativePosition = subtractVectors(entity.position, position)
      const distance = vectorMagnitude(relativePosition)

      if (distance > config.avoidanceRadius) continue

      const entityVelocity = yield* getEntityVelocity(entity.id)
      const relativeVelocity = subtractVectors(velocity, entityVelocity)

      // 衝突時間の計算
      const timeToCollision = calculateTimeToCollision(
        relativePosition,
        relativeVelocity,
        1 // 半径の合計
      )

      if (timeToCollision > 0 && timeToCollision < 2) {
        const avoidanceDirection = normalizeVector(crossProduct(relativePosition, createVector(0, 1, 0)))
        const forceMagnitude = (2 - timeToCollision) / timeToCollision
        avoidanceForce = addVectors(avoidanceForce, scaleVector(avoidanceDirection, forceMagnitude))
      }
    }

    return avoidanceForce
  })
```

## 知覚システム

### 視界・聴覚・匂いシステム

```typescript
// ✅ 知覚システムの定義
const PerceptionType = Schema.TaggedUnion('type', {
  Vision: Schema.Struct({
    type: Schema.Literal('Vision'),
    range: Schema.Number.pipe(Schema.positive()),
    fieldOfView: Schema.Number.pipe(Schema.default(() => 120)), // 度
    requiresLineOfSight: Schema.Boolean.pipe(Schema.default(() => true)),
  }),
  Hearing: Schema.Struct({
    type: Schema.Literal('Hearing'),
    range: Schema.Number.pipe(Schema.positive()),
    sensitivityThreshold: Schema.Number.pipe(Schema.default(() => 0.3)),
  }),
  Smell: Schema.Struct({
    type: Schema.Literal('Smell'),
    range: Schema.Number.pipe(Schema.positive()),
    scentsTracked: Schema.Array(Schema.String),
  }),
})

type PerceptionType = Schema.Schema.Type<typeof PerceptionType>

// ✅ 知覚情報
const PerceptionData = Schema.Struct({
  entityId: EntityIdSchema,
  position: PositionSchema,
  perceptionType: PerceptionType,
  strength: Schema.Number.pipe(Schema.between(0, 1)),
  timestamp: Schema.Number,
})

type PerceptionData = Schema.Schema.Type<typeof PerceptionData>

// ✅ 知覚システム実行
const updatePerception = (
  entityId: EntityId,
  perceptionTypes: PerceptionType[]
): Effect.Effect<PerceptionData[], AIError> =>
  Effect.gen(function* () {
    const position = yield* getEntityPosition(entityId)
    const facing = yield* getEntityFacing(entityId)

    const perceptions = yield* Effect.all(
      perceptionTypes.map((perception) =>
        Match.value(perception).pipe(
          Match.tag('Vision', ({ range, fieldOfView, requiresLineOfSight }) =>
            detectVisionTargets(entityId, position, facing, range, fieldOfView, requiresLineOfSight)
          ),
          Match.tag('Hearing', ({ range, sensitivityThreshold }) =>
            detectAudioTargets(entityId, position, range, sensitivityThreshold)
          ),
          Match.tag('Smell', ({ range, scentsTracked }) =>
            detectScentTargets(entityId, position, range, scentsTracked)
          ),
          Match.exhaustive
        )
      )
    )

    return perceptions.flat()
  })

// ✅ 視界検出
const detectVisionTargets = (
  observerId: EntityId,
  position: Position,
  facing: Vector3,
  range: number,
  fieldOfView: number,
  requiresLineOfSight: boolean
): Effect.Effect<PerceptionData[], AIError> =>
  Effect.gen(function* () {
    const nearbyEntities = yield* findNearbyEntities(position, range)
    const detectedTargets: PerceptionData[] = []

    for (const entity of nearbyEntities) {
      if (entity.id === observerId) continue

      const targetDirection = subtractVectors(entity.position, position)
      const distance = vectorMagnitude(targetDirection)
      const normalizedDirection = normalizeVector(targetDirection)

      // 視野角チェック
      const angle = calculateAngleBetween(facing, normalizedDirection)
      if (angle > fieldOfView / 2) continue

      // 視線チェック
      if (requiresLineOfSight) {
        const hasLineOfSight = yield* checkLineOfSight(position, entity.position)
        if (!hasLineOfSight) continue
      }

      const strength = 1 - distance / range // 距離に基づく強度
      detectedTargets.push({
        entityId: entity.id,
        position: entity.position,
        perceptionType: {
          type: 'Vision',
          range,
          fieldOfView,
          requiresLineOfSight,
        },
        strength,
        timestamp: Date.now(),
      })
    }

    return detectedTargets
  })

// ✅ 聴覚検出
const detectAudioTargets = (
  observerId: EntityId,
  position: Position,
  range: number,
  threshold: number
): Effect.Effect<PerceptionData[], AIError> =>
  Effect.gen(function* () {
    const audioSources = yield* getAudioSources(position, range)
    const detectedSounds: PerceptionData[] = []

    for (const source of audioSources) {
      if (source.volume < threshold) continue

      const distance = calculateDistance(position, source.position)
      const attenuatedVolume = source.volume * (1 - distance / range)

      if (attenuatedVolume >= threshold) {
        detectedSounds.push({
          entityId: source.sourceId,
          position: source.position,
          perceptionType: {
            type: 'Hearing',
            range,
            sensitivityThreshold: threshold,
          },
          strength: attenuatedVolume,
          timestamp: Date.now(),
        })
      }
    }

    return detectedSounds
  })
```

## 群体行動システム

### フロッキング (Boids) アルゴリズム

```typescript
// ✅ フロッキング行動の定義
const FlockingConfig = Schema.Struct({
  separationRadius: Schema.Number.pipe(Schema.default(() => 2)),
  alignmentRadius: Schema.Number.pipe(Schema.default(() => 5)),
  cohesionRadius: Schema.Number.pipe(Schema.default(() => 8)),
  separationWeight: Schema.Number.pipe(Schema.default(() => 2.0)),
  alignmentWeight: Schema.Number.pipe(Schema.default(() => 1.0)),
  cohesionWeight: Schema.Number.pipe(Schema.default(() => 1.0)),
  maxSpeed: Schema.Number.pipe(Schema.default(() => 5)),
  maxForce: Schema.Number.pipe(Schema.default(() => 2)),
})

type FlockingConfig = Schema.Schema.Type<typeof FlockingConfig>

// ✅ Boids実装
const calculateFlockingBehavior = (
  entityId: EntityId,
  position: Position,
  velocity: Vector3,
  flockmates: EntityInfo[],
  config: FlockingConfig
): Effect.Effect<Vector3, AIError> =>
  Effect.gen(function* () {
    // 分離 (Separation): 近くの隣接個体から離れる
    const separation = calculateSeparation(position, flockmates, config.separationRadius)

    // 整列 (Alignment): 隣接個体の平均方向に合わせる
    const alignment = yield* calculateAlignment(flockmates, config.alignmentRadius)

    // 結束 (Cohesion): 隣接個体の重心に向かう
    const cohesion = calculateCohesion(position, flockmates, config.cohesionRadius)

    // 重み付き合成
    const separationForce = scaleVector(separation, config.separationWeight)
    const alignmentForce = scaleVector(alignment, config.alignmentWeight)
    const cohesionForce = scaleVector(cohesion, config.cohesionWeight)

    let steeringForce = addVectors(separationForce, alignmentForce)
    steeringForce = addVectors(steeringForce, cohesionForce)

    // 力の制限
    steeringForce = clampVector(steeringForce, config.maxForce)

    // 新しい速度の計算
    let newVelocity = addVectors(velocity, steeringForce)
    newVelocity = clampVector(newVelocity, config.maxSpeed)

    return newVelocity
  })

// ✅ 分離力の計算
const calculateSeparation = (position: Position, neighbors: EntityInfo[], separationRadius: number): Vector3 => {
  let separationForce = createZeroVector()
  let count = 0

  for (const neighbor of neighbors) {
    const distance = calculateDistance(position, neighbor.position)
    if (distance > 0 && distance < separationRadius) {
      const diff = subtractVectors(position, neighbor.position)
      const normalized = normalizeVector(diff)
      const weighted = scaleVector(normalized, 1 / distance) // 近いほど強い力
      separationForce = addVectors(separationForce, weighted)
      count++
    }
  }

  if (count > 0) {
    separationForce = scaleVector(separationForce, 1 / count)
    separationForce = normalizeVector(separationForce)
  }

  return separationForce
}

// ✅ 整列力の計算
const calculateAlignment = (neighbors: EntityInfo[], alignmentRadius: number): Effect.Effect<Vector3, AIError> =>
  Effect.gen(function* () {
    let averageVelocity = createZeroVector()
    let count = 0

    for (const neighbor of neighbors) {
      const neighborVelocity = yield* getEntityVelocity(neighbor.id)
      averageVelocity = addVectors(averageVelocity, neighborVelocity)
      count++
    }

    if (count === 0) {
      return createZeroVector()
    }

    averageVelocity = scaleVector(averageVelocity, 1 / count)
    return normalizeVector(averageVelocity)
  })

// ✅ 結束力の計算
const calculateCohesion = (position: Position, neighbors: EntityInfo[], cohesionRadius: number): Vector3 => {
  let centerOfMass = createZeroVector()
  let count = 0

  for (const neighbor of neighbors) {
    const distance = calculateDistance(position, neighbor.position)
    if (distance < cohesionRadius) {
      centerOfMass = addVectors(centerOfMass, neighbor.position)
      count++
    }
  }

  if (count === 0) {
    return createZeroVector()
  }

  centerOfMass = scaleVector(centerOfMass, 1 / count)
  const cohesionDirection = subtractVectors(centerOfMass, position)
  return normalizeVector(cohesionDirection)
}
```

### リーダー追従システム

```typescript
// ✅ リーダー追従設定
const LeaderFollowConfig = Schema.Struct({
  leaderId: EntityIdSchema,
  followDistance: Schema.Number.pipe(Schema.default(() => 3)),
  maxFollowDistance: Schema.Number.pipe(Schema.default(() => 10)),
  leaderPredictionTime: Schema.Number.pipe(Schema.default(() => 1)), // 秒
  arrivalRadius: Schema.Number.pipe(Schema.default(() => 2)),
  separationFromOthers: Schema.Boolean.pipe(Schema.default(() => true)),
})

type LeaderFollowConfig = Schema.Schema.Type<typeof LeaderFollowConfig>

// ✅ リーダー追従実装
const calculateLeaderFollowing = (
  followerId: EntityId,
  position: Position,
  velocity: Vector3,
  config: LeaderFollowConfig
): Effect.Effect<Vector3, AIError> =>
  Effect.gen(function* () {
    const leaderPos = yield* getEntityPosition(config.leaderId)
    const leaderVel = yield* getEntityVelocity(config.leaderId)

    // リーダーの未来位置を予測
    const predictedPos = addVectors(leaderPos, scaleVector(leaderVel, config.leaderPredictionTime))

    // リーダーの後方位置を計算
    const leaderDirection = normalizeVector(leaderVel)
    const behindLeader = addVectors(predictedPos, scaleVector(leaderDirection, -config.followDistance))

    // 現在位置との距離
    const distanceToLeader = calculateDistance(position, leaderPos)

    // 追従範囲外の場合は急いで追いかける
    if (distanceToLeader > config.maxFollowDistance) {
      const catchUpDirection = normalizeVector(subtractVectors(leaderPos, position))
      return scaleVector(catchUpDirection, vectorMagnitude(velocity) * 1.5)
    }

    // 到着行動: 後方位置への移動
    const arrivalForce = calculateArrival(position, behindLeader, velocity, config.arrivalRadius)

    // 他のフォロワーとの分離
    let separationForce = createZeroVector()
    if (config.separationFromOthers) {
      const otherFollowers = yield* findOtherFollowers(followerId, config.leaderId, 5)
      separationForce = calculateSeparation(position, otherFollowers, 3)
    }

    const combinedForce = addVectors(arrivalForce, separationForce)
    return clampVector(combinedForce, 5) // 最大力を制限
  })

// ✅ 到着行動
const calculateArrival = (position: Position, target: Position, velocity: Vector3, arrivalRadius: number): Vector3 => {
  const desired = subtractVectors(target, position)
  const distance = vectorMagnitude(desired)

  if (distance < 0.1) {
    return createZeroVector() // 到着済み
  }

  const normalizedDesired = normalizeVector(desired)
  let desiredSpeed = vectorMagnitude(velocity)

  // 到着半径内では速度を下げる
  if (distance < arrivalRadius) {
    desiredSpeed *= distance / arrivalRadius
  }

  const desiredVelocity = scaleVector(normalizedDesired, desiredSpeed)
  return subtractVectors(desiredVelocity, velocity)
}
```

## ダメージ・戦闘システム統合

### 戦闘インタラクション

```typescript
// ✅ 戦闘システム統合
const CombatIntegration = Schema.Struct({
  attacker: EntityIdSchema,
  target: EntityIdSchema,
  damageAmount: Schema.Number.pipe(Schema.positive()),
  damageType: Schema.Literal('melee' | 'ranged' | 'magic' | 'environmental'),
  knockback: Schema.optional(Vector3Schema),
  statusEffects: Schema.Array(StatusEffectSchema),
})

type CombatIntegration = Schema.Schema.Type<typeof CombatIntegration>

// ✅ 戦闘処理とAI反応
const processCombatInteraction = (combatData: CombatIntegration): Effect.Effect<void, CombatError> =>
  Effect.gen(function* () {
    // ダメージ適用
    yield* applyDamage(combatData.target, combatData.damageAmount, combatData.damageType)

    // ノックバック適用
    if (combatData.knockback) {
      yield* applyKnockback(combatData.target, combatData.knockback)
    }

    // ステータス効果適用
    for (const effect of combatData.statusEffects) {
      yield* applyStatusEffect(combatData.target, effect)
    }

    // AI反応の発動
    yield* triggerAIReaction(combatData.target, combatData.attacker, 'attacked')
    yield* triggerAIReaction(combatData.attacker, combatData.target, 'attacked_entity')

    // 近くのモブへの影響
    const nearbyMobs = yield* findNearbyMobs(yield* getEntityPosition(combatData.target), 8)

    for (const mob of nearbyMobs) {
      if (mob.id !== combatData.target && mob.id !== combatData.attacker) {
        yield* triggerAIReaction(mob.id, combatData.attacker, 'witnessed_combat')
      }
    }
  })

// ✅ AI反応システム
const triggerAIReaction = (
  entityId: EntityId,
  triggerEntity: EntityId,
  reactionType: string
): Effect.Effect<void, AIError> =>
  Effect.gen(function* () {
    const mobType = yield* getMobType(entityId)

    yield* Match.value(reactionType).pipe(
      Match.when('attacked', () =>
        Effect.gen(function* () {
          // 攻撃されたときの反応
          yield* Match.value(mobType.category).pipe(
            Match.tag('Passive', () =>
              // 逃走行動を追加
              setBehaviorGoal(entityId, {
                type: 'Flee',
                dangerPosition: yield* getEntityPosition(triggerEntity),
                fleeDistance: 15,
              })
            ),
            Match.tag('Neutral', () =>
              // 反撃または逃走
              Effect.gen(function* () {
                const health = yield* getEntityHealth(entityId)
                const maxHealth = yield* getEntityMaxHealth(entityId)

                if (health / maxHealth < 0.3) {
                  // 体力が低い場合は逃走
                  yield* setBehaviorGoal(entityId, {
                    type: 'Flee',
                    dangerPosition: yield* getEntityPosition(triggerEntity),
                    fleeDistance: 20,
                  })
                } else {
                  // 反撃
                  yield* setBehaviorGoal(entityId, {
                    type: 'Attack',
                    targetEntityId: triggerEntity,
                    attackRange: 2,
                  })
                }
              })
            ),
            Match.tag('Hostile', () =>
              // 積極的に攻撃
              setBehaviorGoal(entityId, {
                type: 'Attack',
                targetEntityId: triggerEntity,
                attackRange: 3,
              })
            ),
            Match.orElse(() => Effect.succeed(undefined))
          )
        })
      ),
      Match.when('witnessed_combat', () =>
        // 戦闘を目撃した場合の反応
        Effect.gen(function* () {
          const relationship = yield* getEntityRelationship(entityId, triggerEntity)

          if (relationship === 'hostile') {
            // 敵対的な場合は参戦
            yield* setBehaviorGoal(entityId, {
              type: 'Attack',
              targetEntityId: triggerEntity,
              attackRange: 3,
            })
          } else if (relationship === 'neutral') {
            // 中立的な場合は警戒
            yield* increaseAlertLevel(entityId, 0.3)
          }
        })
      ),
      Match.orElse(() => Effect.succeed(undefined))
    )
  })
```

### ヘルスシステム統合

```typescript
// ✅ ヘルス管理とAI状態連動
const HealthAIIntegration = Schema.Struct({
  entityId: EntityIdSchema,
  currentHealth: Schema.Number.pipe(Schema.nonnegative()),
  maxHealth: Schema.Number.pipe(Schema.positive()),
  regenerationRate: Schema.Number.pipe(Schema.nonnegative()),
  lastDamageTime: Schema.optional(Schema.Number),
})

type HealthAIIntegration = Schema.Schema.Type<typeof HealthAIIntegration>

// ✅ ヘルス変化に基づくAI調整
const adjustAIBasedOnHealth = (healthData: HealthAIIntegration): Effect.Effect<void, AIError> =>
  Effect.gen(function* () {
    const healthPercentage = healthData.currentHealth / healthData.maxHealth

    // 体力に基づく行動変更
    if (healthPercentage < 0.2) {
      // 緊急逃走モード
      yield* setBehaviorGoal(healthData.entityId, {
        type: 'Flee',
        dangerPosition: yield* getEntityPosition(healthData.entityId),
        fleeDistance: 25,
      })
      yield* increaseEmotionalState(healthData.entityId, 'fear', 0.8)
    } else if (healthPercentage < 0.5) {
      // 防御的行動
      yield* increaseEmotionalState(healthData.entityId, 'fear', 0.3)
      yield* decreaseEmotionalState(healthData.entityId, 'aggression', 0.2)
    } else if (healthPercentage > 0.8) {
      // 積極的行動
      yield* increaseEmotionalState(healthData.entityId, 'aggression', 0.1)
    }

    // 再生中は休息行動を優先
    if (healthData.regenerationRate > 0 && healthPercentage < 1.0) {
      yield* setBehaviorGoal(healthData.entityId, {
        type: 'Idle',
        wanderRadius: 2, // 移動を制限
      })
    }
  })
```

## パフォーマンス最適化

### LOD (Level of Detail) システム

```typescript
// ✅ AI LOD設定
const AILODConfig = Schema.Struct({
  highDetailDistance: Schema.Number.pipe(Schema.default(() => 32)),
  mediumDetailDistance: Schema.Number.pipe(Schema.default(() => 64)),
  lowDetailDistance: Schema.Number.pipe(Schema.default(() => 128)),
  updateFrequencies: Schema.Struct({
    high: Schema.Number.pipe(Schema.default(() => 50)), // ms
    medium: Schema.Number.pipe(Schema.default(() => 100)),
    low: Schema.Number.pipe(Schema.default(() => 500)),
    inactive: Schema.Number.pipe(Schema.default(() => 2000)),
  }),
})

type AILODConfig = Schema.Schema.Type<typeof AILODConfig>

type AILODLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INACTIVE'

// ✅ LOD計算
const calculateAILOD = (mobPosition: Position, playerPositions: Position[], config: AILODConfig): AILODLevel => {
  const nearestPlayerDistance = Math.min(
    ...playerPositions.map((playerPos) => calculateDistance(mobPosition, playerPos))
  )

  if (nearestPlayerDistance <= config.highDetailDistance) return 'HIGH'
  if (nearestPlayerDistance <= config.mediumDetailDistance) return 'MEDIUM'
  if (nearestPlayerDistance <= config.lowDetailDistance) return 'LOW'
  return 'INACTIVE'
}

// ✅ LODベースAI更新
const updateAIWithLOD = (entityId: EntityId, lodLevel: AILODLevel, deltaTime: number): Effect.Effect<void, AIError> =>
  Match.value(lodLevel).pipe(
    Match.when('HIGH', () =>
      Effect.gen(function* () {
        // フル AI処理
        yield* updateFullBehaviorTree(entityId, deltaTime)
        yield* updateDetailedPerception(entityId)
        yield* updatePrecisePathfinding(entityId)
        yield* updateFlockingBehavior(entityId)
      })
    ),
    Match.when('MEDIUM', () =>
      Effect.gen(function* () {
        // 簡素化AI処理
        yield* updateSimplifiedBehavior(entityId, deltaTime)
        yield* updateBasicPerception(entityId)
        yield* updateSimpleMovement(entityId)
      })
    ),
    Match.when('LOW', () =>
      Effect.gen(function* () {
        // 最小限AI処理
        yield* updateMinimalBehavior(entityId, deltaTime)
        yield* updateOccasionalMovement(entityId)
      })
    ),
    Match.when('INACTIVE', () =>
      Effect.gen(function* () {
        // AI停止、状態保存のみ
        yield* saveAIState(entityId)
      })
    ),
    Match.exhaustive
  )
```

### CPU分散処理

```typescript
// ✅ AI更新の分散処理
const AIUpdateScheduler = Schema.Struct({
  maxEntitiesPerFrame: Schema.Number.pipe(Schema.default(() => 10)),
  targetFrameTime: Schema.Number.pipe(Schema.default(() => 16)), // 60FPS
  priorityWeights: Schema.Struct({
    playerDistance: Schema.Number.pipe(Schema.default(() => 0.4)),
    behaviorComplexity: Schema.Number.pipe(Schema.default(() => 0.3)),
    lastUpdateTime: Schema.Number.pipe(Schema.default(() => 0.3)),
  }),
})

type AIUpdateScheduler = Schema.Schema.Type<typeof AIUpdateScheduler>

// ✅ 分散AI更新
const updateAIEntitiesDistributed = (
  entities: EntityId[],
  scheduler: AIUpdateScheduler,
  deltaTime: number
): Effect.Effect<void, AIError> =>
  Effect.gen(function* () {
    const startTime = performance.now()
    const sortedEntities = yield* prioritizeEntitiesForUpdate(entities, scheduler.priorityWeights)

    let processedCount = 0
    for (const entityId of sortedEntities) {
      if (processedCount >= scheduler.maxEntitiesPerFrame) break

      const frameTimeUsed = performance.now() - startTime
      if (frameTimeUsed > scheduler.targetFrameTime * 0.8) break // 80%で打ち切り

      const lodLevel = yield* getEntityLOD(entityId)
      yield* updateAIWithLOD(entityId, lodLevel, deltaTime)
      processedCount++
    }

    // 残りのエンティティは次フレームに持ち越し
    if (processedCount < entities.length) {
      yield* scheduleRemainingEntities(entities.slice(processedCount))
    }
  })

// ✅ 優先度計算
const prioritizeEntitiesForUpdate = (
  entities: EntityId[],
  weights: AIUpdateScheduler['priorityWeights']
): Effect.Effect<EntityId[], AIError> =>
  Effect.gen(function* () {
    const playerPositions = yield* getAllPlayerPositions()
    const currentTime = Date.now()

    const prioritizedEntities = yield* Effect.all(
      entities.map((entityId) =>
        Effect.gen(function* () {
          const position = yield* getEntityPosition(entityId)
          const lastUpdate = yield* getLastUpdateTime(entityId)
          const behaviorComplexity = yield* getBehaviorComplexity(entityId)

          const nearestPlayerDistance = Math.min(
            ...playerPositions.map((playerPos) => calculateDistance(position, playerPos))
          )

          // 正規化されたスコア計算
          const distanceScore = 1 - Math.min(nearestPlayerDistance / 100, 1)
          const complexityScore = behaviorComplexity / 10
          const timeScore = Math.min((currentTime - lastUpdate) / 5000, 1)

          const totalScore =
            distanceScore * weights.playerDistance +
            complexityScore * weights.behaviorComplexity +
            timeScore * weights.lastUpdateTime

          return { entityId, priority: totalScore }
        })
      )
    )

    return prioritizedEntities.sort((a, b) => b.priority - a.priority).map((item) => item.entityId)
  })
```

## 実装例

### 基本的なゾンビAI

```typescript
// ✅ ゾンビAI実装例
const createZombieAI = (): Effect.Effect<BehaviorNode, never> =>
  Effect.succeed({
    type: 'Selector',
    children: [
      // 攻撃行動
      {
        type: 'Sequence',
        children: [
          {
            type: 'Condition',
            conditionType: 'hasTarget',
            parameters: { range: 8 },
          },
          {
            type: 'Action',
            actionType: 'attack',
            parameters: { damage: 4, range: 2, cooldown: 1000 },
          },
        ],
      },
      // 探索行動
      {
        type: 'Sequence',
        children: [
          {
            type: 'Condition',
            conditionType: 'noTarget',
            parameters: {},
          },
          {
            type: 'Action',
            actionType: 'seekPlayer',
            parameters: { searchRadius: 16, speed: 2 },
          },
        ],
      },
      // デフォルト: 徘徊
      {
        type: 'Action',
        actionType: 'wander',
        parameters: { radius: 5, speed: 1 },
      },
    ],
  })

// ✅ 牛AIの実装例
const createCowAI = (): Effect.Effect<BehaviorNode, never> =>
  Effect.succeed({
    type: 'Selector',
    children: [
      // 逃走行動（ダメージを受けた場合）
      {
        type: 'Sequence',
        children: [
          {
            type: 'Condition',
            conditionType: 'recentlyDamaged',
            parameters: { timeThreshold: 5000 },
          },
          {
            type: 'Action',
            actionType: 'flee',
            parameters: { fleeDistance: 10, speed: 4 },
          },
        ],
      },
      // 繁殖行動
      {
        type: 'Sequence',
        children: [
          {
            type: 'Condition',
            conditionType: 'canBreed',
            parameters: { cooldown: 300000, item: 'wheat' },
          },
          {
            type: 'Condition',
            conditionType: 'nearbyPartner',
            parameters: { range: 5 },
          },
          {
            type: 'Action',
            actionType: 'breed',
            parameters: { approachDistance: 2 },
          },
        ],
      },
      // 食事行動
      {
        type: 'Sequence',
        children: [
          {
            type: 'Condition',
            conditionType: 'hungry',
            parameters: { threshold: 50 },
          },
          {
            type: 'Condition',
            conditionType: 'nearbyGrass',
            parameters: { range: 8 },
          },
          {
            type: 'Action',
            actionType: 'eatGrass',
            parameters: { approachDistance: 1 },
          },
        ],
      },
      // デフォルト: 徘徊
      {
        type: 'Action',
        actionType: 'wander',
        parameters: { radius: 8, speed: 1.2 },
      },
    ],
  })
```

### サービス実装例

```typescript
// ✅ MobAIService実装
const makeMobAIServiceLive = Effect.gen(function* () {
  const entitySystem = yield* EntityService
  const physicsSystem = yield* PhysicsService
  const pathfinding = yield* PathfindingService

  const activeMobs = new Map<EntityId, MobAIState>()
  const behaviorTrees = new Map<string, BehaviorNode>()

  return MobAIService.of({
    updateBehaviors: (deltaTime) =>
      Effect.gen(function* () {
        const playerPositions = yield* getAllPlayerPositions()
        const entitiesToUpdate = Array.from(activeMobs.keys())

        yield* updateAIEntitiesDistributed(
          entitiesToUpdate,
          {
            maxEntitiesPerFrame: 10,
            targetFrameTime: 16,
            priorityWeights: {
              playerDistance: 0.4,
              behaviorComplexity: 0.3,
              lastUpdateTime: 0.3,
            },
          },
          deltaTime
        )
      }),

    addMob: (mobConfig) =>
      Effect.gen(function* () {
        const entityId = yield* entitySystem.createEntity()

        // AIコンポーネント追加
        yield* entitySystem.addComponent(entityId, 'AI', {
          mobType: mobConfig.mobType,
          behaviorTree: yield* createBehaviorTreeForMobType(mobConfig.mobType),
          lastUpdate: Date.now(),
          currentGoal: { type: 'Idle', wanderRadius: 8 },
        })

        // 物理コンポーネント追加
        yield* entitySystem.addComponent(entityId, 'Physics', {
          velocity: createZeroVector(),
          acceleration: createZeroVector(),
          maxSpeed: mobConfig.speed,
        })

        // 知覚コンポーネント追加
        yield* entitySystem.addComponent(entityId, 'Perception', {
          perceptionTypes: [
            {
              type: 'Vision',
              range: mobConfig.perceptionRange,
              fieldOfView: 120,
              requiresLineOfSight: true,
            },
          ],
          lastPerceptions: [],
        })

        activeMobs.set(entityId, {
          entityId,
          mobConfig,
          lastUpdateTime: Date.now(),
          behaviorState: 'RUNNING',
        })

        return entityId
      }),

    removeMob: (entityId) =>
      Effect.gen(function* () {
        activeMobs.delete(entityId)
        yield* entitySystem.removeEntity(entityId)
      }),

    setBehaviorGoal: (entityId, goal) =>
      Effect.gen(function* () {
        const aiState = activeMobs.get(entityId)
        if (!aiState) {
          return yield* Effect.fail(createAIError('Entity not found'))
        }

        yield* entitySystem.updateComponent(entityId, 'AI', {
          currentGoal: goal,
        })
      }),
  })
})

const MobAIServiceLive = Layer.effect(MobAIService, makeMobAIServiceLive)
```

## まとめ

Mob AI System は以下の特徴を持つ高度なシステムです：

### 主要機能

- **階層的行動制御**: 行動ツリーとゴール指向AIの組み合わせ
- **高性能パスファインディング**: A\*とJPSによる最適経路計算
- **包括的知覚システム**: 視界・聴覚・嗅覚による環境認識
- **群体行動**: フロッキングとリーダー追従による自然な集団行動
- **適応的LODシステム**: プレイヤー距離に基づく処理負荷調整

### パフォーマンス特性

- **Structure of Arrays**: キャッシュ効率の良いデータレイアウト
- **分散処理**: フレーム予算内でのAI更新分散
- **LOD最適化**: 距離に応じた処理詳細度調整
- **メモリ効率**: TypedArraysによる高速データアクセス

### 拡張性

- **モジュラー設計**: 行動・知覚・移動の独立したコンポーネント
- **型安全**: Effect-TSとSchemaによる堅牢な実装
- **テスト可能**: 純粋関数による決定的なテスト
- **プラガブル**: 新しいモブタイプの容易な追加

このシステムにより、Minecraftクローンに豊かで知的なモブ行動を提供できます。
