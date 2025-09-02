# プレイヤー (Player)

プレイヤーは、ユーザーがゲームワールドと対話するための中心的な存在です。このドキュメントでは、プレイヤーの操作がどのようにして実現されているか、特に入力処理、カメラ制御、移動ロジック、ブロック操作の4つの独立したシステムがどのように連携するかに焦点を当てて解説します。

---

## 関連コンポーネント

プレイヤーエンティティは、以下のコンポーネントの組み合わせによってその状態と振る舞いが定義されます。

- **`Player`**: エンティティをプレイヤーとして識別するためのタグコンポーネント。プレイヤーが地面に接しているかどうかの状態 `isGrounded` を保持します。
- **`Position`**: 3D空間におけるエンティティの現在位置 (`x`, `y`, `z`)。
- **`Velocity`**: エンティティの現在の速度と方向 (`dx`, `dy`, `dz`)。移動ロジックが主にこのコンポーネントを操作します。
- **`InputState`**: `forward`, `backward`, `left`, `right`, `jump`, `sprint` など、プレイヤーの現在のキーボード入力のスナップショットを保持します。
- **`CameraState`**: カメラの `pitch` (上下の傾き) と `yaw` (左右の回転) をラディアンで格納し、プレイヤーが見ている方向を決定します。
- **`Collider`**: 衝突検知に使用される、エンティティの物理的なバウンディングボックス（AABB）を定義します。
- **`Gravity`**: エンティティが重力の影響を受けることを示すコンポーネント。
- **`Target`**: プレイヤーが現在視線の先に捉えている対象（ブロック、エンティティ、あるいは何もない空間）の情報を保持します。
- **`Hotbar`**: プレイヤーのホットバーの状態を管理し、どのブロックが選択されているかを保持します。

---

## システムの連携とデータフロー

プレイヤーの操作は、単一の巨大なシステムではなく、責務が明確に分離された小さなシステムのパイプラインによって実現されます。これにより、各ロジックの独立性とテスト容易性が高まっています。

```
[InputService] --(入力)--> [InputPollingSystem] & [CameraControlSystem]
      |
      v
[InputState] & [CameraState] --(読み取り)--> [PlayerMovementSystem] --(更新)--> [Velocity]
      |
      v
[Raycast] -> [UpdateTargetSystem] --(更新)--> [Target]
      |
      v
[BlockInteractionSystem] --(ワールド変更)--> [World]
```

この後、`physicsSystem` と `collisionSystem` が、`PlayerMovementSystem` によって更新された `Velocity` を使って最終的な `Position` を計算し、プレイヤーをワールド内で実際に移動させます。

---

## 1. 入力ポーリングシステム (Input Polling System)

- **関連ソース**: [`src/systems/input-polling.ts`](../../src/systems/input-polling.ts)
- **責務**: 毎フレーム、キーボードとマウスの現在の入力状態を `InputService` から取得し、プレイヤーエンティティの `InputState` コンポーネントを更新すること。

### 概要

このシステムは、プレイヤーの物理的な入力をゲーム内の状態に変換する最初のステップです。他のゲームプレイシステム（移動、ブロック操作など）が、ハードウェアの詳細を意識することなく、常に最新のプレイヤーの意図（「前に進みたい」「ジャンプしたい」など）を参照できるようにするための重要な役割を担っています。

### 処理フロー

1.  **プレイヤーの検索**: `world.querySingle(Player)` を使用して、プレイヤーエンティティを検索します。
2.  **入力状態の取得**: `InputService` の `getKeyboardState()` メソッドを呼び出し、現在押されているキーとマウスボタンの `Set<string>` を取得します。
3.  **`InputState` の構築**: 取得した情報をもとに、`InputState` コンポーネントの各プロパティを `true` または `false` で設定します。
    - **移動**: `KeyW` (forward), `KeyS` (backward), `KeyA` (left), `KeyD` (right)
    - **アクション**: `Space` (jump), `ShiftLeft` (sprint)
    - **ブロック操作**: `Mouse0` (destroy), `Mouse2` (place)
4.  **コンポーネントの更新**: `world.updateComponent()` を呼び出し、プレイヤーエンティティの `InputState` を新しい状態で上書きします。

### 実行順序

`inputPollingSystem` は、プレイヤーの移動やアクションを処理する他のどのシステムよりも先に実行されるようにスケジューリングされています。これにより、同じフレーム内で後続のシステムが、遅延なく最新の入力状態に基づいて計算を行えることが保証されます。

---

## 2. カメラ制御システム (Camera Control System)

- **責務**: マウスの動きを `CameraState` コンポーネントに反映します。
- **詳細**: [カメラ機能のドキュメント](../camera/README.md) を参照してください。

---

## 3. プレイヤー移動システム (Player Movement System)

- **関連ソース**: [`src/systems/player-movement.ts`](../../src/systems/player-movement.ts)
- **責務**: プレイヤーの入力状態とカメラの向きに基づいて移動とジャンプの意図を計算し、その結果を `Velocity` コンポーネントに反映すること。

### 概要

このシステムは、プレイヤーの「移動したい」という意図を物理的な「速度」に変換する役割を担います。入力状態とカメラの向きから進むべき方向と速さを決定し、`Velocity` コンポーネントを更新します。

このシステムは速度を計算するだけであり、**実際にエンティティの座標を移動させることはしません**。座標の更新は、この後に実行される `physicsSystem` と `collisionSystem` が担当します。この責務の分離が、予測可能でテストしやすい物理エンジンを構築する鍵となります。

### アーキテクチャ

`playerMovementSystem` は、`Effect<R, E, void>` として実装された `Effect` プログラムです。

- **依存性の注入**: `World` サービスを `Effect` のコンテキストを通じて受け取ります。
- **状態の更新**: `world.querySoA` を使ってコンポーネントの配列への直接参照を取得し、状態を効率的に更新します。
- **テスト容易性**: 速度計算などのコアロジックは、システム本体から独立した純粋な関数 (`calculateHorizontalVelocity`, `calculateVerticalVelocity` など) としてエクスポートされています。これにより、`Effect` ランタイムに依存しないユニットテストが容易になっています。

### 処理フロー

`playerMovementSystem` は毎フレーム実行され、以下の処理を行います。

1.  **クエリ実行**:
    - `playerMovementQuery` を使って、移動に必要なコンポーネント（`player`, `inputState`, `velocity`, `cameraState`）を持つエンティティのデータを `querySoA` で取得します。

2.  **垂直方向の速度計算**:
    - プレイヤーの `isGrounded` (接地フラグ) と `inputState.jump` (ジャンプ入力) を評価します。
    - 接地中にジャンプ入力があれば、垂直速度(`dy`)に `JUMP_FORCE` をセットし、`isGrounded` を `false` にして連続ジャンプを防ぎます。

3.  **水平方向の速度計算**:
    - 水平方向の入力（`forward`, `left`など）の有無で処理を分岐します。
    - **入力がある場合**:
      - `sprint` 入力に応じて移動速度を決定します。
      - 入力方向から移動ベクトルを計算し、斜め移動が速くなりすぎないよう正規化します。
      - カメラの `yaw`（左右の向き）を考慮し、移動ベクトルを回転させ、カメラが見ている方向に正しく移動するように調整します。
    - **入力がない場合**:
      - 現在の水平速度に減速率を乗算し、スムーズに減速させます。
      - 速度が閾値以下になったら完全に `0` にして停止させます。

4.  **コンポーネントの更新**:
    - 計算された新しい速度と接地状態を、`querySoA` で取得したコンポーネント配列に直接書き込み、更新を完了します。

### 実行順序

`inputPollingSystem` -> `cameraControlSystem` -> **`playerMovementSystem`** -> `physicsSystem` -> `collisionSystem`

1.  `inputPollingSystem` と `cameraControlSystem` の**後**に実行されることで、常に最新の入力と視点情報に基づいて移動計算ができます。
2.  `physicsSystem` と `collisionSystem` の**前**に実行されることで、ここで計算された「移動の意図」としての速度が、その後の物理演算（重力適用）と衝突解決に正しく反映されます。

---

## 4. ブロック操作システム (Block Interaction System)

- **関連ソース**: [`src/systems/block-interaction.ts`](../../src/systems/block-interaction.ts)
- **責務**: プレイヤーの入力とターゲット情報に基づき、ワールド内のブロックを設置または破壊すること。

### 概要

このシステムは、プレイヤーの「ブロックを置きたい」「ブロックを壊したい」という意図を、実際のワールドの変更に変換する役割を担います。プレイヤーの入力状態、ターゲットされているブロック、そしてホットバーの選択状態を監視し、条件が満たされたフレームでブロックの設置または破壊処理を実行します。

### アーキテクチャ

`blockInteractionSystem`は、`(world: World, deps: SystemDependencies) => [World, SystemCommand[]]` というシグネチャを持つ純粋な関数 (`System`) として実装されています。副作用は起こさず、コマンドも発行しないため、常に空のコマンド配列 `[]` を返します。状態の更新は、`addArchetype`, `removeEntity`, `updateComponent` といったヘルパー関数を通じて、`World` オブジェクトを不変(immutable)に扱います。

### 処理フロー

`blockInteractionSystem`は毎フレーム実行され、`@effect/match`ライブラリの`Match`式を用いて、プレイヤーの状態に応じた処理（破壊または設置）を呼び出します。

1.  **クエリ実行**:
    - `runtime/world` の `query` 関数と `domain/queries` の `playerTargetQuery` を使い、ブロック操作に必要なコンポーネント（`player`, `inputState`, `target`, `hotbar`）を持つプレイヤーエンティティを取得します。
    - プレイヤーがブロックをターゲットしていない場合 (`target.type`が`'block'`でない場合)、システムは何もしません。

2.  **ブロック破壊 (`handleDestroyBlock`)**:
    - `inputState.destroy` が `true` の場合に実行されます。
    - `target.entityId` を使して、`removeEntity` ヘルパーを呼び出し、ターゲットされたブロックエンティティを `World` から削除します。
    - プレイヤーのターゲット情報を `target: 'none'` にリセットし、すでに存在しないブロックを指し続けることを防ぎます。
    - **`editedBlocks` の更新**: 後述するセーブ/ロード機構のため、破壊したブロックの位置を `world.globalState.editedBlocks.destroyed` に記録します。

3.  **ブロック設置 (`handlePlaceBlock`)**:
    - `inputState.place` が `true` の場合に実行されます。
    - ターゲットされたブロックの位置 (`target.position`) と面の向き (`target.face`) から、新しいブロックを設置すべき座標を計算します。
    - `hotbar` コンポーネントから現在選択されているブロックの種類を取得します。
    - `domain/archetypes` の `createArchetype` ファクトリを使い、新しいブロックエンティティを生成します。
    - `addArchetype` ヘルパーを呼び出し、生成されたエンティティを `World` に追加します。
    - **入力フラグの消費**: 連続してブロックが設置されるのを防ぐため、`inputState.place` フラグを `false` にリセットします。これにより、プレイヤーはクリックごとに1ブロックしか設置できません。
    - **`editedBlocks` の更新**: 設置したブロックの位置と種類を `world.globalState.editedBlocks.placed` に記録します。

### `editedBlocks` による状態永続化

本システムは、単にエンティティを削除・追加するだけでなく、`world.globalState.editedBlocks` という特別な状態を更新します。これは、プロシージャルに生成された地形と、プレイヤーによって編集された地形を区別するための重要な仕組みです。

- `computation.worker` によってチャンクが再生成された場合でも、`editedBlocks` に記録された変更（破壊されたブロックは生成せず、設置されたブロックは追加で生成する）を適用することで、プレイヤーの編集内容が失われないようになっています。
- この状態は、将来的にゲームワールド全体をセーブ・ロードする機能の基礎となります。

### 実行順序

`updateTargetSystem` -> **`blockInteractionSystem`**

この実行順序は極めて重要です。まず `updateTargetSystem` がプレイヤーの視線に基づき、そのフレームでターゲットしているブロック情報を `Target` コンポーネントとして更新します。その直後に `blockInteractionSystem` が実行されることで、常に最新のターゲット情報に基づいてブロック操作を行うことが保証されます。
