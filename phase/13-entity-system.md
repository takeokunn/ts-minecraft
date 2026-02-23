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
- [ ] モブがスポーンする（ゾンビ、豚、羊など）
- [ ] モブが動いている（歩行、アニメーション）
- [ ] 夜に敵対的モブがスポーンする

### AI行動
- [ ] モブが徘徊する（ランダム歩行）
- [ ] プレイヤーに気づくと追いかける（敵対的）
- [ ] プレイヤーから逃げる（受動的）

### 戦闘
- [ ] モブが攻撃できる
- [ ] モブにダメージが入る
- [ ] モブが死亡するとドロップする

## 📝 タスク

### Day 1: エンティティシステム基盤

#### エンティティ定義
- [ ] `src/entity/entity.ts` の作成
  - [ ] `Entity` 型定義
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
  - [ ] `EntityIdSchema`（ブランドタイプ）
  - [ ] `EntityType` enum

#### エンティティマネージャー
- [ ] `src/entity/entityManager.ts` の作成
  - [ ] `EntityManager = Context.GenericTag<EntityManager>('@minecraft/EntityManager')`
  - [ ] エンティティの追加・削除
  - [ ] エンティティの更新ループ
  - [ ] エンティティの検索

### Day 2: モブスポーン

#### スポーンシステム
- [ ] `src/entity/spawner.ts` の作成
  - [ ] `MobSpawner = Context.GenericTag<MobSpawner>('@minecraft/MobSpawner')`

#### スポーン条件
- [ ] 夜間の敵対的モブスポーン
- [ ] 昼間の受動的モブスポーン
- [ ] スポーン距離（プレイヤーから）
- [ ] スポーン密度上限

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
- [ ] `src/ai/stateMachine.ts` の作成
  - [ ] `AIState` enum
    - [ ] Idle（待機）
    - [ ] Wander（徘徊）
    - [ ] Chase（追跡）
    - [ ] Flee（逃走）
    - [ ] Attack（攻撃）

#### ステート遷移
- [ ] 状態遷移ロジック
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
- [ ] ランダムな移動方向
- [ ] 障害物回避
- [ ] 一定時間後に方向変更

#### 追跡AI（敵対的）
- [ ] プレイヤーへのパス検出
- [ ] プレイヤーに向かって移動
- [ ] 攻撃範囲内で攻撃

#### 逃走AI（受動的）
- [ ] プレイヤーから離れる方向
- [ ] 安全な距離まで移動

### Day 5: 基本的なモブ

#### モブタイプ
- [ ] `src/entity/mobs/` ディレクトリの作成
  - [ ] Zombie（ゾンビ）- 敵対的
  - [ ] Cow（牛）- 受動的
  - [ ] Pig（豚）- 受動的
  - [ ] Sheep（羊）- 受動的

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
- [ ] モブ用のメッシュ
- [ ] アニメーション（足、腕）
- [ ] テクスチャ

#### テスト
- [ ] `src/entity/entity.test.ts` の作成
  - [ ] エンティティ管理
- [ ] `src/ai/stateMachine.test.ts` の作成
  - [ ] ステート遷移
  - [ ] AI行動
- [ ] `src/entity/spawner.test.ts` の作成
  - [ ] スポーン条件

#### 最終検証
- [ ] モブがスポーンする
- [ ] モブが移動する
- [ ] AIが正しく動作する
- [ ] モブに攻撃できる
- [ ] モブが死亡するとドロップする
- [ ] 30 FPS以上
- [ ] すべてのテストが成功

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
