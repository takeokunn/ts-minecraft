# ブロック操作システム (Block Interaction System)

-   **関連ソース**: [`src/systems/block-interaction.ts`](../../src/systems/block-interaction.ts)
-   **責務**: プレイヤーの入力とターゲット情報に基づき、ワールド内のブロックを設置または破壊すること。

---

## 概要

このシステムは、プレイヤーの「ブロックを置きたい」「ブロックを壊したい」という意図を、実際のワールドの変更に変換する役割を担います。プレイヤーの入力状態、ターゲットされているブロック、そしてホットバーの選択状態を監視し、条件が満たされたフレームでブロックの設置または破壊処理を実行します。

## アーキテクチャ

`blockInteractionSystem`は、`(world: World, deps: SystemDependencies) => [World, SystemCommand[]]` というシグネチャを持つ純粋な関数 (`System`) として実装されています。副作用は起こさず、コマンドも発行しないため、常に空のコマンド配列 `[]` を返します。状態の更新は、`addArchetype`, `removeEntity`, `updateComponent` といったヘルパー関数を通じて、`World` オブジェクトを不変(immutable)に扱います。

## 処理フロー

`blockInteractionSystem`は毎フレーム実行され、`ts-pattern`ライブラリの`match`式を用いて、プレイヤーの状態に応じた処理（破壊または設置）を呼び出します。

1.  **クエリ実行**:
    -   `runtime/world` の `query` 関数と `domain/queries` の `playerTargetQuery` を使い、ブロック操作に必要なコンポーネント（`player`, `inputState`, `target`, `hotbar`）を持つプレイヤーエンティティを取得します。
    -   プレイヤーがブロックをターゲットしていない場合 (`target.type`が`'block'`でない場合)、システムは何もしません。

2.  **ブロック破壊 (`handleDestroyBlock`)**:
    -   `inputState.destroy` が `true` の場合に実行されます。
    -   `target.entityId` を使して、`removeEntity` ヘルパーを呼び出し、ターゲットされたブロックエンティティを `World` から削除します。
    -   プレイヤーのターゲット情報を `target: 'none'` にリセットし、すでに存在しないブロックを指し続けることを防ぎます。
    -   **`editedBlocks` の更新**: 後述するセーブ/ロード機構のため、破壊したブロックの位置を `world.globalState.editedBlocks.destroyed` に記録します。

3.  **ブロック設置 (`handlePlaceBlock`)**:
    -   `inputState.place` が `true` の場合に実行されます。
    -   ターゲットされたブロックの位置 (`target.position`) と面の向き (`target.face`) から、新しいブロックを設置すべき座標を計算します。
    -   `hotbar` コンポーネントから現在選択されているブロックの種類を取得します。
    -   `domain/archetypes` の `createArchetype` ファクトリを使い、新しいブロックエンティティを生成します。
    -   `addArchetype` ヘルパーを呼び出し、生成されたエンティティを `World` に追加します。
    -   **入力フラグの消費**: 連続してブロックが設置されるのを防ぐため、`inputState.place` フラグを `false` にリセットします。これにより、プレイヤーはクリックごとに1ブロックしか設置できません。
    -   **`editedBlocks` の更新**: 設置したブロックの位置と種類を `world.globalState.editedBlocks.placed` に記録します。

## `editedBlocks` による状態永続化

本システムは、単にエンティティを削除・追加するだけでなく、`world.globalState.editedBlocks` という特別な状態を更新します。これは、プロシージャルに生成された地形と、プレイヤーによって編集された地形を区別するための重要な仕組みです。

-   `computation.worker` によってチャンクが再生成された場合でも、`editedBlocks` に記録された変更（破壊されたブロックは生成せず、設置されたブロックは追加で生成する）を適用することで、プレイヤーの編集内容が失われないようになっています。
-   この状態は、将来的にゲームワールド全体をセーブ・ロードする機能の基礎となります。

## 実行順序

`updateTargetSystem` -> **`blockInteractionSystem`**

この実行順序は極めて重要です。まず `updateTargetSystem` がプレイヤーの視線に基づき、そのフレームでターゲットしているブロック情報を `Target` コンポーネントとして更新します。その直後に `blockInteractionSystem` が実行されることで、常に最新のターゲット情報に基づいてブロック操作を行うことが保証されます。