# 物理システム (Physics System)

物理システムは、ゲームワールド内のエンティティに基本的な物理法則、特に「重力」と「運動」を適用する責務を担います。これにより、エンティティが時間と共にもっともらしく振る舞うようになります。

---

## 責務

`physicsSystem` (`src/systems/physics.ts`) は、主に2つの役割を果たします。

1.  **重力の適用**: `Gravity` コンポーネントを持つエンティティに対して、下向きの加速度を継続的に適用します。
2.  **運動の実行**: `Velocity` コンポーネントを持つエンティティの速度に基づいて、その `Position` を更新します。

---

## 関連コンポーネント

物理シミュレーションは、以下のコンポーネントを持つエンティティに作用します。

-   **`Position`**: エンティティの3D空間における現在位置。このシステムによって更新される主要なターゲットです。
-   **`Velocity`**: エンティティの現在の速度ベクトル (`dx`, `dy`, `dz`)。`playerMovementSystem` など他のシステムによって変更され、このシステムによって位置に変換されます。
-   **`Gravity`**: エンティティが重力の影響を受けることを示すタグコンポーネント。重力の加速度 (`-9.8 m/s^2` に相当する値) を保持します。

---

## システムのロジック (`physicsSystem`)

システムの実行フローは、パフォーマンスを最大化するために `querySoA` を利用しています。

1.  **クエリ (重力)**: `World` に対して、`Velocity` と `Gravity` の両方を持つエンティティのSoAデータを `querySoA` で直接取得します。これにより、ループ処理前の不要なオブジェクト生成を完全に排除します。
2.  **重力の計算**: 取得したコンポーネント配列を高速な `for` ループで反復処理します。
    -   各エンティティの `Velocity` の `dy` 成分に重力値を減算します。
    -   落下速度が一定値を超えないように、ターミナルベロシティ（終端速度）を適用します。
    -   計算結果を `world.updateComponent` を使って `World` に書き戻します。

```typescript
// src/systems/physics.ts より (主要部分)
const { entities, velocitys, gravitys } = yield* _(
  world.querySoA(Velocity, Gravity),
);

for (let i = 0; i < entities.length; i++) {
  const id = entities[i];
  const dy = velocitys.dy[i] as number;
  const gravityValue = gravitys.value[i] as number;

  // ターミナルベロシティを考慮しつつ重力を適用
  const newDy = Math.max(-2, dy - gravityValue);
  const newVel = new Velocity({
    dx: velocitys.dx[i] as number,
    dy: newDy,
    dz: velocitys.dz[i] as number,
  });
  // world.updateComponent(id, newVel) を実行
}
```

**注意**: `physicsSystem` は運動の計算（`Position`の更新）は行いません。この責務は `collisionSystem` が担います。`physicsSystem` は純粋に `Velocity` を更新することに集中します。

---

## 他のシステムとの連携

物理システムの実行順序は、ゲームのシミュレーションにおいて極めて重要です。

`playerMovementSystem` -> **`physicsSystem`** -> `collisionSystem`

1.  **`playerMovementSystem`**: プレイヤーの移動やジャンプの *意図* を決定し、`Velocity` コンポーネントを更新します。（例: ジャンプ時に上向きの初速を与える）
2.  **`physicsSystem` (このシステム)**:
    -   まず、`playerMovementSystem` によって設定された `Velocity` に重力を適用します。
    -   次に、その最終的な `Velocity` を使って、エンティティが次に *移動しようとする* **暫定的な新しい位置** を計算し、`Position` を更新します。
3.  **`collisionSystem`**:
    -   `physicsSystem` によって計算された新しい `Position` が、地形や他のエンティティと衝突していないかをチェックします。
    -   もし衝突が検出された場合、`collisionSystem` はエンティティが壁や床にめり込まないように `Position` を**補正**します。
    -   また、下向きの衝突を検出した場合、`Player` コンポーネントの `isGrounded` フラグを `true` に設定します。

この明確な役割分担により、「移動の意図」「物理法則の適用」「衝突解決」という各ステップが、互いに独立しつつも正しく連携するシミュレーションが実現されています。詳細は **[衝突検知システム](./collision.md)** を参照してください。