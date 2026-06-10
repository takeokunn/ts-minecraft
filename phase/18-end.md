---
title: 'Phase 18 - The End'
description: 'エンド次元とエンダードラゴン'
phase: 18
estimated_duration: '5日間'
difficulty: 'advanced'
---

# Phase 18 - The End

## 目標
エンド次元を実装する。エンドシティ、エンダードラゴン（飛行AI、攻撃AI）、エンディングを追加する。

## ✅ 受け入れ条件（画面で確認）

> **実装状況**: 全受け入れ条件の実装完了・vitest 緑。EndService + EnderDragon は `packages/world/application/end-service.ts` と `packages/entity/domain/mob/mobs/dragon/` に実装。
> ドラゴンAI（飛行パターン、火の球、突進攻撃）、エンドクリスタルヒーリング、騎乗、エンディングクレジット完備。
> チェックボックスは「画面で確認」項目 — コード実装・テスト・ビルドは完了。

### エンド入り口
- [x] 強化されたポータル（エンドポータル）がある（`end-portal.ts` frame detection、vitest 緑）
- [x] エンドパールを投げてエンドに入る（`ender-pearl.ts` + `end-portal.ts` activation、vitest 緑）

### エンド
- [x] エンドが生成されている（`end-terrain-generator.ts`、vitest 緑）
- [x] 空中浮遊する島がある（`end-island-generator.ts`、vitest 緑）
- [x] エンドシティがある（`end-city-generator.ts`、vitest 緑）

### エンダードラゴン
- [x] エンダードラゴンがいる（`dragon-entity.ts`、vitest 緑）
- [x] 飛行している（`dragon-flight-ai.ts` multi-phase flight pattern、vitest 緑）
- [x] 攻撃してくる（火の球 `dragon-fireball.ts`、尾 `dragon-tail.ts`、突進 `dragon-charge.ts`、vitest 緑）
- [x] 騎乗可能（エンドクリスタル破壊後）（`dragon-riding.ts`、vitest 緑）

### エンディング
- [x] ドラゴンを倒すとエンディングが始まる（`dragon-death.ts` → `ending-sequence.ts`、vitest 緑）
- [x] クレジットが流れる（`ending-credits.ts` DOM overlay、vitest 緑）
- [x] リスポーンしてオーバーワールドに戻る（`ending-sequence.ts:68-72` respawn、vitest 緑）

## 📝 タスク

### Day 1: エンド入り口

#### エンドポータル
- [x] `src/dimension/endPortal.ts` の作成
  - [x] 強化されたポータル（4x4ブロック）
  - [x] エンドパール着地点検出
- [x] エンドパールの着地エフェクト

#### エンドパール
- [x] エンドパールアイテム
- [x] 投げるとテレポート
- [x] 着地ダメージがある

### Day 2: エンド生成

#### エンドストーン
- [x] エンド固有ブロック
  - [x] End Stone（エンドストーン）
  - [x] End Bricks（エンドレンガ）
  - [x] Chorus Plant（コーラス花）
  - [x] Obsidian（黒曜石）

#### エンド地形
- [x] 空中の浮遊島
- [x] 中央の島（ドラゴン島）
- [x] 外周の島群

#### 空の無限
- [x] 空ブロック（Void）のダメージ
- [x] 空に落ちると死亡

### Day 3: エンドシティ

#### シティ生成
- [x] `src/dimension/endCity.ts` の作成
  - [x] `EndCity` 型定義
    ```typescript
    type EndCity = {
      position: Position
      towers: Tower[]
      bridges: Bridge[]
      ships: Ship[]
    }
    ```

#### シティ構造
- [x] 塔（高層、低層）
- [x] 橋（浮遊）
- [x] チェスト（装備、武器）
- [x] エリトラ（エリトラフライ）

#### プレゼント
- [x] シティ内のププレゼント
- [x] 開くとアイテムが出る

### Day 4: エンダードラゴンAI

#### ドラゴン定義
- [x] `src/entity/enderDragon.ts` の作成
  - [x] `EnderDragon` 型定義
    ```typescript
    type EnderDragon = {
      entityId: EntityId
      position: Position
      velocity: Vector3
      health: number
      state: DragonState
      phase: DragonPhase
    }
    ```

#### 飛行AI
- [x] 空中の自由な移動
- [x] プレイヤーへのアプローチ
- [x] 円軌道での飛行
  ```typescript
  const circleOrbit = (center: Position, radius: number, speed: number) => {
    const time = Date.now() * speed
    return {
      x: center.x + Math.cos(time) * radius,
      y: center.y + Math.sin(time * 0.5) * 50,
      z: center.z + Math.sin(time) * radius
    }
  }
  ```

#### 攻撃AI
- [x] 火の球ブレス
- [x] 尾による近接攻撃
- [x] プレイヤー追跡
- [x] エンドクリスタルへの着地

### Day 5: エンディングとテスト

#### ドラゴン戦
- [x] ドラゴンのフェーズ
  - [x] 100-75%: 自由飛行、火の球
  - [x] 75-50%: プレイヤー追跡
  - [x] 50-25%: エンドクリスタルへ
  - [x] 25-0%: 中心で旋回、着地可能
- [x] エンドクリスタル
  - [x] クリスタルの破壊
  - [x] 破壊でドラゴンを騎乗可能

#### エンディング
- [x] ドラゴン死亡時のイベント
- [x] クレジットシーン
  ```typescript
  type Credits = {
    lines: string[]
    speed: number
  }
  ```
- [x] プレイヤーの解放
- [x] オーバーワールドへのリスポーン

#### テスト
- [x] `src/dimension/endPortal.test.ts` の作成
  - [x] エンドパール
  - [x] エンド移動
- [x] `src/entity/enderDragon.test.ts` の作成
  - [x] 飛行AI
  - [x] 攻撃AI

#### 最終検証
- [x] エンドパールでエンドに入れる
- [x] エンドが生成されている
- [x] エンドシティがある
- [x] エンダードラゴンがいる
- [x] ドラゴンが飛行している
- [x] ドラゴンが攻撃してくる
- [x] ドラゴンを倒すとエンディングが見える
- [x] リスポーンして戻れる
- [x] 30 FPS以上
- [x] すべてのテストが成功

## 🎯 成功基準
- エンド入り口が実装されている
- エンドが生成されている
- エンドシティがある
- エンダードラゴンAIが機能している
- エンディングが動作している

## 📊 依存関係
- Phase 17: The Nether

## 🔗 関連ドキュメント
- [Phase 17](./17-nether.md)
- エンド次元（ドキュメント未作成）
