# 物理システム (Physics System)

物理システムは、ゲームワールド内のエンティティに基本的な物理法則、特に「重力」を適用し、その結果に基づいて位置を更新する責務を担います。

-   **関連ソース**: [`src/systems/physics.ts`](../../src/systems/physics.ts)

---

## 責務

`physicsSystem` が果たす役割は、**重力の適用と、それに基づく位置の更新**です。

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

システムの実行フローは、パフォーマンスを最大化するためにSoA(Structure of Arrays)ストアへの直接アクセスを利用しています。

1.  **クエリ**:
    -   `world.querySoA` と `src/domain/queries.ts` で定義された共通クエリ `physicsQuery` を使用し、対象となるコンポーネントのSoAストアへの直接参照を取得します。
2.  **物理計算と直接更新**:
    -   取得したエンティティの数だけ高速な `for` ループで反復処理します。
    -   各エンティティについて、`Velocity` の `dy` 成分に重力値を減算し、落下速度が一定値を超えないようにターミナルベロシティ（終端速度）を適用します。
    -   現在の速度に基づいて、`Position` (`x`, `y`, `z`) を更新します。
    -   **パフォーマンスの鍵**: すべての計算結果は、新しいオブジェクトを一切生成することなく、SoAストアの配列に直接書き込まれます。これにより、ループ内でのメモリアロケーションがゼロになり、GC（ガベージコレクション）によるフレームレートの低下を防ぎます。

```typescript
// src/systems/physics.ts (主要部分)
export const physicsSystem = Effect.gen(function* (_) {
  const world = yield* _(World);
  const { entities, positions, velocities, gravities } = yield* _(
    world.querySoA(physicsQuery),
  );

  for (let i = 0; i < entities.length; i++) {
    // 重力を速度に適用
    const newDy = Math.max(-2, velocities.dy[i] - gravities.value[i]);
    velocities.dy[i] = newDy;

    // 速度を位置に適用
    positions.x[i] += velocities.dx[i];
    positions.y[i] += newDy;
    positions.z[i] += velocities.dz[i];
  }
});
```

---

## 他のシステムとの連携

物理システムの実行順序は、ゲームのシミュレーションにおいて極めて重要です。

`playerMovementSystem` -> **`physicsSystem`** -> `collisionSystem`

1.  **`playerMovementSystem`**: プレイヤーの移動やジャンプの *意図* を決定し、`Velocity` コンポーネントを更新します。（例: ジャンプ時に上向きの初速を与える）
2.  **`physicsSystem` (このシステム)**: `playerMovementSystem` によって設定された `Velocity` に重力を適用し、Y軸の速度を更新し、その結果に基づいて `Position` を暫定的に更新します。
3.  **`collisionSystem`**: `physicsSystem` によって更新された暫定的な `Position` を検証し、衝突検知と位置の補正を行い、`Position` を最終的な正しい位置に「確定」させます。

この明確な役割分担により、「移動の意図」「物理法則の適用」「衝突解決」という各ステップが、互いに独立しつつも正しく連携するシミュレーションが実現されています。