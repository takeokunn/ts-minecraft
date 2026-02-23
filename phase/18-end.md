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

### エンド入り口
- [ ] 強化されたポータル（エンドポータル）がある
- [ ] エンドパールを投げてエンドに入る

### エンド
- [ ] エンドが生成されている
- [ ] 空中浮遊する島がある
- [ ] エンドシティがある

### エンダードラゴン
- [ ] エンダードラゴンがいる
- [ ] 飛行している
- [ ] 攻撃してくる（火の球、尾）
- [ ] 騎乗可能（エンドクリスタル破壊後）

### エンディング
- [ ] ドラゴンを倒すとエンディングが始まる
- [ ] クレジットが流れる
- [ ] リスポーンしてオーバーワールドに戻る

## 📝 タスク

### Day 1: エンド入り口

#### エンドポータル
- [ ] `src/dimension/endPortal.ts` の作成
  - [ ] 強化されたポータル（4x4ブロック）
  - [ ] エンドパール着地点検出
- [ ] エンドパールの着地エフェクト

#### エンドパール
- [ ] エンドパールアイテム
- [ ] 投げるとテレポート
- [ ] 着地ダメージがある

### Day 2: エンド生成

#### エンドストーン
- [ ] エンド固有ブロック
  - [ ] End Stone（エンドストーン）
  - [ ] End Bricks（エンドレンガ）
  - [ ] Chorus Plant（コーラス花）
  - [ ] Obsidian（黒曜石）

#### エンド地形
- [ ] 空中の浮遊島
- [ ] 中央の島（ドラゴン島）
- [ ] 外周の島群

#### 空の無限
- [ ] 空ブロック（Void）のダメージ
- [ ] 空に落ちると死亡

### Day 3: エンドシティ

#### シティ生成
- [ ] `src/dimension/endCity.ts` の作成
  - [ ] `EndCity` 型定義
    ```typescript
    type EndCity = {
      position: Position
      towers: Tower[]
      bridges: Bridge[]
      ships: Ship[]
    }
    ```

#### シティ構造
- [ ] 塔（高層、低層）
- [ ] 橋（浮遊）
- [ ] チェスト（装備、武器）
- [ ] エリトラ（エリトラフライ）

#### プレゼント
- [ ] シティ内のププレゼント
- [ ] 開くとアイテムが出る

### Day 4: エンダードラゴンAI

#### ドラゴン定義
- [ ] `src/entity/enderDragon.ts` の作成
  - [ ] `EnderDragon` 型定義
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
- [ ] 空中の自由な移動
- [ ] プレイヤーへのアプローチ
- [ ] 円軌道での飛行
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
- [ ] 火の球ブレス
- [ ] 尾による近接攻撃
- [ ] プレイヤー追跡
- [ ] エンドクリスタルへの着地

### Day 5: エンディングとテスト

#### ドラゴン戦
- [ ] ドラゴンのフェーズ
  - [ ] 100-75%: 自由飛行、火の球
  - [ ] 75-50%: プレイヤー追跡
  - [ ] 50-25%: エンドクリスタルへ
  - [ ] 25-0%: 中心で旋回、着地可能
- [ ] エンドクリスタル
  - [ ] クリスタルの破壊
  - [ ] 破壊でドラゴンを騎乗可能

#### エンディング
- [ ] ドラゴン死亡時のイベント
- [ ] クレジットシーン
  ```typescript
  type Credits = {
    lines: string[]
    speed: number
  }
  ```
- [ ] プレイヤーの解放
- [ ] オーバーワールドへのリスポーン

#### テスト
- [ ] `src/dimension/endPortal.test.ts` の作成
  - [ ] エンドパール
  - [ ] エンド移動
- [ ] `src/entity/enderDragon.test.ts` の作成
  - [ ] 飛行AI
  - [ ] 攻撃AI

#### 最終検証
- [ ] エンドパールでエンドに入れる
- [ ] エンドが生成されている
- [ ] エンドシティがある
- [ ] エンダードラゴンがいる
- [ ] ドラゴンが飛行している
- [ ] ドラゴンが攻撃してくる
- [ ] ドラゴンを倒すとエンディングが見える
- [ ] リスポーンして戻れる
- [ ] 30 FPS以上
- [ ] すべてのテストが成功

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
- [エンド次元](../docs/explanations/game-mechanics/core-features/end-dimension.md)
