---
title: "PBT対応関数設計 - Property-Based Testing向け設計原則"
description: "Property-Based Testing(PBT)に適した小さく純粋な関数の設計パターン。テスト可能なプロパティを持つ関数設計ガイド。"
category: "architecture"
difficulty: "advanced"
tags: ["property-based-testing", "pure-functions", "functional-programming", "design-principles"]
prerequisites: ["typescript-advanced", "functional-programming-basics", "testing-fundamentals"]
estimated_reading_time: "20分"
related_patterns: ["functional-patterns", "testing-patterns"]
related_docs: ["./06-fast-check-patterns.md", "./06d-effect-ts-testing.md"]
---

# PBT対応関数設計

## 概要

Property-Based Testing(PBT)で効果的にテストするための関数設計原則と実装パターンを解説します。小さく純粋で合成可能な関数を設計することで、テストの品質と保守性を向上させます。

## 1. PBT対応関数の設計原則

### 1.1 単一責任の純粋関数

Property-Based Testing(PBT)で効果的にテストするため、関数は以下の特性を持つべきです：

- **決定論的**: 同じ入力に対して常に同じ出力
- **副作用なし**: 外部状態を変更しない
- **単一責任**: 一つの変換・計算のみを担当
- **合成可能**: 小さな関数を組み合わせて複雑な処理を構築

```typescript
// ✅ 良い例: 純粋で単一責任の関数

// 座標計算のみを担当
export const calculateNewPosition = (
  current: Position,
  velocity: Vector3,
  deltaTime: number
): Position => ({
  x: current.x + velocity.x * deltaTime,
  y: current.y + velocity.y * deltaTime,
  z: current.z + velocity.z * deltaTime
});

// 境界チェックのみを担当
export const clampPosition = (
  position: Position,
  bounds: WorldBounds
): Position => ({
  x: Math.max(bounds.minX, Math.min(bounds.maxX, position.x)),
  y: Math.max(bounds.minY, Math.min(bounds.maxY, position.y)),
  z: Math.max(bounds.minZ, Math.min(bounds.maxZ, position.z))
});

// 距離計算のみを担当
export const calculateDistance = (
  a: Position,
  b: Position
): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

// ❌ 悪い例: 複数の責任を持つ関数
const complexPlayerMove = (player: Player, input: Input): Player => {
  // 移動、衝突判定、インベントリ更新、エフェクト適用が混在
  const newPos = calculateNewPosition(player.position, input.velocity, 0.016);
  const collisions = checkCollisions(newPos, world);
  const inventory = updateInventory(player.inventory, collisions);
  const effects = applyEffects(player.effects, newPos);
  // ...複雑すぎてテストが困難
};
```

### 1.2 テスト可能なプロパティを持つ関数設計

```typescript
// ✅ テスト可能なプロパティを持つ関数設計

// プロパティ1: 可換性（順序を変えても結果が同じ）
export const addVectors = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z
});

// プロパティ2: 結合性（グループ化しても結果が同じ）
export const multiplyMatrices = (a: Matrix3, b: Matrix3): Matrix3 => {
  // 3x3行列の乗算（結合法則を満たす）
  const result = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result as Matrix3;
};

// プロパティ3: 可逆性（逆操作で元に戻る）
export const encodeBlockData = (block: BlockData): string =>
  JSON.stringify(block);

export const decodeBlockData = (encoded: string): BlockData =>
  JSON.parse(encoded);

// プロパティ4: 冪等性（複数回適用しても結果が同じ）
export const normalizeVector = (v: Vector3): Vector3 => {
  const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (length === 0) return { x: 0, y: 0, z: 1 };
  return {
    x: v.x / length,
    y: v.y / length,
    z: v.z / length
  };
};

// プロパティ5: 単調性（入力の増加に対して出力も増加）
export const calculateExperience = (
  level: number,
  baseXP: number = 100
): number => baseXP * Math.pow(1.5, level - 1);

// プロパティ6: 分配法則
export const distributeScalar = (
  scalar: number,
  v1: Vector3,
  v2: Vector3
): Vector3 => {
  // scalar * (v1 + v2) = scalar * v1 + scalar * v2
  const sum = addVectors(v1, v2);
  return scaleVector(sum, scalar);
};

// プロパティ7: 境界保持
export const clampToUnit = (value: number): number =>
  Math.max(0, Math.min(1, value));

// プロパティ8: 対称性
export const distance = (a: Position, b: Position): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};
```

## 2. 合成可能な小関数パターン

### 2.1 PBT向け関数の粒度設計

```typescript
import { pipe, flow } from "effect/Function";

// ✅ PBT最適: 単一の数学的変換
const scaleVector = (v: Vector3, scale: number): Vector3 => ({
  x: v.x * scale,
  y: v.y * scale,
  z: v.z * scale
});

// ✅ PBT最適: 明確な不変条件を持つ関数
const normalizeValue = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

// ✅ PBT最適: 純粋なバリデーション関数
const isValidVector = (v: unknown): v is Vector3 =>
  typeof v === "object" &&
  v !== null &&
  "x" in v && typeof v.x === "number" &&
  "y" in v && typeof v.y === "number" &&
  "z" in v && typeof v.z === "number";

// 小さな純粋関数を定義
const validateMovement = (input: RawInput): ValidatedInput | null => {
  if (!input || typeof input !== "object") return null;
  if (!isValidVector(input.movement)) return null;
  return input as ValidatedInput;
};

const applyPhysics = (state: GameState): GameState => ({
  ...state,
  velocity: addVectors(
    state.velocity,
    scaleVector(state.acceleration, DELTA_TIME)
  ),
  position: addVectors(
    state.position,
    scaleVector(state.velocity, DELTA_TIME)
  )
});

const applyGravity = (state: GameState): GameState => ({
  ...state,
  velocity: addVectors(state.velocity, GRAVITY_VECTOR)
});

const applyFriction = (state: GameState): GameState => ({
  ...state,
  velocity: scaleVector(state.velocity, FRICTION_COEFFICIENT)
});

// 関数を合成してゲームティックを処理
export const processGameTick = flow(
  validateMovement,
  applyPhysics,
  applyGravity,
  applyFriction,
  clampVelocity,
  updatePosition
);
```

## 3. 数学的プロパティの活用

### 3.1 代数的プロパティ

```typescript
// 可換性 (Commutativity): a + b = b + a
export const testCommutativeProperty = <T>(
  operation: (a: T, b: T) => T,
  a: T,
  b: T
): boolean => {
  const result1 = operation(a, b);
  const result2 = operation(b, a);
  return deepEqual(result1, result2);
};

// 結合性 (Associativity): (a + b) + c = a + (b + c)
export const testAssociativeProperty = <T>(
  operation: (a: T, b: T) => T,
  a: T,
  b: T,
  c: T
): boolean => {
  const result1 = operation(operation(a, b), c);
  const result2 = operation(a, operation(b, c));
  return deepEqual(result1, result2);
};

// 単位元 (Identity): a + 0 = a
export const testIdentityProperty = <T>(
  operation: (a: T, identity: T) => T,
  a: T,
  identity: T
): boolean => {
  const result = operation(a, identity);
  return deepEqual(result, a);
};
```

### 3.2 幾何学的プロパティ

```typescript
// 三角不等式: d(a,c) <= d(a,b) + d(b,c)
export const satisfiesTriangleInequality = (
  a: Position,
  b: Position,
  c: Position
): boolean => {
  const dac = distance(a, c);
  const dab = distance(a, b);
  const dbc = distance(b, c);
  return dac <= dab + dbc + 1e-10; // 浮動小数点誤差を考慮
};

// 内積の線形性: dot(a, b + c) = dot(a, b) + dot(a, c)
export const dotProductLinearity = (
  a: Vector3,
  b: Vector3,
  c: Vector3
): boolean => {
  const sum = addVectors(b, c);
  const left = dotProduct(a, sum);
  const right = dotProduct(a, b) + dotProduct(a, c);
  return Math.abs(left - right) < 1e-10;
};
```

## 4. エラー処理のPBTパターン

### 4.1 境界条件の系統的テスト

```typescript
// 境界値の安全な処理
export const safeDivide = (
  numerator: number,
  denominator: number
): number | null => {
  if (denominator === 0) return null;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  return numerator / denominator;
};

// 配列インデックスの安全なアクセス
export const safeArrayAccess = <T>(
  array: T[],
  index: number
): T | undefined => {
  if (!Number.isInteger(index)) return undefined;
  if (index < 0 || index >= array.length) return undefined;
  return array[index];
};

// 範囲チェック付きの値設定
export const setValueInRange = (
  value: number,
  min: number,
  max: number
): number => {
  if (min > max) throw new Error("Invalid range: min > max");
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
};
```

## 5. PBT設計のベストプラクティス

### 5.1 関数の分離原則

```typescript
// ✅ 良い例: 計算と副作用の分離
const calculateDamage = (
  baseDamage: number,
  armor: number,
  criticalHit: boolean
): number => {
  const armorReduction = Math.max(0, armor / (armor + 100));
  const damage = baseDamage * (1 - armorReduction);
  return criticalHit ? damage * 2 : damage;
};

const applyDamageToPlayer = (
  player: Player,
  damage: number
): Effect.Effect<Player, never> =>
  Effect.succeed({
    ...player,
    health: Math.max(0, player.health - damage)
  });

// ❌ 悪い例: 計算と副作用が混在
const damagePlayer = (
  player: Player,
  baseDamage: number,
  armor: number,
  criticalHit: boolean
): Player => {
  // 計算と状態更新が混在してテストしづらい
  const damage = calculateDamage(baseDamage, armor, criticalHit);
  logDamageEvent(player.id, damage); // 副作用
  return {
    ...player,
    health: Math.max(0, player.health - damage)
  };
};
```

### 5.2 型安全な関数設計

```typescript
// ブランド型による型安全性の向上
type PlayerId = string & { readonly _brand: "PlayerId" };
type ItemId = string & { readonly _brand: "ItemId" };
type Quantity = number & { readonly _brand: "Quantity" };

// 型レベルでの制約による設計
const createPlayerId = (id: string): PlayerId | null => {
  if (id.length === 0 || id.length > 20) return null;
  if (!/^[a-zA-Z0-9_]+$/.test(id)) return null;
  return id as PlayerId;
};

const createQuantity = (value: number): Quantity | null => {
  if (!Number.isInteger(value)) return null;
  if (value < 0 || value > 999) return null;
  return value as Quantity;
};

// 型安全な操作
const addItemToInventory = (
  inventory: Inventory,
  itemId: ItemId,
  quantity: Quantity
): Inventory => {
  // 型システムが不正な組み合わせを防ぐ
  const currentQuantity = inventory.items.get(itemId) || (0 as Quantity);
  const newQuantity = (currentQuantity + quantity) as Quantity;

  return {
    ...inventory,
    items: new Map(inventory.items).set(itemId, newQuantity)
  };
};
```

## 関連ドキュメント

**テスト関連**:
- [fast-checkテストパターン](./06-fast-check-patterns.md) - fast-check具体的実装
- [Effect-TSテスト](./06d-effect-ts-testing.md) - Effect-TSテスト戦略

**設計関連**:
- [Effect-TSパターン](./06-effect-ts-patterns.md) - コアパターン集
- [関数型プログラミング](./07-functional-programming.md) - 関数型設計原則