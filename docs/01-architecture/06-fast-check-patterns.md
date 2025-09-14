---
title: "fast-checkテストパターン - Property-Based Testing実装"
description: "fast-checkライブラリを使用したProperty-Based Testingの具体的実装パターンとテスト戦略。"
category: "architecture"
difficulty: "advanced"
tags: ["fast-check", "property-based-testing", "testing", "arbitrary"]
prerequisites: ["property-based-testing-basics", "fast-check-fundamentals"]
estimated_reading_time: "25分"
related_patterns: ["testing-patterns", "functional-patterns"]
related_docs: ["./06-pbt-function-design.md", "./06d-effect-ts-testing.md"]
---

# fast-checkテストパターン

## 概要

fast-checkライブラリを使用したProperty-Based Testing(PBT)の具体的な実装パターンと戦略を解説します。効果的なArbitraryの設計から高度なテストパターンまでカバーします。

## 1. 基本的なプロパティテスト

### 1.1 小関数のプロパティ検証

```typescript
import { describe, test, expect, it } from "vitest";
import * as fc from "fast-check";

// PBT用のカスタムArbitrary
const Vector3Arb = fc.record({
  x: fc.float({ noNaN: true, noDefaultInfinity: true }),
  y: fc.float({ noNaN: true, noDefaultInfinity: true }),
  z: fc.float({ noNaN: true, noDefaultInfinity: true })
});

const BoundedFloatArb = (min: number, max: number) =>
  fc.float({ min, max, noNaN: true });

describe("Atomic function properties", () => {
  // 加算の可換性
  it.prop([Vector3Arb, Vector3Arb])(
    "vector addition is commutative",
    (a, b) => {
      const result1 = addVectors(a, b);
      const result2 = addVectors(b, a);
      expect(result1).toEqual(result2);
    }
  );

  // 加算の結合性
  it.prop([Vector3Arb, Vector3Arb, Vector3Arb])(
    "vector addition is associative",
    (a, b, c) => {
      const result1 = addVectors(addVectors(a, b), c);
      const result2 = addVectors(a, addVectors(b, c));

      const epsilon = 0.0001;
      expect(Math.abs(result1.x - result2.x)).toBeLessThan(epsilon);
      expect(Math.abs(result1.y - result2.y)).toBeLessThan(epsilon);
      expect(Math.abs(result1.z - result2.z)).toBeLessThan(epsilon);
    }
  );

  // 正規化の冪等性
  it.prop([Vector3Arb])(
    "normalization is idempotent",
    (v) => {
      const normalized1 = normalizeVector(v);
      const normalized2 = normalizeVector(normalized1);

      const epsilon = 0.0001;
      expect(Math.abs(normalized1.x - normalized2.x)).toBeLessThan(epsilon);
      expect(Math.abs(normalized1.y - normalized2.y)).toBeLessThan(epsilon);
      expect(Math.abs(normalized1.z - normalized2.z)).toBeLessThan(epsilon);
    }
  );

  // 距離の対称性
  it.prop([Vector3Arb, Vector3Arb])(
    "distance is symmetric",
    (a, b) => {
      const d1 = distance(a, b);
      const d2 = distance(b, a);
      expect(d1).toBe(d2);
    }
  );

  // クランプの境界保持
  it.prop([fc.float()])(
    "clampToUnit preserves bounds",
    (value) => {
      const clamped = clampToUnit(value);
      expect(clamped).toBeGreaterThanOrEqual(0);
      expect(clamped).toBeLessThanOrEqual(1);
    }
  );
});

describe("Position calculations", () => {
  test("移動の可換性", () => {
    fc.assert(
      fc.property(
        fc.record({
          x: fc.float({ noNaN: true, noDefaultInfinity: true }),
          y: fc.float({ noNaN: true, noDefaultInfinity: true }),
          z: fc.float({ noNaN: true, noDefaultInfinity: true })
        }),
        fc.record({
          x: fc.float({ min: -10, max: 10 }),
          y: fc.float({ min: -10, max: 10 }),
          z: fc.float({ min: -10, max: 10 })
        }),
        fc.float({ min: 0.001, max: 1 }),
        (pos, vel1, vel2, dt) => {
          // 2つの速度を順番に適用
          const result1 = calculateNewPosition(
            calculateNewPosition(pos, vel1, dt),
            vel2,
            dt
          );

          // 速度を合成してから適用
          const combined = addVectors(vel1, vel2);
          const result2 = calculateNewPosition(pos, combined, dt);

          // 浮動小数点誤差を考慮した比較
          const epsilon = 0.0001;
          return (
            Math.abs(result1.x - result2.x) < epsilon &&
            Math.abs(result1.y - result2.y) < epsilon &&
            Math.abs(result1.z - result2.z) < epsilon
          );
        }
      )
    );
  });

  test("境界クランプの冪等性", () => {
    fc.assert(
      fc.property(
        fc.record({
          x: fc.float({ min: -1000, max: 1000 }),
          y: fc.float({ min: -1000, max: 1000 }),
          z: fc.float({ min: -1000, max: 1000 })
        }),
        fc.record({
          minX: fc.float({ min: -100, max: 0 }),
          maxX: fc.float({ min: 0, max: 100 }),
          minY: fc.float({ min: -100, max: 0 }),
          maxY: fc.float({ min: 0, max: 100 }),
          minZ: fc.float({ min: -100, max: 0 }),
          maxZ: fc.float({ min: 0, max: 100 })
        }),
        (position, bounds) => {
          const clamped1 = clampPosition(position, bounds);
          const clamped2 = clampPosition(clamped1, bounds);

          // 2回適用しても結果は同じ（冪等性）
          return (
            clamped1.x === clamped2.x &&
            clamped1.y === clamped2.y &&
            clamped1.z === clamped2.z
          );
        }
      )
    );
  });
});
```

## 2. Schema駆動のArbitrary生成

### 2.1 Effect-TS Schemaとの統合

```typescript
import * as Arbitrary from "@effect/schema/Arbitrary";
import * as S from "@effect/schema/Schema";

// Schemaからの型定義
const PositionSchema = S.Struct({
  x: S.Number,
  y: S.Number,
  z: S.Number
});

const PlayerSchema = S.Struct({
  id: S.String.pipe(S.brand("PlayerId")),
  name: S.String.pipe(S.minLength(1), S.maxLength(20)),
  position: PositionSchema,
  health: S.Number.pipe(S.between(0, 100)),
  level: S.Number.pipe(S.int(), S.between(1, 100))
});

// Schemaから自動的にArbitraryを生成
const positionArb = Arbitrary.make(PositionSchema)(fc);
const playerArb = Arbitrary.make(PlayerSchema)(fc);

describe("Player mechanics", () => {
  test("ダメージ計算の境界", () => {
    fc.assert(
      fc.property(
        playerArb,
        fc.float({ min: 0, max: 1000 }),
        fc.float({ min: 0, max: 100 }),
        (player, damage, armor) => {
          const finalDamage = calculateDamage(damage, armor, player.level);

          // ダメージは常に0以上、元のダメージ以下
          return finalDamage >= 0 && finalDamage <= damage;
        }
      )
    );
  });
});
```

## 3. 高度なテスト戦略

### 3.1 モデルベーステスト

```typescript
// シンプルなモデルと実装を比較
class SimpleInventoryModel {
  private items: Map<string, number> = new Map();

  add(itemId: string, count: number): void {
    const current = this.items.get(itemId) || 0;
    this.items.set(itemId, current + count);
  }

  remove(itemId: string, count: number): boolean {
    const current = this.items.get(itemId) || 0;
    if (current >= count) {
      this.items.set(itemId, current - count);
      return true;
    }
    return false;
  }

  getCount(itemId: string): number {
    return this.items.get(itemId) || 0;
  }
}

// 実際の実装とモデルを比較
describe("Inventory implementation", () => {
  test("モデルとの一致性", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.record({
              type: fc.constant("add" as const),
              itemId: fc.string(),
              count: fc.nat({ max: 100 })
            }),
            fc.record({
              type: fc.constant("remove" as const),
              itemId: fc.string(),
              count: fc.nat({ max: 100 })
            })
          )
        ),
        (commands) => {
          const model = new SimpleInventoryModel();
          let implementation = createEmptyInventory();

          for (const command of commands) {
            if (command.type === "add") {
              model.add(command.itemId, command.count);
              implementation = addItem(implementation, command.itemId, command.count);
            } else {
              const modelResult = model.remove(command.itemId, command.count);
              const [newImplementation, implementationResult] =
                removeItem(implementation, command.itemId, command.count);

              implementation = newImplementation;

              // モデルと実装の結果が一致することを確認
              if (modelResult !== implementationResult) {
                return false;
              }
            }

            // 各アイテムの数量が一致することを確認
            const itemIds = new Set([
              ...Array.from(model['items'].keys()),
              ...Object.keys(implementation.items)
            ]);

            for (const itemId of itemIds) {
              if (model.getCount(itemId) !== (implementation.items[itemId] || 0)) {
                return false;
              }
            }
          }

          return true;
        }
      ),
      { numRuns: 1000 }
    );
  });
});
```

### 3.2 状態機械テスト

```typescript
// 状態機械のテスト
interface GameStateMachine {
  state: "menu" | "playing" | "paused" | "gameOver";
  canTransitionTo(newState: string): boolean;
  transition(newState: string): GameStateMachine;
}

const gameStateMachine = (initialState: string): GameStateMachine => ({
  state: initialState as any,
  canTransitionTo(newState: string): boolean {
    const validTransitions = {
      menu: ["playing"],
      playing: ["paused", "gameOver"],
      paused: ["playing", "menu"],
      gameOver: ["menu"]
    };
    return validTransitions[this.state]?.includes(newState) || false;
  },
  transition(newState: string): GameStateMachine {
    if (!this.canTransitionTo(newState)) {
      throw new Error(`Invalid transition: ${this.state} -> ${newState}`);
    }
    return gameStateMachine(newState);
  }
});

describe("Game state machine", () => {
  test("有効な遷移のみを許可", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.constant("playing"),
            fc.constant("paused"),
            fc.constant("menu"),
            fc.constant("gameOver")
          )
        ),
        (states) => {
          let machine = gameStateMachine("menu");

          for (const targetState of states) {
            if (machine.canTransitionTo(targetState)) {
              machine = machine.transition(targetState);
              // 遷移後の状態が正しいことを確認
              if (machine.state !== targetState) {
                return false;
              }
            }
            // 無効な遷移では例外が投げられることを確認
            else {
              try {
                machine.transition(targetState);
                return false; // 例外が投げられるべき
              } catch {
                // 期待される動作
              }
            }
          }

          return true;
        }
      )
    );
  });
});
```

## 4. カスタムArbitraryパターン

### 4.1 ゲーム固有のデータ構造

```typescript
// Minecraftワールド座標のArbitrary
const MinecraftCoordinateArb = fc.integer({
  min: -30000000,
  max: 30000000
});

const ChunkCoordinateArb = fc.record({
  x: fc.integer({ min: -1875000, max: 1875000 }), // World limit / 16
  z: fc.integer({ min: -1875000, max: 1875000 })
});

const BlockPositionArb = fc.record({
  x: fc.integer({ min: 0, max: 15 }),
  y: fc.integer({ min: -64, max: 319 }),
  z: fc.integer({ min: 0, max: 15 })
});

// アイテムスタックのArbitrary
const ItemStackArb = fc.record({
  itemId: fc.oneof(
    fc.constant("minecraft:stone"),
    fc.constant("minecraft:dirt"),
    fc.constant("minecraft:wood"),
    fc.constant("minecraft:iron_ingot")
  ),
  quantity: fc.integer({ min: 1, max: 64 }),
  durability: fc.option(fc.integer({ min: 0, max: 1000 })),
  enchantments: fc.array(
    fc.record({
      id: fc.string(),
      level: fc.integer({ min: 1, max: 5 })
    }),
    { maxLength: 3 }
  )
});

// インベントリのArbitrary
const InventoryArb = fc.record({
  size: fc.integer({ min: 9, max: 54 }),
  items: fc.dictionary(
    fc.integer({ min: 0, max: 53 }).map(String),
    fc.option(ItemStackArb)
  )
});

describe("Minecraft data structures", () => {
  test("チャンク座標からワールド座標への変換", () => {
    fc.assert(
      fc.property(
        ChunkCoordinateArb,
        BlockPositionArb,
        (chunkCoord, blockPos) => {
          const worldPos = chunkToWorldPosition(chunkCoord, blockPos);
          const backToChunk = worldToChunkPosition(worldPos);

          return (
            backToChunk.chunkX === chunkCoord.x &&
            backToChunk.chunkZ === chunkCoord.z &&
            backToChunk.blockX === blockPos.x &&
            backToChunk.blockZ === blockPos.z
          );
        }
      )
    );
  });

  test("インベントリ操作の不変条件", () => {
    fc.assert(
      fc.property(
        InventoryArb,
        ItemStackArb,
        (inventory, itemStack) => {
          const totalBefore = getTotalItemCount(inventory, itemStack.itemId);
          const newInventory = addItemToInventory(inventory, itemStack);
          const totalAfter = getTotalItemCount(newInventory, itemStack.itemId);

          // アイテム追加後の合計数が期待値と一致
          return totalAfter >= totalBefore &&
                 totalAfter <= totalBefore + itemStack.quantity;
        }
      )
    );
  });
});
```

### 4.2 制約付きデータ生成

```typescript
// 有効なレシピデータの生成
const RecipeArb = fc.record({
  id: fc.string().filter(id => /^[a-z0-9_]+$/.test(id)),
  ingredients: fc.array(
    fc.record({
      itemId: fc.string(),
      quantity: fc.integer({ min: 1, max: 9 })
    }),
    { minLength: 1, maxLength: 9 }
  ),
  result: fc.record({
    itemId: fc.string(),
    quantity: fc.integer({ min: 1, max: 64 })
  })
}).filter(recipe => {
  // レシピの妥当性チェック
  const ingredientItems = new Set(recipe.ingredients.map(i => i.itemId));
  return (
    ingredientItems.size === recipe.ingredients.length && // 重複なし
    !ingredientItems.has(recipe.result.itemId) // 結果が材料に含まれない
  );
});

// プレイヤーの一貫性のあるデータ生成
const ConsistentPlayerArb = fc.record({
  level: fc.integer({ min: 1, max: 100 }),
  experience: fc.nat()
}).chain(({ level, experience: _experience }) =>
  fc.record({
    level: fc.constant(level),
    experience: fc.integer({
      min: getRequiredXP(level),
      max: getRequiredXP(level + 1) - 1
    }),
    health: fc.float({ min: 0, max: getMaxHealth(level) }),
    mana: fc.float({ min: 0, max: getMaxMana(level) })
  })
);

describe("Complex data generation", () => {
  test("レシピシステムの整合性", () => {
    fc.assert(
      fc.property(
        RecipeArb,
        InventoryArb,
        (recipe, inventory) => {
          const canCraft = checkCanCraftRecipe(inventory, recipe);
          const result = attemptCraftRecipe(inventory, recipe);

          if (canCraft) {
            // クラフト可能な場合は成功する
            return result.success === true;
          } else {
            // クラフト不可能な場合は失敗する
            return result.success === false;
          }
        }
      )
    );
  });
});
```

## 5. パフォーマンステストとの統合

### 5.1 スケーラビリティテスト

```typescript
describe("Performance properties", () => {
  test("チャンクロード時間の線形性", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        async (chunkCount) => {
          const chunks = Array.from({ length: chunkCount }, (_, i) => ({
            x: Math.floor(i / 10),
            z: i % 10
          }));

          const startTime = performance.now();
          await loadChunksInParallel(chunks);
          const endTime = performance.now();
          const duration = endTime - startTime;

          // 時間複雑度がO(n)以下であることを確認
          const maxExpectedTime = chunkCount * 50; // 1チャンク当たり50ms
          return duration <= maxExpectedTime;
        }
      ),
      { numRuns: 50, timeout: 30000 }
    );
  });
});
```

## 関連ドキュメント

**設計関連**:
- [PBT対応関数設計](./06-pbt-function-design.md) - 関数設計原則
- [Effect-TSテスト](./06d-effect-ts-testing.md) - Effect-TSテスト統合

**実装関連**:
- [テストパターン集](../07-pattern-catalog/02-testing-patterns.md) - テスト実装例
- [関数型プログラミング](./07-functional-programming.md) - 関数型設計