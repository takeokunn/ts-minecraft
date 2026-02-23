---
title: 'Phase 17 - The Nether'
description: 'ネザー次元とポータル'
phase: 17
estimated_duration: '4日間'
difficulty: 'advanced'
---

# Phase 17 - The Nether

## 目標
ネザー次元を実装する。ポータル生成、座標変換、ネザー固有のブロックとバイオームを追加する。

## ✅ 受け入れ条件（画面で確認）

### ポータル
- [ ] オブシディアンフレームでポータルを作れる
- [ ] 火打ちでポータルが起動する
- [ ] ポータルに入るとネザーに移動する
- [ ] ネザーから戻れる

### ネザー
- [ ] ネザーが生成されている
- [ ] ネザー固有のバイオームがある（ネザー荒原、ソウルサンド谷）
- [ ] ネザー固有のブロック（ネザーラック、クォーツ、グロウストーン）

### 座標変換
- [ ] オーバーワールド→ネザー（x/8, z/8）
- [ ] ネザー→オーバーワールド（x*8, z*8）
- [ ] リンクポータルが自動生成される

## 📝 タスク

### Day 1: 次元システム

#### 次元定義
- [ ] `src/dimension/dimension.ts` の作成
  - [ ] `Dimension` enum
    - [ ] Overworld（オーバーワールド）
    - [ ] Nether（ネザー）
    - [ ] End（エンド）
  - [ ] `DimensionManager = Context.GenericTag<DimensionManager>('@minecraft/DimensionManager')`

#### 次元切替え
- [ ] 次元ごとのチャンク管理
  ```typescript
  type WorldState = {
    dimension: Dimension
    chunks: Map<ChunkCoordinate, Chunk>
    entities: Entity[]
  }

  const switchDimension = (to: Dimension) =>
    Effect.gen(function* () {
      yield* saveCurrentWorld()
      yield* loadDimension(to)
    })
  ```
- [ ] 各次元の独立したエンティティ管理

### Day 2: ポータル実装

#### ポータル定義
- [ ] `src/dimension/portal.ts` の作成
  - [ ] `Portal` 型定義
    ```typescript
    type Portal = {
      portalId: PortalId
      position: Position
      direction: Direction
      dimension: Dimension
      targetPosition: Position
      targetDimension: Dimension
    }
    ```

#### ポータル生成
- [ ] オブシディアンフレーム（4x5）
- [ ] 火打ちでポータル起動
- [ ] ポータルテクスチャ（紫色の波）

#### 座標変換
  ```typescript
  const toNetherCoordinates = (pos: Position): Position => ({
    x: Math.floor(pos.x / 8),
    y: pos.y,
    z: Math.floor(pos.z / 8)
  })

  const toOverworldCoordinates = (pos: Position): Position => ({
    x: pos.x * 8,
    y: pos.y,
    z: pos.z * 8
  })
  ```

### Day 3: ネザー生成

#### ネザーノイズ
- [ ] ネザー用の地形生成
  - [ ] 洞窟の多い地形
  - [ ] ラバ断崖
  - [ ] ラバ海（溶岩）

#### ネザーバイオーム
- [ ] `NetherBiomeType` enum
  - [ ] Nether Wastes（ネザー荒原）
  - [ ] Soul Sand Valley（ソウルサンド谷）
  - [ ] Crimson Forest（クリムゾンの森）
  - [ ] Warped Forest（ウォープの森）

#### ネザー固有ブロック
- [ ] Netherrack（ネザーラック）
- [ ] Soul Sand（ソウルサンド）
- [ ] Glowstone（グロウストーン）
- [ ] Quartz（クォーツ）
- [ ] Basalt（玄武岩）
- [ ] Magma Block（マグマブロック）

### Day 4: ネザー固有エンティティ

#### ネザーモブ
- [ ] Piglin（ピグリン）- 金に興味
- [ ] Hoglin（ホグリン）- 敵対的
- [ ] Ghast（ガスト）- 空中、火の球
- [ ] Blaze（ブレイズ）- 飛行、火の玉

#### ネザー環境
- [ ] 溶岩のダメージ
- [ ] 空中の高速移動
- [ ] ポータルの転送エフェクト

#### ポータルリンク
- [ ] 移動先にポータルを自動生成
- [ ] リンクされたポータルの管理
- [ ] ポータルの有効期限（オプション）

#### テスト
- [ ] `src/dimension/dimension.test.ts` の作成
  - [ ] 次元切替え
  - [ ] 座標変換
- [ ] `src/dimension/portal.test.ts` の作成
  - [ ] ポータル生成
  - [ ] 移動ロジック
- [ ] `src/dimension/nether.test.ts` の作成
  - [ ] ネザー生成

#### 最終検証
- [ ] オブシディアンフレームが作れる
- [ ] 火打ちでポータルが起動する
- [ ] ポータルに入るとネザーに移動する
- [ ] ネザーが生成されている
- [ ] ネザー固有のブロックがある
- [ ] ネザー固有のモブがいる
- [ ] 30 FPS以上
- [ ] すべてのテストが成功

## 🎯 成功基準
- ポータルシステムが実装されている
- 次元切替えが機能している
- 座標変換が正確である
- ネザーが生成されている
- ネザー固有のブロックとモブがある

## 📊 依存関係
- Phase 16: Redstone

## 🔗 関連ドキュメント
- [Phase 16](./16-redstone.md)
- [次元システム](../docs/explanations/game-mechanics/core-features/dimension-system.md)
