# Food & Agriculture System（食料・農業システム）

## 概要

Food & Agriculture Systemは、プレイヤーの生存に不可欠な食料の生産、調理、消費を管理するシステムです。Health & Hunger Systemと密接に連携し、サバイバル体験に深みを与えます。

## システム設計

### 1. 農業 (Agriculture)

#### 1.1 作物 (Crops)
- **種類**: 小麦、ニンジン、ジャガイモ、ビートルート、スイカ、カボチャなど
- **成長段階**: 種から収穫可能になるまで複数の成長ステージを持つ (通常8段階)
- **成長条件**:
    - **光源**: 十分な光レベルが必要 (通常9以上)
    - **水**: 耕した土が湿っている必要がある (通常4ブロック以内)
    - **空間**: 作物の上にブロックがないこと

```typescript
// Cropスキーマ
export const Crop = Schema.Struct({
  type: Schema.String,
  growthStage: Schema.Number.pipe(Schema.min(0), Schema.max(7)),
  position: Position,
  lastGrowthTime: Schema.Number
});

// 成長ロジック
export const growCrop = (crop: Crop, lightLevel: number, isWatered: boolean): Crop => {
  if (lightLevel >= 9 && isWatered) {
    // 成長確率 (Bone Mealで加速可能)
    if (Math.random() < 0.1) {
      return { ...crop, growthStage: Math.min(7, crop.growthStage + 1) };
    }
  }
  return crop;
};
```

#### 1.2 耕地 (Farmland)
- **状態**: 乾燥または湿潤
- **水源**: 4ブロック以内に水源があれば湿潤状態を維持
- **変化**: プレイヤーがジャンプすると土に戻る

### 2. 畜産 (Animal Husbandry)

#### 2.1 動物 (Animals)
- **種類**: 牛、豚、羊、鶏など
- **繁殖**: 特定のアイテムを与えることで繁殖モードに入る
- **成長**: 子供は時間経過で大人になる
- **ドロップ**: 倒すと肉や革などをドロップ

```typescript
// Animalスキーマ
export const Animal = Schema.Struct({
  type: Schema.String,
  isBaby: Schema.Boolean,
  inLoveTicks: Schema.Number.pipe(Schema.min(0)), // 繁殖モードの時間
  age: Schema.Number.pipe(Schema.min(0))
});

// 繁殖ロジック
export const breedAnimals = (animal1: Animal, animal2: Animal, food: Item): Option<BabyAnimal> => {
  if (canBreed(animal1, animal2, food)) {
    // 子供を生成
    return Option.some(createBaby(animal1.type));
  }
  return Option.none();
};
```

### 3. 食料 (Food)

#### 3.1 調理 (Cooking)
- **かまど**: 生肉やジャガイモを焼く
- **燻製器**: 肉類を高速で焼く
- **溶鉱炉**: 鉱石専用 (調理不可)

#### 3.2 食料アイテム
- **回復量**: 飢餓ゲージの回復ポイント
- **飽和度**: 隠し飢餓ゲージの回復量
- **特殊効果**: 金リンゴなどのバフ効果

```typescript
// FoodItemスキーマ (Health & Hunger Systemから参照)
export const FoodItem = Schema.Struct({
  id: Schema.String,
  hungerRestore: Schema.Number,
  saturationModifier: Schema.Number,
  effects: Schema.optional(Schema.Array(PotionEffect))
});
```

## UI統合

- **インベントリ**: 食料アイテムのツールチップに回復量を表示
- **かまどUI**: 調理の進捗状況を表示
- **HUD**: 食料を食べた際の飢餓ゲージ回復をアニメーション表示

## パフォーマンス

- **ランダムティック**: 作物の成長判定はランダムティックで行い、全作物を毎フレームチェックするのを避ける
- **動物AI**: 遠くの動物のAIは簡略化する (LOD)

## テストケース

- [ ] 作物が適切な条件下で成長すること
- [ ] 動物が特定の食料で繁殖すること
- [ ] かまどで生肉が焼けること
- [ ] 食料を食べると飢餓ゲージが回復すること
