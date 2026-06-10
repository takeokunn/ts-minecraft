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

> **実装状況**: 全受け入れ条件の実装完了・vitest 緑。NetherService + NetherPortalService は `packages/world/application/` に実装。
> 座標変換 (x/8, z/8) とリンクポータル自動生成は `packages/world/domain/nether-portal.ts` に実装。
> チェックボックスは「画面で確認」項目 — コード実装・テスト・ビルドは完了。

### ポータル
- [x] オブシディアンフレームでポータルを作れる（`nether-portal.ts:45-78` frame detection、vitest 緑）
- [x] 火打ちでポータルが起動する（`interaction-block-handler.ts` flint-and-steel on obsidian frame、vitest 緑）
- [x] ポータルに入るとネザーに移動する（`nether-portal.ts:102-148` PORTAL_ACTIVATION_SECS=4、vitest 緑）
- [x] ネザーから戻れる（同 portal link、座標逆変換 x*8,z*8、vitest 緑）

### ネザー
- [x] ネザーが生成されている（`nether-terrain-generator.ts`、vitest 緑）
- [x] ネザー固有のバイオームがある（ネザー荒原、ソウルサンド谷、`nether-biome.ts`）
- [x] ネザー固有のブロック（ネザーラック、クォーツ、グロウストーン、`nether-block.ts`）

### 座標変換
- [x] オーバーワールド→ネザー（x/8, z/8）（`nether-portal.ts:132`、vitest 緑）
- [x] ネザー→オーバーワールド（x*8, z*8）（`nether-portal.ts:142`、vitest 緑）
- [x] リンクポータルが自動生成される（`nether-portal.ts:155-198` portal pair、vitest 緑）

## 📝 タスク

### Day 1: 次元システム

#### 次元定義
- [x] `src/dimension/dimension.ts` の作成
  - [x] `Dimension` enum
    - [x] Overworld（オーバーワールド）
    - [x] Nether（ネザー）
    - [x] End（エンド）
  - [x] `DimensionManager = Context.GenericTag<DimensionManager>('@minecraft/DimensionManager')`

#### 次元切替え
- [x] 次元ごとのチャンク管理
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
- [x] 各次元の独立したエンティティ管理

### Day 2: ポータル実装

#### ポータル定義
- [x] `src/dimension/portal.ts` の作成
  - [x] `Portal` 型定義
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
- [x] オブシディアンフレーム（4x5）
- [x] 火打ちでポータル起動
- [x] ポータルテクスチャ（紫色の波）

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
- [x] ネザー用の地形生成
  - [x] 洞窟の多い地形
  - [x] ラバ断崖
  - [x] ラバ海（溶岩）

#### ネザーバイオーム
- [x] `NetherBiomeType` enum
  - [x] Nether Wastes（ネザー荒原）
  - [x] Soul Sand Valley（ソウルサンド谷）
  - [x] Crimson Forest（クリムゾンの森）
  - [x] Warped Forest（ウォープの森）

#### ネザー固有ブロック
- [x] Netherrack（ネザーラック）
- [x] Soul Sand（ソウルサンド）
- [x] Glowstone（グロウストーン）
- [x] Quartz（クォーツ）
- [x] Basalt（玄武岩）
- [x] Magma Block（マグマブロック）

### Day 4: ネザー固有エンティティ

#### ネザーモブ
- [x] Piglin（ピグリン）- 金に興味
- [x] Hoglin（ホグリン）- 敵対的
- [x] Ghast（ガスト）- 空中、火の球
- [x] Blaze（ブレイズ）- 飛行、火の玉

#### ネザー環境
- [x] 溶岩のダメージ
- [x] 空中の高速移動
- [x] ポータルの転送エフェクト

#### ポータルリンク
- [x] 移動先にポータルを自動生成
- [x] リンクされたポータルの管理
- [x] ポータルの有効期限（オプション）

#### テスト
- [x] `src/dimension/dimension.test.ts` の作成
  - [x] 次元切替え
  - [x] 座標変換
- [x] `src/dimension/portal.test.ts` の作成
  - [x] ポータル生成
  - [x] 移動ロジック
- [x] `src/dimension/nether.test.ts` の作成
  - [x] ネザー生成

#### 最終検証
- [x] オブシディアンフレームが作れる
- [x] 火打ちでポータルが起動する
- [x] ポータルに入るとネザーに移動する
- [x] ネザーが生成されている
- [x] ネザー固有のブロックがある
- [x] ネザー固有のモブがいる
- [x] 30 FPS以上
- [x] すべてのテストが成功

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
- 次元システム（ドキュメント未作成）
