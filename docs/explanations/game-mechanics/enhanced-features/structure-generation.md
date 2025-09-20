---
title: '09 Structure Generation'
description: '09 Structure Generationに関する詳細な説明とガイド。'
category: 'specification'
difficulty: 'intermediate'
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: '10分'
---

# Structure Generation（構造物生成）

## 概要

ワールド内に自動生成される構造物（村・ダンジョン・要塞・神殿等）のプロシージャル生成システム。世界に多様性と探索要素を追加する重要な機能。

## システム設計

### 構造物分類

#### 自然構造物

- **洞窟系**: 自然洞窟・地下河川・鍾乳洞・峡谷
- **鉱脈**: 各種鉱石の集中帯・希少鉱物の特殊配置
- **地形特徴**: 自然の橋・巨大な木・特殊岩石構造

#### 人工構造物

- **村**: 住民が住む建物群・農地・道路
- **要塞**: 地下の石レンガ構造・エンドポータル
- **神殿**: ジャングル神殿・砂漠神殿・海底神殿
- **ダンジョン**: モンスタースポナー付きの小部屋

#### 技術実装

```typescript
// 構造物スキーマ
export const Structure = Schema.Struct({
  type: Schema.Union(
    Schema.Literal('village'),
    Schema.Literal('dungeon'),
    Schema.Literal('stronghold'),
    Schema.Literal('temple'),
    Schema.Literal('mansion'),
    Schema.Literal('monument'),
    Schema.Literal('ruins'),
    Schema.Literal('cave_system')
  ),
  position: Position,
  size: Schema.Struct({
    width: Schema.Number,
    height: Schema.Number,
    depth: Schema.Number,
  }),
  orientation: Schema.Number, // 回転角度
  integrity: pipe(Schema.Number, Schema.between(0, 1)), // 破損度
  seed: Schema.Number,
  biome: Schema.String,
  generatedAt: Schema.DateTimeUtc,
  lootTables: Schema.Array(Schema.String),
  spawners: Schema.Array(
    Schema.Struct({
      position: Position,
      mobType: Schema.String,
      spawnRate: Schema.Number,
    })
  ),
})

// 構造物生成マネージャー（最新Context.GenericTagパターン）
interface StructureGenerationManagerInterface {
  readonly generateStructuresForChunk: (chunkPos: ChunkPosition) => Effect.Effect<Structure[], StructureGenerationError>
  readonly checkStructureGeneration: (chunkPos: ChunkPosition, structureType: StructureType) => Effect.Effect<boolean>
  readonly generateStructure: (
    chunkPos: ChunkPosition,
    structureType: StructureType
  ) => Effect.Effect<Structure, StructureGenerationError>
  readonly placeStructure: (structure: Structure) => Effect.Effect<void, StructurePlacementError>
  readonly getStructureTypes: () => StructureType[]
}

export const StructureGenerationManager = Context.GenericTag<StructureGenerationManagerInterface>(
  '@minecraft/StructureGenerationManager'
)

const makeStructureGenerationManager = Effect.gen(function* () {
  const worldService = yield* WorldService
  const biomeService = yield* BiomeService
  const noiseGenerator = yield* NoiseGenerator

  const generateStructuresForChunk = (chunkPos: ChunkPosition) =>
    Effect.gen(function* () {
      const structures: Structure[] = []

      // 各構造物タイプの生成判定
      for (const structureType of getStructureTypes()) {
        const shouldGenerate = yield* checkStructureGeneration(chunkPos, structureType)

        if (shouldGenerate) {
          const structure = yield* generateStructure(chunkPos, structureType)
          structures.push(structure)
        }
      }

      // 生成された構造物をワールドに配置
      for (const structure of structures) {
        yield* placeStructure(structure)
      }

      return structures
    })

  const checkStructureGeneration = (chunkPos: ChunkPosition, structureType: StructureType) =>
    Effect.gen(function* () {
      // バイオーム適合性をチェック
      const biome = yield* biomeService.getBiomeAt(chunkPos)
      const biomeCompatibility = yield* checkBiomeCompatibility(structureType, biome)

      if (!biomeCompatibility) {
        return false
      }

      // 他の構造物との距離制限をチェック
      const nearbyStructures = yield* worldService.getNearbyStructures(chunkPos, 5)
      const minDistance = getMinDistanceForStructure(structureType)

      for (const structure of nearbyStructures) {
        const distance = calculateChunkDistance(chunkPos, structure.position)
        if (distance < minDistance) {
          return false
        }
      }

      // 構造物固有の生成条件をチェック
      const generationChance = yield* calculateGenerationChance(structureType, chunkPos)
      const randomValue = yield* Effect.sync(() => Math.random())

      return randomValue < generationChance
    })

  const generateStructure = (chunkPos: ChunkPosition, structureType: StructureType) =>
    Effect.gen(function* () {
      // シードベースの決定的生成
      const seed = yield* Effect.sync(() => hashCoordinates(chunkPos.x, chunkPos.z) ^ hashString(structureType))
      const rng = createSeededRandom(seed)

      // 構造物の基本パラメータを決定
      const basePosition = chunkPosToWorldPos(chunkPos)
      const size = yield* calculateStructureSize(structureType, rng)
      const orientation = rng.nextFloat() * 360

      // 地形に適応した配置位置の微調整
      const adjustedPosition = yield* findOptimalPlacement(basePosition, size, structureType)

      // 構造物の詳細生成
      const structure = yield* Match.value(structureType).pipe(
        Match.when('village', () => generateVillageStructure(adjustedPosition, size, seed, rng)),
        Match.when('dungeon', () => generateDungeonStructure(adjustedPosition, size, seed, rng)),
        Match.when('stronghold', () => generateStrongholdStructure(adjustedPosition, size, seed, rng)),
        Match.when('temple', () => generateTempleStructure(adjustedPosition, size, seed, rng)),
        Match.orElse(() => Effect.fail(StructureGenerationError.UnsupportedType({ type: structureType })))
      )

      // バイオーム情報を付与
      const biome = yield* biomeService.getBiomeAt(chunkPos)

      return Schema.decodeSync(Structure)({
        ...structure,
        biome: biome.name,
        generatedAt: new Date(),
        integrity: 1.0, // 新生成時は完全な状態
      })
    })

  const placeStructure = (structure: Structure) =>
    Effect.gen(function* () {
      // 構造物の配置エリアをクリア（必要に応じて）
      yield* clearPlacementArea(structure.position, structure.size)

      // ブロック単位での構造物配置
      const blocks = yield* generateStructureBlocks(structure)

      for (const block of blocks) {
        yield* worldService.setBlock(block.position, block.blockType, {
          metadata: block.metadata,
          updateNeighbors: false, // 一括更新後に実行
        })
      }

      // 近隣ブロックの更新を一括実行
      yield* worldService.updateNeighborsInArea(structure.position, structure.size)

      // エンティティの配置（村人、スポナーなど）
      for (const spawner of structure.spawners) {
        yield* worldService.placeSpawner(spawner.position, {
          mobType: spawner.mobType,
          spawnRate: spawner.spawnRate,
          maxNearbyEntities: 6,
          requiredPlayerRange: 16,
        })
      }

      // 宝箱・戦利品の配置
      for (const lootTableId of structure.lootTables) {
        const lootPosition = yield* findLootChestPosition(structure)
        yield* worldService.placeLootChest(lootPosition, lootTableId)
      }

      // 構造物データベースに登録
      yield* worldService.registerStructure(structure)

      yield* Effect.logInfo(
        `構造物配置完了: ${structure.type} at (${structure.position.x}, ${structure.position.y}, ${structure.position.z})`
      )
    })

  const getStructureTypes = (): StructureType[] => {
    return [
      'village', // 村：平原・砂漠・サバンナに生成
      'dungeon', // ダンジョン：地下に小規模生成
      'stronghold', // 要塞：地下の大規模構造物
      'temple', // 神殿：ジャングル・砂漠・海底に生成
      'mansion', // 邸宅：暗い森に生成される大規模建築
      'monument', // 海底神殿：海洋バイオームの海底
      'ruins', // 遺跡：海洋・陸地に小規模散在
      'cave_system', // 洞窟システム：自然洞窟の拡張構造
    ]
  }

  return {
    generateStructuresForChunk,
    checkStructureGeneration,
    generateStructure,
    placeStructure,
    getStructureTypes,
  }
})

export const StructureGenerationManagerLive = Layer.effect(StructureGenerationManager, makeStructureGenerationManager)

// ヘルパー関数群（実装例）
const checkBiomeCompatibility = (structureType: StructureType, biome: Biome) =>
  Effect.gen(function* () {
    const compatibilityMap: Record<StructureType, readonly string[]> = {
      village: ['plains', 'desert', 'savanna', 'taiga'],
      dungeon: ['*'], // すべてのバイオームで生成可能
      stronghold: ['*'],
      temple: ['jungle', 'desert', 'ocean'],
      mansion: ['dark_forest'],
      monument: ['ocean', 'deep_ocean'],
      ruins: ['ocean', 'beach', 'plains'],
      cave_system: ['mountains', 'hills', '*'],
    } as const

    const compatibleBiomes = compatibilityMap[structureType]
    return compatibleBiomes.includes('*') || compatibleBiomes.includes(biome.name)
  })

const getMinDistanceForStructure = (structureType: StructureType): number => {
  const distanceMap: Record<StructureType, number> = {
    village: 8, // 8チャンク離す
    dungeon: 2, // 2チャンク離す
    stronghold: 32, // 32チャンク離す（非常に希少）
    temple: 16, // 16チャンク離す
    mansion: 64, // 64チャンク離す（極めて希少）
    monument: 24, // 24チャンク離す
    ruins: 4, // 4チャンク離す
    cave_system: 6, // 6チャンク離す
  }
  return distanceMap[structureType]
}

const calculateGenerationChance = (structureType: StructureType, chunkPos: ChunkPosition) =>
  Effect.gen(function* () {
    const baseChances: Record<StructureType, number> = {
      village: 0.002, // 0.2%
      dungeon: 0.01, // 1%
      stronghold: 0.0001, // 0.01%（非常に希少）
      temple: 0.001, // 0.1%
      mansion: 0.00005, // 0.005%（極めて希少）
      monument: 0.0005, // 0.05%
      ruins: 0.005, // 0.5%
      cave_system: 0.003, // 0.3%
    }

    // ノイズベースの生成確率調整
    const noiseValue = yield* noiseGenerator.octaveNoise(chunkPos.x * 0.1, chunkPos.z * 0.1, 3)
    const noiseMod = Math.abs(noiseValue) * 0.5 + 0.75 // 0.75〜1.25の範囲

    return baseChances[structureType] * noiseMod
  })
```

### 村生成システム

#### 村の構成要素

- **建物**: 住宅・作業場・農場・図書館・教会
- **道路**: 建物間を結ぶ道路網
- **農地**: 作物栽培エリア・井戸
- **住民**: 職業を持つNPC村人の配置

### ダンジョン生成システム

#### ダンジョンの特徴

- **部屋構造**: 複数の小部屋が廊下で接続
- **トラップ**: 圧力板・ディスペンサー・溶岩の罠
- **宝箱**: レア装備・貴重アイテムの配置
- **スポナー**: モンスター生成装置の設置

## パフォーマンス最適化

### 生成効率化

- **チャンク単位生成**: チャンクロード時の段階的構造物生成
- **LOD システム**: 距離に応じた構造物詳細度調整
- **キャッシュ機能**: 生成済み構造物データの保存
- **非同期処理**: メインスレッドをブロックしない生成処理

## テストケース

### 基本生成機能

- [ ] 各構造物タイプの正常生成
- [ ] バイオーム適合性の確認
- [ ] 距離制限の動作確認
- [ ] 確率分布の妥当性検証

### 構造物品質

- [ ] 建物の構造的整合性
- [ ] 道路ネットワークの接続性
- [ ] 宝箱配置の適切性
- [ ] スポナー機能の動作確認

## 今後の拡張

### プランされた機能

- **プレイヤー建築**: プレイヤー作成建物のテンプレート化
- **動的進化**: 時間経過による村の成長・変化
- **戦争システム**: 村間の争い・同盟関係
- **カスタム構造物**: MOD・プラグインでの構造物追加
