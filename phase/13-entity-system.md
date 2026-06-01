---
title: 'Phase 13 - Entity System'
description: 'モブ生成とAIシステム'
phase: 13
estimated_duration: '5日間'
difficulty: 'advanced'
---

# Phase 13 - Entity System

## 目標
モブ（エンティティ）システムを実装する。モブ生成、AI行動、ステートマシン、基本的なモブを追加する。

## ✅ 受け入れ条件（画面で確認）

### モブ生成
- [x] モブがスポーンする（ゾンビ、豚、羊など）
- [x] モブが動いている（歩行、アニメーション）
- [x] 夜に敵対的モブがスポーンする

### AI行動
- [x] モブが徘徊する（ランダム歩行）
- [x] プレイヤーに気づくと追いかける（敵対的）
- [x] プレイヤーから逃げる（受動的）

### 戦闘
- [x] モブが攻撃できる
- [x] モブにダメージが入る
- [x] モブが死亡するとドロップする

*実装エビデンス: スポーン = `packages/app/application/frame/frame-maintenance.ts:127`（`MobSpawner.trySpawn`、`mobsSpawnEnabled` ゲート）→ `packages/entity/application/mob/spawner.ts:81`（8モブ定義: cow/pig/sheep/zombie/creeper/skeleton/spider/enderman、`selectMobType` が `timeService.isNight()` で HOSTILE/PASSIVE を選択）。移動+アニメ = `packages/app/application/frame/stages/entity-update-stage.ts:53`（`entityManager.update` → AI速度 `resolveAIState`/`computeStateVelocity`）+ `:127`（`applyPhysics`）+ `:157`（`updateEntityTransforms` が `packages/rendering/infrastructure/entity/walk-cycle.ts:23` の `computeLimbAngle` を消費）。AI = Wander/Chase/Flee は `packages/entity/domain/mob/state-machine.ts` の純粋関数（`packages/entity/application/mob/entity-manager.ts:213,260` で駆動）。モブ→プレイヤー戦闘 = `packages/app/application/frame/stages/physics-stage.ts:70`（`getPlayerContactDamage`、`:72` 防具軽減、`:75` ヒット音）。プレイヤー→モブ戦闘 = `packages/app/application/frame/stages/interaction-block-handler.ts:189`（`applyDamage`）→ `:190-194`（ドロップ→インベントリ）→ `:197`（XP）。回帰ガード: `packages/entity/test/mob/phase-13-acceptance.test.ts`（9テスト緑）。*

## 📝 タスク

### Day 1: エンティティシステム基盤

#### エンティティ定義
- [x] `src/entity/entity.ts` の作成 → `packages/entity/domain/mob/entity.ts`
  - [x] `Entity` 型定義 → `packages/entity/domain/mob/entity.ts`（`ManagedEntity` は `packages/entity/domain/mob/entity-internal.ts`）
    ```typescript
    type Entity = {
      entityId: EntityId
      position: Position
      velocity: Vector3
      rotation: Quaternion
      health: number
      type: EntityType
    }
    ```
  - [x] `EntityIdSchema`（ブランドタイプ）→ `packages/entity/domain/mob/entity.ts`
  - [x] `EntityType` enum → `packages/entity/domain/mob/mob-categories.ts`（`PASSIVE_MOBS`/`HOSTILE_MOBS`）

#### エンティティマネージャー
- [x] `src/entity/entityManager.ts` の作成 → `packages/entity/application/mob/entity-manager.ts`
  - [x] `EntityManager = Context.GenericTag<EntityManager>('@minecraft/EntityManager')` → `Effect.Service` 形式（`EntityManagerLive = EntityManager.Default`）
  - [x] エンティティの追加・削除 → `addEntity`/`applyDamage`（致死で削除）
  - [x] エンティティの更新ループ → `update`（AI速度 + 昼焼け）、`entity-update-stage.ts:53` で駆動
  - [x] エンティティの検索 → `getEntity`/`findAttackableEntity`/`getPlayerContactDamage`

### Day 2: モブスポーン

#### スポーンシステム
- [x] `src/entity/spawner.ts` の作成 → `packages/entity/application/mob/spawner.ts`
  - [x] `MobSpawner = Context.GenericTag<MobSpawner>('@minecraft/MobSpawner')` → `Effect.Service` 形式（TimeService 依存）

#### スポーン条件
- [x] 夜間の敵対的モブスポーン → `selectMobType` が `isNight` で HOSTILE_MOBS を返す（`spawner.ts:21-27`、`timeService.isNight()` ソース）
- [x] 昼間の受動的モブスポーン → 同上、昼は PASSIVE_MOBS
- [x] スポーン距離（プレイヤーから）→ MIN/MAX/DESPAWN 距離（`spawner-config.ts`）
- [x] スポーン密度上限 → `MAX_ENTITY_COUNT=24`（`spawner-config.ts:11`）、`SPAWN_INTERVAL_FRAMES=6`（`:14`）

#### スポーンロジック
  ```typescript
  const trySpawn = (playerPos: Position) =>
    Effect.gen(function* () {
      const isNight = yield* isNightTime()
      const mobType = isNight ? HostileMob : PassiveMob
      const spawnPos = getRandomSpawnPosition(playerPos)
      if (isValidSpawn(spawnPos)) {
        yield* spawnEntity(mobType, spawnPos)
      }
    })
  ```

### Day 3: AIステートマシン

#### ステート定義
- [x] `src/ai/stateMachine.ts` の作成 → `packages/entity/domain/mob/state-machine.ts`（純粋・THREEフリー、entities barrel から re-export）
  - [x] `AIState` enum → `AIState`（`state-machine.ts`）
    - [x] Idle（待機）
    - [x] Wander（徘徊）
    - [x] Chase（追跡）
    - [x] Flee（逃走）
    - [x] Attack（攻撃）

#### ステート遷移
- [x] 状態遷移ロジック → `resolveAIState`（`state-machine.ts:43-57`）、`entity-manager.ts:213` で駆動。注: 距離ベース `canSeePlayer`（`entity-manager.ts:216`）を使用。下記コード例の `hasLineOfSight`（LOSレイキャスト）は **将来作業**（未実装）
  ```typescript
  type StateTransition = {
    from: AIState
    to: AIState
    condition: () => boolean
  }

  const updateState = (entity: Entity, player: Player) => {
    const distance = getDistance(entity, player)
    const canSeePlayer = hasLineOfSight(entity, player)

    if (canSeePlayer && distance < 16) {
      return AIState.Chase
    }
    if (Math.random() < 0.01) {
      return AIState.Wander
    }
    return entity.currentState
  }
  ```

### Day 4: AI行動実装

#### 徘徊AI
- [x] ランダムな移動方向 → `makeWanderDirectionFromHash`（`entity-manager.ts:257`）+ `computeStateVelocity` Wander枝（`state-machine.ts:100-101`）
- [ ] 障害物回避 → **将来作業**（A*/障害物回避は未実装。現状は `applyPhysics` の auto-hop のみ）
- [x] 一定時間後に方向変更 → 決定論的per-entityハッシュ + `randomWanderRoll`（`state-machine.ts:51-57`）

#### 追跡AI（敵対的）
- [ ] プレイヤーへのパス検出 → **将来作業**（A*/パスファインディングは未実装。下記参照）
- [x] プレイヤーに向かって移動 → `computeStateVelocity` Chase枝（`state-machine.ts:96-97`）、`canSeePlayer = distSq <= detectionRange^2`（`entity-manager.ts:216`）
- [x] 攻撃範囲内で攻撃 → `getPlayerContactDamage`（`entity-manager.ts:177-194`、`attackRange` 内のHOSTILE集計、`HOSTILE_ATTACK_COOLDOWN_SECS=1`）

#### 逃走AI（受動的）
- [x] プレイヤーから離れる方向 → `computeStateVelocity` Flee枝（`state-machine.ts:98-99`）、PASSIVE が detection 内（`state-machine.ts:43,48`）
- [x] 安全な距離まで移動 → detectionRange 外で Wander/Idle へ遷移（`resolveAIState`）

### Day 5: 基本的なモブ

#### モブタイプ
- [x] `src/entity/mobs/` ディレクトリの作成 → `packages/entity/domain/mob/mobs/`
  - [x] Zombie（ゾンビ）- 敵対的 → `mobs/zombie.ts`（drops `[{ROTTEN_FLESH,1}]`）
  - [x] Cow（牛）- 受動的 → `mobs/cow.ts`（drops `[{RAW_BEEF,1},{LEATHER,1}]`）
  - [x] Pig（豚）- 受動的 → `mobs/pig.ts`
  - [x] Sheep（羊）- 受動的 → `mobs/sheep.ts`（追加: creeper/skeleton/spider/enderman も `mobs/`）

#### モブプロパティ
  ```typescript
  type MobType = {
    id: EntityId
    type: EntityType
    health: number
    damage: number
    speed: number
    behavior: Hostile | Passive
    drops: ItemStack[]
  }
  ```

#### モブのレンダリング
- [x] モブ用のメッシュ → `packages/rendering/infrastructure/entity/{mob-geometry,entity-renderer}.ts`（InstancedMesh バケット ≤24 ドローコール）
- [x] アニメーション（足、腕）→ `packages/rendering/infrastructure/entity/walk-cycle.ts`（`computeLimbAngle`、腕脚アンチフェーズ）、`entity-renderer.ts:213-216` で消費
- [x] テクスチャ → `packages/rendering/infrastructure/entity/` のモブマテリアル

#### テスト
- [x] `src/entity/entity.test.ts` の作成 → `packages/entity/test/mob/entity-manager.test.ts`
  - [x] エンティティ管理
- [x] `src/ai/stateMachine.test.ts` の作成 → ステートマシン純粋関数は `packages/entity/test/mob/` 配下（加えて回帰ガード `packages/entity/test/mob/phase-13-acceptance.test.ts`）
  - [x] ステート遷移
  - [x] AI行動
- [x] `src/entity/spawner.test.ts` の作成 → `packages/entity/test/mob/spawner.test.ts`
  - [x] スポーン条件

#### 最終検証
> 注: 機能的にはすべて WIRED 済み（実装エビデンスは上記 受け入れ条件 ブロック参照）。最終ゲートは **全通過**: `pnpm typecheck` 0 errors / `pnpm lint` 0 warnings / `pnpm vitest run` **3791 passed (0 failed, 308 files)** / `pnpm build` exit 0（2026-05-30 直接検証）。回帰ガード: `packages/entity/test/mob/phase-13-acceptance.test.ts`（AI Chase/Flee/Attack 遷移・接触ダメージ＋クールダウン減衰・ドロップ・日中燃焼カデンス・デスポーン距離）と `packages/rendering/test/walk-cycle.test.ts`（`computeLimbAngle` 純粋関数: ゼロ速度→0・振動・腕脚逆位相）。
- [x] モブがスポーンする（機能WIRED: `frame-maintenance.ts:127` `trySpawn`）
- [x] モブが移動する（機能WIRED: `entity-update-stage.ts:53` AI速度 + `:127` 物理）
- [x] AIが正しく動作する（機能WIRED: `resolveAIState`/`computeStateVelocity`、`entity-manager.ts:213,260`）
- [x] モブに攻撃できる（機能WIRED: `interaction-block-handler.ts:189` `applyDamage`、`frame-handler.ts:357` 経由）
- [x] モブが死亡するとドロップする（機能WIRED: `interaction-block-handler.ts:190-194` ドロップ + `:197` XP）
- [x] 30 FPS以上（**設計キャップで担保 + 手動QA**: `MAX_ENTITY_COUNT=24`（`spawner-config.ts:11`）+ `SPAWN_INTERVAL_FRAMES=6`（`:14`）+ InstancedMesh バケットレンダリング + `structureVersion` 変化ゲート描画（`entity-update-stage.ts:150`）。自動パフォーマンステストではない）
- [x] すべてのテストが成功（`pnpm vitest run` **3791 passed / 0 failed, 308 files**）

## 🎯 成功基準
- エンティティシステムが実装されている
- モブが正しくスポーンする
- AI行動（徘徊、追跡、逃走）が機能している
- Effect-TSパターンで実装されている

## 📊 依存関係
- Phase 12: Combat System

## 🔗 関連ドキュメント
- [Phase 12](./12-combat.md)
- [エンティティシステム](../docs/explanations/game-mechanics/core-features/entity-system.md)
- [AIステートマシン](../docs/explanations/game-mechanics/core-features/ai-state-machine.md)

## 将来作業 (本Phaseの受け入れ条件外)
以下はいずれの受け入れ条件・最終検証にも紐づかない仕様上の拡張であり、本Phaseでは **未実装（flag-don't-build）** として明示的に保留する。各々が新規サブシステムであり、半端な実装は行わない。
- 視線判定（LOSレイキャスト）: 現状の `canSeePlayer` は距離ベース（`entity-manager.ts:216`）。レイキャストによる遮蔽判定は未実装。
- A*/パスファインディング・障害物回避: 追跡は直線ベクトル + `applyPhysics` の auto-hop のみ。経路探索は未実装。
- クリーパーの起爆（detonation）。
- スケルトンの弓射撃（ranged attack）。
- フローティングダメージ数値 / クリティカルスター スプライト（パーティクル系はブロックアトラスUV専用で専用テクスチャ無し）。
