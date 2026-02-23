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
- [ ] Perlinノイズによる滑らかな地形が生成される
- [ ] 高低差のある多様な地形がある
- [ ] 少なくとも3種類のバイオームが見える

### 高度な地形特徴
- [ ] 洞窟が生成されている
- [ ] 水域がある
- [ ] 木や岩のようなランダムな特徴物がある

### パフォーマンス
- [ ] チャンク生成時間が100ms以下
- [ ] 30 FPS以上を維持

## 📝 タスク

### Day 1: Perlinノイズ実装

#### ノイズライブラリ統合
- [ ] `src/terrain/noise.ts` の作成
  - [ ] Perlinノイズの実装（またはライブラリ使用: `simplex-noise`）
  - [ ] `noise2D(x, z, seed)` 関数
  - [ ] `noise3D(x, y, z, seed)` 関数（洞窟用）
  - [ ] シードに基づく決定的な生成

#### オクターブノイズ
- [ ] 複数のオクターブを重ね合わせ
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
- [ ] `src/terrain/biome.ts` の作成
  - [ ] `BiomeType` enum
    - [ ] Plains（平原）
    - [ ] Forest（森）
    - [ ] Mountains（山地）
    - [ ] Desert（砂漠）
    - [ ] Snow Tundra（雪原）
  - [ ] `Biome` 型定義
    - [ ] surfaceBlock（地表ブロック）
    - [ ] subSurfaceBlock（地下ブロック）
    - [ ] treeChance（木が生える確率）
    - [ ] heightVariation（高度変化）

#### バイオームマップ
- [ ] 湿度と温度ノイズによるバイオーム決定
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
- [ ] `src/terrain/caves.ts` の作成
  - [ ] 3D Perlinノイズによる洞窟生成
  - [ ] 洞窟のしきい値設定
  ```typescript
  const isCave = (x, y, z) => {
    const noise = noise3D(x * 0.1, y * 0.1, z * 0.1, seed)
    return noise > 0.6 // 洞窟の閾値
  }
  ```

#### 水域生成
- [ ] 水面高度の決定
- [ ] 低地に水ブロックを配置
- [ ] 砂浜の生成（水と陸の境界）

#### 地質層
- [ ] 深度に基づくブロックタイプ
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
- [ ] `src/terrain/features.ts` の作成
  - [ ] 構造物プロシージャル生成
  - [ ] 木の生成
    - [ ] 樹幹（木材ブロック）
    - [ ] 葉（葉ブロック）
    - [ ] 異なる樹種（オーク、松、カエデ）

#### 岩・鉱石
- [ ] ランダムな岩の生成
- [ ] 地下に鉱石の生成
  - [ ] 石炭（浅い）
  - [ ] 鉄（中程度）
  - [ ] 金（深い）
- [ ] 洞窟内の生成確率を高める

### Day 5: 最適化と統合

#### チャンク生成の統合
- [ ] `src/rendering/terrain/` の更新
  - [ ] 高度な地形生成をチャンクシステムに統合
  - [ ] バイオームごとのメッシュ最適化

#### パフォーマンス最適化
- [ ] ノイズのキャッシュ
- [ ] 事前計算された地形データ
- [ ] Web Workersによる並列生成（オプション）

#### テスト
- [ ] `src/terrain/noise.test.ts` の作成
  - [ ] ノイズの一貫性
  - [ ] シードの決定性
- [ ] `src/terrain/biome.test.ts` の作成
  - [ ] バイオーム決定のテスト
- [ ] `src/terrain/caves.test.ts` の作成
  - [ ] 洞窟生成のテスト

#### 最終検証
- [ ] 多様なバイオームが見える
- [ ] 洞窟に入れる
- [ ] 水が泳げる
- [ ] 木が立っている
- [ ] 30 FPS以上
- [ ] すべてのテストが成功

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
- [地形生成システム](../docs/explanations/game-mechanics/core-features/terrain-generation.md)
- [Perlinノイズ](https://en.wikipedia.org/wiki/Perlin_noise)
