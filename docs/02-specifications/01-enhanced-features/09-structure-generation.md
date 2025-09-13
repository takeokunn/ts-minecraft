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
    Schema.Literal("village"),
    Schema.Literal("dungeon"),
    Schema.Literal("stronghold"),
    Schema.Literal("temple"),
    Schema.Literal("mansion"),
    Schema.Literal("monument"),
    Schema.Literal("ruins"),
    Schema.Literal("cave_system")
  ),
  position: Position,
  size: Schema.Struct({
    width: Schema.Number,
    height: Schema.Number,
    depth: Schema.Number
  }),
  orientation: Schema.Number, // 回転角度
  integrity: pipe(Schema.Number, Schema.between(0, 1)), // 破損度
  seed: Schema.Number,
  biome: Schema.String,
  generatedAt: Schema.DateTimeUtc,
  lootTables: Schema.Array(Schema.String),
  spawners: Schema.Array(Schema.Struct({
    position: Position,
    mobType: Schema.String,
    spawnRate: Schema.Number
  }))
})

// 構造物生成マネージャー（最新Context.GenericTagパターン）
interface StructureGenerationManagerInterface {
  readonly generateStructuresForChunk: (chunkPos: ChunkPosition) => Effect.Effect<Structure[], StructureGenerationError>
  readonly checkStructureGeneration: (chunkPos: ChunkPosition, structureType: StructureType) => Effect.Effect<boolean>
  readonly generateStructure: (chunkPos: ChunkPosition, structureType: StructureType) => Effect.Effect<Structure, StructureGenerationError>
  readonly placeStructure: (structure: Structure) => Effect.Effect<void, StructurePlacementError>
  readonly getStructureTypes: () => StructureType[]
}

export const StructureGenerationManager = Context.GenericTag<StructureGenerationManagerInterface>("@minecraft/StructureGenerationManager")

const makeStructureGenerationManager = Effect.gen(function* () {
  const worldService = yield* WorldService
  const biomeService = yield* BiomeService
  const noiseGenerator = yield* NoiseGenerator

  const generateStructuresForChunk = (chunkPos: ChunkPosition) =>
    Effect.gen(function* () {
      const structures: Structure[] = []

      // 各構造物タイプの生成判定
      for (const structureType of getStructureTypes()) {
        const shouldGenerate = yield* checkStructureGeneration(
          chunkPos,
          structureType
        )

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
      // 構造物生成のロジックを実装
      return true // placeholder
    })

  const generateStructure = (chunkPos: ChunkPosition, structureType: StructureType) =>
    Effect.gen(function* () {
      // 構造物生成のロジックを実装
      return {} as Structure // placeholder
    })

  const placeStructure = (structure: Structure) =>
    Effect.gen(function* () {
      // 構造物配置のロジックを実装
    })

  const getStructureTypes = (): StructureType[] => {
    return [] // placeholder
  }

  return {
    generateStructuresForChunk,
    checkStructureGeneration,
    generateStructure,
    placeStructure,
    getStructureTypes
  }
})

export const StructureGenerationManagerLive = Layer.effect(StructureGenerationManager, makeStructureGenerationManager)
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