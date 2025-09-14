---
title: "12 Extended Biome System"
description: "12 Extended Biome Systemに関する詳細な説明とガイド。"
category: "specification"
difficulty: "intermediate"
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: "5分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# Extended Biome System（拡張バイオーム）

## 概要

Extended Biome Systemは、基本的なバイオームを拡張し、より多様で探索しがいのある世界を提供するシステムです。海洋、山岳、特殊バイオームなどを追加し、それぞれに固有の地形、ブロック、Mob、構造物を生成します。

## システム設計

### 1. 追加バイオーム

#### 1.1 海洋系 (Oceanic)
- **暖海 (Warm Ocean)**: 珊瑚礁、熱帯魚、イルカがスポーン。海底は砂。
- **冷海 (Cold Ocean)**: 鮭、タラがスポーン。海底は砂利。
- **凍海 (Frozen Ocean)**: 氷山、シロクマが特徴。
- **深海 (Deep Ocean)**: 海底神殿、ガーディアンがスポーン。水深が深い。

#### 1.2 山岳系 (Mountainous)
- **雪山 (Snowy Slopes)**: 雪ブロック、ヤギがスポーン。
- **石の崖 (Stony Peaks)**: 石と砂利で構成される崖。
- **草地 (Meadow)**: 花が多く、ウサギや羊がスポーンする穏やかな地形。

#### 1.3 特殊系 (Special)
- **キノコ島 (Mushroom Fields)**: 菌糸ブロック、巨大キノコ、ムーシュルームが特徴。敵対Mobがスポーンしない。
- **荒地 (Badlands)**: テラコッタ、廃坑が豊富。金鉱石が通常より高い位置で生成される。
- **竹林 (Bamboo Jungle)**: 竹、パンダがスポーン。

### 2. バイオーム生成ロジック

- **温度 (Temperature)**, **湿度 (Humidity)**, **高度 (Altitude)**, **奇妙さ (Weirdness)** の4つのノイズマップを組み合わせてバイオームを決定する。
- バイオーム同士の境界は自然にブレンドされるようにする。

```typescript
// バイオーム決定ロジック
export const determineBiome = (
  temperature: number,
  humidity: number,
  altitude: number,
  weirdness: number
): Biome => {
  if (altitude > 1.5) {
    if (temperature < 0) return Biomes.SnowySlopes;
    return Biomes.StonyPeaks;
  }
  if (temperature > 0.8 && humidity > 0.8) {
    return Biomes.BambooJungle;
  }
  // ... 他のバイオームの条件
  return Biomes.Plains;
};
```

### 3. バイオーム固有の要素

- **ブロック**: 珊瑚ブロック（暖海）、氷塊（凍海）、菌糸（キノコ島）など
- **Mob**: ヤギ（山岳）、パンダ（竹林）、ムーシュルーム（キノコ島）など
- **構造物**: 海底神殿（深海）、廃坑（荒地）など

## UI統合

- **デバッグ画面 (F3)**: 現在のバイオーム名を表示
- **マップアイテム**: バイオームごとに異なる色で表示

## パフォーマンス

- **バイオームキャッシュ**: 一度計算したチャンクのバイオーム情報はキャッシュして再利用
- **LOD**: 遠くのバイオームの詳細は簡略化

## テストケース

- [ ] 全ての拡張バイオームがワールドに正しく生成されること
- [ ] 各バイオームに固有のブロック、Mob、構造物が生成されること
- [ ] バイオーム間の境界が自然であること
- [ ] バイオームの決定ロジックが意図通りに機能すること
