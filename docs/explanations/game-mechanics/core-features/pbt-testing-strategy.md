---
title: "PBTテスト戦略 - Property-Based Testing統合"
description: "純粋関数型設計とProperty-Based Testingの統合戦略。fast-checkとEffect-TSの組み合わせ。"
category: "specification"
difficulty: "advanced"
tags: ["testing", "pbt", "property-based-testing", "fast-check", "effect-ts"]
prerequisites: ["effect-ts-fundamentals", "testing-fundamentals", "functional-programming"]
estimated_reading_time: "12分"
related_patterns: ["testing-patterns", "functional-patterns"]
related_docs: ["../explanations/architecture/06d-effect-ts-testing.md", "../../explanations/design-patterns/02-testing-patterns.md"]
---

# PBTテスト戦略

## 概要

Property-Based Testing (PBT) は、関数の性質（プロパティ）を検証することで、より堅牢なテストを実現する手法です。TypeScript Minecraftクローンでは、fast-checkライブラリとEffect-TSを組み合わせて、ゲームロジックの正確性を保証しています。

## 1. PBT対応の純粋関数型設計

### 単一責任原則の徹底
```typescript
// ✅ PBT最適: 小さな純粋関数
export const worldToChunkCoord = (worldCoord: number): number =>
  Math.floor(worldCoord / 16);

export const chunkToWorldCoord = (chunkCoord: number): number =>
  chunkCoord * 16;

// 明度計算（テスト可能な単位）
export const combineLightLevels = (
  blockLight: number,
  skyLight: number
): number => Math.max(blockLight, skyLight);

// 距離減衰（テスト可能な単位）
export const calculateLightAttenuation = (
  sourceLevel: number,
  distance: number
): number => Math.max(0, sourceLevel - distance);
```

### 可逆性の性質検証
```typescript
import * as fc from "fast-check"

test.prop([fc.integer()])(
  "chunk conversion is reversible",
  (worldCoord) => {
    const chunkCoord = worldToChunkCoord(worldCoord);
    const blockInChunk = worldCoord % 16;
    const reconstructed = chunkToWorldCoord(chunkCoord) + blockInChunk;
    expect(Math.abs(reconstructed - worldCoord)).toBeLessThanOrEqual(15);
  }
);
```

## 2. ECSシステムのPBT統合

### コンポーネント変換関数の検証
```typescript
// 位置コンポーネントの更新（テスト可能）
export const updatePosition = (
  position: PositionComponent,
  velocity: VelocityComponent,
  deltaTime: number
): PositionComponent => ({
  x: position.x + velocity.x * deltaTime,
  y: position.y + velocity.y * deltaTime,
  z: position.z + velocity.z * deltaTime
});

// 速度コンポーネントの更新（テスト可能）
export const applyFriction = (
  velocity: VelocityComponent,
  friction: number
): VelocityComponent => ({
  x: velocity.x * (1 - friction),
  y: velocity.y, // Y軸は重力制御
  z: velocity.z * (1 - friction)
});

// システムの合成（小関数の組み合わせ）
export const physicsSystem = (
  entities: Entity[],
  deltaTime: number
): Entity[] =>
  entities.map(entity => {
    const position = entity.getComponent(PositionComponent);
    const velocity = entity.getComponent(VelocityComponent);

    if (!position || !velocity) return entity;

    return pipe(
      entity,
      e => e.setComponent(
        PositionComponent,
        updatePosition(position, velocity, deltaTime)
      ),
      e => e.setComponent(
        VelocityComponent,
        applyFriction(velocity, 0.1)
      )
    );
  });
```

### 線形性の性質検証
```typescript
test.prop([
  fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }),
  fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }),
  fc.float({ min: 0, max: 1 })
])(
  "position update is linear",
  (pos, vel, dt) => {
    const updated = updatePosition(pos, vel, dt);
    expect(updated.x).toBe(pos.x + vel.x * dt);
    expect(updated.y).toBe(pos.y + vel.y * dt);
    expect(updated.z).toBe(pos.z + vel.z * dt);
  }
);
```

## 3. ワールド生成のPBT検証

### チャンク座標変換の性質
```typescript
// チャンク座標計算（テスト可能）
export const getChunkKey = (x: number, z: number): string =>
  `${x},${z}`;

export const parseChunkKey = (key: string): { x: number; z: number } => {
  const [x, z] = key.split(',').map(Number);
  return { x, z };
};

// バイオーム判定（テスト可能）
export const getBiomeFromClimate = (
  temperature: number,
  humidity: number
): BiomeType => {
  if (temperature < 0.2) return 'tundra';
  if (temperature > 0.8 && humidity > 0.8) return 'jungle';
  if (temperature > 0.6 && humidity < 0.3) return 'desert';
  if (humidity > 0.5) return 'forest';
  return 'plains';
};

// PBTテスト
test.prop([fc.integer(), fc.integer()])(
  "chunk key is reversible",
  (x, z) => {
    const key = getChunkKey(x, z);
    const parsed = parseChunkKey(key);
    expect(parsed).toEqual({ x, z });
  }
);
```

### バイオーム判定の網羅性
```typescript
test.prop([
  fc.float({ min: 0, max: 1 }),
  fc.float({ min: 0, max: 1 })
])(
  "biome determination is exhaustive",
  (temperature, humidity) => {
    const biome = getBiomeFromClimate(temperature, humidity);
    const validBiomes: BiomeType[] = ['tundra', 'jungle', 'desert', 'forest', 'plains'];
    expect(validBiomes).toContain(biome);
  }
);
```

## 4. プレイヤー移動のPBT検証

### 物理法則の性質検証
```typescript
// ジャンプ速度計算（テスト可能）
export const calculateJumpVelocity = (
  jumpHeight: number,
  gravity: number = 9.8
): number => Math.sqrt(2 * gravity * jumpHeight);

// 移動速度制限（テスト可能）
export const clampVelocity = (
  velocity: Vector3,
  maxSpeed: number
): Vector3 => {
  const speed = Math.sqrt(
    velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2
  );
  if (speed <= maxSpeed) return velocity;
  const scale = maxSpeed / speed;
  return {
    x: velocity.x * scale,
    y: velocity.y * scale,
    z: velocity.z * scale
  };
};

// スニーク速度調整（テスト可能）
export const applySneakModifier = (
  baseSpeed: number,
  isSneaking: boolean
): number => isSneaking ? baseSpeed * 0.3 : baseSpeed;
```

### 物理法則の正確性検証
```typescript
test.prop([fc.float({ min: 0, max: 10 })])(
  "jump velocity physics is correct",
  (height) => {
    const velocity = calculateJumpVelocity(height);
    // v² = 2ghの検証
    const calculatedHeight = (velocity ** 2) / (2 * 9.8);
    expect(calculatedHeight).toBeCloseTo(height, 5);
  }
);

test.prop([
  fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }),
  fc.float({ min: 0, max: 100 })
])(
  "velocity clamping preserves direction",
  (velocity, maxSpeed) => {
    const clamped = clampVelocity(velocity, maxSpeed);
    const originalSpeed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
    const clampedSpeed = Math.sqrt(clamped.x ** 2 + clamped.y ** 2 + clamped.z ** 2);

    if (originalSpeed <= maxSpeed) {
      expect(clamped).toEqual(velocity);
    } else {
      expect(clampedSpeed).toBeCloseTo(maxSpeed, 5);
      // 方向の保持を確認
      if (originalSpeed > 0) {
        const scale = clampedSpeed / originalSpeed;
        expect(clamped.x).toBeCloseTo(velocity.x * scale, 5);
        expect(clamped.y).toBeCloseTo(velocity.y * scale, 5);
        expect(clamped.z).toBeCloseTo(velocity.z * scale, 5);
      }
    }
  }
);
```

## 5. Effect-TSとPBTの統合

### Property-Based パフォーマンス特性検証
```typescript
import { Effect, TestContext, TestClock, Duration, Either, pipe } from "effect"
import { describe, test, expect } from "@effect/vitest"
import * as fc from "fast-check"

export const PerformanceTests = describe("パフォーマンス", () => {
  test("Property-based パフォーマンス特性検証", () =>
    Effect.promise(() =>
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              x: fc.integer({ min: -50, max: 50 }),
              z: fc.integer({ min: -50, max: 50 })
            }),
            { minLength: 1, maxLength: 200 }
          ),
          (coordinates) =>
            pipe(
              ChunkService.loadChunkBatch(coordinates),
              Effect.timeout(Duration.seconds(30)),
              Effect.either,
              Effect.map(Either.isRight)
            )
        )
      )
    ))
});
```

### 決定論的生成の検証
```typescript
test.prop([fc.integer(), fc.integer(), fc.integer()])(
  "world generation is deterministic",
  (seed, x, z) => {
    const chunk1 = generateChunkDeterministic({ x, z }, seed);
    const chunk2 = generateChunkDeterministic({ x, z }, seed);
    expect(chunk1).toEqual(chunk2);
  }
);
```

## 6. テスト可能なプロパティ定義

### 可換性 (Commutativity)
```typescript
test.prop([fc.integer(), fc.integer()])(
  "light level combination is commutative",
  (light1, light2) => {
    expect(combineLightLevels(light1, light2))
      .toBe(combineLightLevels(light2, light1));
  }
);
```

### 冪等性 (Idempotency)
```typescript
test.prop([fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }), fc.float()])(
  "velocity clamping is idempotent",
  (velocity, maxSpeed) => {
    const clamped1 = clampVelocity(velocity, maxSpeed);
    const clamped2 = clampVelocity(clamped1, maxSpeed);
    expect(clamped1).toEqual(clamped2);
  }
);
```

### 単調性 (Monotonicity)
```typescript
test.prop([
  fc.integer({ min: 0, max: 15 }),
  fc.integer({ min: 0, max: 10 }),
  fc.integer({ min: 0, max: 10 })
])(
  "light attenuation is monotonic",
  (sourceLevel, distance1, distance2) => {
    fc.pre(distance1 <= distance2);
    const attenuation1 = calculateLightAttenuation(sourceLevel, distance1);
    const attenuation2 = calculateLightAttenuation(sourceLevel, distance2);
    expect(attenuation1).toBeGreaterThanOrEqual(attenuation2);
  }
);
```

## 7. 統合テスト戦略

### システム間連携の性質検証
```typescript
test.prop([
  fc.record({
    playerId: fc.string({ minLength: 1 }),
    fromChunk: fc.record({ x: fc.integer(), z: fc.integer() }),
    toChunk: fc.record({ x: fc.integer(), z: fc.integer() })
  })
])(
  "player chunk transition loads required chunks",
  async ({ playerId, fromChunk, toChunk }) => {
    // テストのセットアップ
    const initialState = createTestWorldState();

    // プレイヤーをfromChunkに配置
    await placePlayerInChunk(initialState, playerId, fromChunk);

    // toChunkへの移動
    await movePlayerToChunk(initialState, playerId, toChunk);

    // チャンクが適切にロードされていることを確認
    const loadedChunks = await getLoadedChunks(initialState);
    expect(loadedChunks).toContainEqual(toChunk);
  }
);
```

## 8. PBTベストプラクティス

### 適切なArbitraryの選択
```typescript
// ゲーム座標に適した範囲制限
const gamePositionArbitrary = fc.record({
  x: fc.integer({ min: -30000000, max: 30000000 }), // Minecraft座標系限界
  y: fc.integer({ min: -64, max: 320 }),           // Y軸範囲
  z: fc.integer({ min: -30000000, max: 30000000 })
});

// ブロック座標（チャンク内）
const blockPositionArbitrary = fc.record({
  x: fc.integer({ min: 0, max: 15 }),
  y: fc.integer({ min: -64, max: 319 }),
  z: fc.integer({ min: 0, max: 15 })
});

// 物理的に妥当な速度
const velocityArbitrary = fc.record({
  x: fc.float({ min: -20, max: 20 }),  // 現実的な移動速度
  y: fc.float({ min: -50, max: 20 }),  // 落下速度考慮
  z: fc.float({ min: -20, max: 20 })
});
```

### 効果的な事前条件
```typescript
test.prop([
  fc.integer(),
  fc.integer({ min: 1 })  // ゼロ除算回避
])(
  "division properties",
  (dividend, divisor) => {
    fc.pre(divisor !== 0);  // 事前条件
    const result = dividend / divisor;
    expect(result * divisor).toBeCloseTo(dividend, 10);
  }
);
```

## 関連ドキュメント

**テスト関連**:
- [Effect-TS テスト](../explanations/architecture/06d-effect-ts-testing.md) - Effect-TSテストパターン
- [テストパターン集](../../explanations/design-patterns/02-testing-patterns.md) - テストパターンカタログ

**設計関連**:
- [アーキテクチャ原則](./00-architecture-principles.md) - 設計原則
- [実装パターン](./00-implementation-patterns.md) - 具体的な実装例