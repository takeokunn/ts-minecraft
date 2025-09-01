# 入力ポーリングシステム (Input Polling System)

- **関連ソース**: [`src/systems/input-polling.ts`](../../src/systems/input-polling.ts)
- **責務**: 毎フレーム、キーボードとマウスの現在の入力状態を `InputService` から取得し、プレイヤーエンティティの `InputState` コンポーネントを更新すること。

---

## 概要

このシステムは、プレイヤーの物理的な入力をゲーム内の状態に変換する最初のステップです。他のゲームプレイシステム（移動、ブロック操作など）が、ハードウェアの詳細を意識することなく、常に最新のプレイヤーの意図（「前に進みたい」「ジャンプしたい」など）を参照できるようにするための重要な役割を担っています。

## 処理フロー

1.  **プレイヤーの検索**: `world.querySingle(Player)` を使用して、プレイヤーエンティティを検索します。
2.  **入力状態の取得**: `InputService` の `getKeyboardState()` メソッドを呼び出し、現在押されているキーとマウスボタンの `Set<string>` を取得します。
3.  **`InputState` の構築**: 取得した情報をもとに、`InputState` コンポーネントの各プロパティを `true` または `false` で設定します。
    - **移動**: `KeyW` (forward), `KeyS` (backward), `KeyA` (left), `KeyD` (right)
    - **アクション**: `Space` (jump), `ShiftLeft` (sprint)
    - **ブロック操作**: `Mouse0` (destroy), `Mouse2` (place)
4.  **コンポーネントの更新**: `world.updateComponent()` を呼び出し、プレイヤーエンティティの `InputState` を新しい状態で上書きします。

## 実行順序

`inputPollingSystem` は、プレイヤーの移動やアクションを処理する他のどのシステムよりも先に実行されるようにスケジューリングされています。これにより、同じフレーム内で後続のシステムが、遅延なく最新の入力状態に基づいて計算を行えることが保証されます。
