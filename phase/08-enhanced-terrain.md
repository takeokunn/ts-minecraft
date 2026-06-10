---
title: 'Phase 08 - Enhanced Terrain Generation'
description: '高度な地形生成システム（Perlinノイズ、バイオーム、洞窟）'
phase: 8
estimated_duration: '5日間'
difficulty: 'intermediate'
---

# Phase 08 - Enhanced Terrain Generation

## 目標
Perlinノイズを使用した高度な地形生成システムを実装する。バイオーム、洞窟、地質構造を追加する。

## ✅ 受け入れ条件（画面で確認）

### 地形生成
- [x] Perlinノイズによる滑らかな地形が生成される
- [x] 高低差のある多様な地形がある
- [x] 少なくとも3種類のバイオームが見える

### 高度な地形特徴
- [x] 洞窟が生成されている
- [x] 水域がある
- [x] 木や岩のようなランダムな特徴物がある

### パフォーマンス
- [x] チャンク生成時間が100ms以下
- [x] 30 FPS以上を維持

## 📝 タスク

### Day 1: Perlinノイズ実装

#### ノイズライブラリ統合
- [x] `src/terrain/noise.ts` の作成
  - [x] Perlinノイズの実装（またはライブラリ使用: `simplex-noise`）
  - [x] `noise2D(x, z, seed)` 関数
  - [x] `noise3D(x, y, z, seed)` 関数（洞窟用）
  - [x] シードに基づく決定的な生成

#### オクターブノイズ
- [x] 複数のオクターブを重ね合わせ
  ```typescript
  const fbm = (x: number, z: number) => {
    let value = 0
    let amplitude = 1
    let frequency = 1
    for (let i = 0; i < octaves; i++) {
      value += amplitude * noise2D(x * frequency, z * frequency)
      amplitude *= persistence
      frequency *= lacunarity
    }
    return value
  }
  ```

### Day 2: バイオームシステム

#### バイオーム定義
- [x] `src/terrain/biome.ts` の作成
  - [x] `BiomeType` enum
    - [x] Plains（平原）
    - [x] Forest（森）
    - [x] Mountains（山地）
    - [x] Desert（砂漠）
    - [x] Snow Tundra（雪原）
  - [x] `Biome` 型定義
    - [x] surfaceBlock（地表ブロック）
    - [x] subSurfaceBlock（地下ブロック）
    - [x] treeChance（木が生える確率）
    - [x] heightVariation（高度変化）

#### バイオームマップ
- [x] 湿度と温度ノイズによるバイオーム決定
  ```typescript
  const getBiome = (temperature: number, humidity: number) => {
    if (temperature < 0.3) return BiomeType.SnowTundra
    if (temperature > 0.7 && humidity < 0.3) return BiomeType.Desert
    if (humidity > 0.7) return BiomeType.Forest
    if (temperature > 0.6) return BiomeType.Mountains
    return BiomeType.Plains
  }
  ```

### Day 3: 洞窟と地質構造

#### 洞窟生成
- [x] `src/terrain/caves.ts` の作成
  - [x] 3D Perlinノイズによる洞窟生成
  - [x] 洞窟のしきい値設定
  ```typescript
  const isCave = (x, y, z) => {
    const noise = noise3D(x * 0.1, y * 0.1, z * 0.1, seed)
    return noise > 0.6 // 洞窟の閾値
  }
  ```

#### 水域生成
- [x] 水面高度の決定
- [x] 低地に水ブロックを配置
- [x] 砂浜の生成（水と陸の境界）

#### 地質層
- [x] 深度に基づくブロックタイプ
  ```typescript
  const getBlockAtDepth = (y: number, biome: BiomeType) => {
    if (y < waterLevel) return BlockType.Water
    if (y === surface) return biome.surfaceBlock
    if (y < surface - 3) return biome.subSurfaceBlock
    if (y < surface - 10) return BlockType.Dirt
    return BlockType.Stone
  }
  ```

### Day 4: 特徴物生成

#### 木の生成
- [x] `src/terrain/features.ts` の作成
  - [x] 構造物プロシージャル生成
  - [x] 木の生成
    - [x] 樹幹（木材ブロック）
    - [x] 葉（葉ブロック）
    - [x] 異なる樹種（オーク、松、カエデ）

#### 岩・鉱石
- [x] ランダムな岩の生成
- [x] 地下に鉱石の生成
  - [x] 石炭（浅い）
  - [x] 鉄（中程度）
  - [x] 金（深い）
- [x] 洞窟内の生成確率を高める

### Day 5: 最適化と統合

#### チャンク生成の統合
- [x] `src/rendering/terrain/` の更新
  - [x] 高度な地形生成をチャンクシステムに統合
  - [x] バイオームごとのメッシュ最適化

#### パフォーマンス最適化
- [x] ノイズのキャッシュ
- [x] 事前計算された地形データ
- [x] Web Workersによる並列生成（オプション）

#### テスト
- [x] `src/terrain/noise.test.ts` の作成
  - [x] ノイズの一貫性
  - [x] シードの決定性
- [x] `src/terrain/biome.test.ts` の作成
  - [x] バイオーム決定のテスト
- [x] `src/terrain/caves.test.ts` の作成
  - [x] 洞窟生成のテスト

#### 最終検証
- [x] 多様なバイオームが見える
- [x] 洞窟に入れる
- [x] 水が泳げる
- [x] 木が立っている
- [x] 30 FPS以上
- [x] すべてのテストが成功

## 🎯 成功基準
- Perlinノイズによる滑らかな地形生成
- 3種類以上のバイオーム
- 洞窟、水域、特徴物の生成
- パフォーマンスが維持されている
- Effect-TSパターンでの実装

## 📊 依存関係
- Phase 07: MVP Polish

## 🔗 関連ドキュメント
- [Phase 07](./07-mvp-polish.md)
- 地形生成システム（ドキュメント未作成）
- [Perlinノイズ](https://en.wikipedia.org/wiki/Perlin_noise)
