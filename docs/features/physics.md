# 物理システム (Physics System)

物理システムは、ゲームワールド内のエンティティに基本的な物理法則、特に「重力」を適用する責務を担います。

---

## 責務

`physicsSystem` (`src/systems/physics.ts`) が果たす役割は、**重力の適用と、それに基づく位置の更新**です。

-   **重力の適用**: `Gravity` コンポーネントを持つエンティティに対して、`Velocity` コンポーネントのY軸方向の値を継続的に減少させます。
-   **位置の更新**: `Velocity` コンポーネントの値に基づいて、エンティティの `Position` を更新します。

このシステムによって計算された位置は「暫定的な」ものであり、最終的な位置は後続の `collisionSystem` によって衝突解決が行われた後に確定します。

---

## 関連コンポーネント

物理シミュレーションは、以下のコンポーネントを持つエンティティに作用します。

-   **`Position`**: エンティティの現在位置。このシステムの主要な更新対象の一つです。
-   **`Velocity`**: エンティティの現在の速度ベクトル (`dx`, `dy`, `dz`)。このシステムの主要な更新対象の一つです。
-   **`Gravity`**: エンティティが重力の影響を受けることを示すコンポーネント。Y軸速度から毎フレーム減算される値を保持します。

---

## システムのロジック (`physicsSystem`)

システムの実行フローは、パフォーマンスを最大化するために `querySoA` と効率的な並行処理を利用しています。

1.  **クエリ**:
    -   `src/domain/queries.ts` で定義された共通クエリ `physicsQuery` を使用します。
    -   `world.querySoA(physicsQuery)` を呼び出し、`Position`, `Velocity`, `Gravity` を持つエンティティのSoAデータを直接取得します。これにより、ループ処理前の不要なオブジェクト生成を完全に排除します。
2.  **物理計算と更新エフェクトの収集**:
    -   取得したコンポーネント配列を高速な `for` ループで反復処理します。
    -   各エンティティの `Velocity` の `dy` 成分に重力値を減算し、落下速度が一定値を超えないようにターミナルベロシティ（終端速度）を適用します。
    -   現在の速度に基づいて、新しい `Position` (`x`, `y`, `z`) を計算します。
    -   計算結果を `world.updateComponentData` を使って更新する `Effect` を生成し、配列に収集します。このAPIは新しいコンポーネントインスタンスを生成しないため、GC負荷を最小限に抑えます。
3.  **並行更新**:
    -   収集したすべての更新 `Effect` を `Effect.all` でラップし、並行に実行します。これにより、多数のエンティティに対する更新処理を効率的に完了させます。

```typescript
// src/systems/physics.ts より (主要部分)
const { entities, positions, velocitys, gravitys } = yield* _(world.querySoA(physicsQuery));

const updateEffects = [];
for (let i = 0; i < entities.length; i++) {
  const id = entities[i];
  const dy = velocitys.dy[i] as number;
  const gravityValue = gravitys.value[i] as number;

  // ターミナルベロシティを考慮しつつ重力を適用
  const newDy = Math.max(-2, dy - gravityValue);
  const newY = (positions.y[i] as number) + newDy;

  updateEffects.push(
    world.updateComponentData(id, Position, { y: newY }),
    world.updateComponentData(id, Velocity, { dy: newDy })
  );
}

if (updateEffects.length > 0) {
  yield* _(Effect.all(updateEffects, { discard: true, concurrency: "inherit" }));
}
```

---

## 他のシステムとの連携

物理システムの実行順序は、ゲームのシミュレーションにおいて極めて重要です。

`playerMovementSystem` -> **`physicsSystem`** -> `collisionSystem`

1.  **`playerMovementSystem`**: プレイヤーの移動やジャンプの *意図* を決定し、`Velocity` コンポーネントを更新します。（例: ジャンプ時に上向きの初速を与える）
2.  **`physicsSystem` (このシステム)**: `playerMovementSystem` によって設定された `Velocity` に重力を適用し、Y軸の速度を更新し、その結果に基づいて `Position` を暫定的に更新します。
3.  **`collisionSystem`**: `physicsSystem` によって更新された暫定的な `Position` を検証し、衝突検知と位置の補正を行い、`Position` を最終的な正しい位置に「確定」させます。

この明確な役割分担により、「移動の意図」「物理法則の適用」「衝突解決」という各ステップが、互いに独立しつつも正しく連携するシミュレーションが実現されています。