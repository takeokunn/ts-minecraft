# Particle System（パーティクルシステム）

## 概要

Particle Systemは、ゲーム内の視覚効果を豊かにするためのシステムです。爆発、煙、水しぶき、魔法効果など、様々なイベントを表現するために使用されます。

## システム設計

### 1. パーティクルの種類

- **環境エフェクト**: 雨粒、雪、葉っぱ、煙、炎
- **ゲームプレイエフェクト**: 爆発、魔法、ダメージ、回復、レベルアップ
- **ブロックエフェクト**: ブロック破壊時の破片、設置時の土煙
- **Mobエフェクト**: Mobの足跡、ブレス攻撃

### 2. パーティクルエンジン

- **エミッター (Emitter)**: パーティクルを生成する源。位置、生成頻度、初速などを管理する。
- **パーティクル (Particle)**: 個々の粒子。寿命、位置、速度、色、サイズなどの状態を持つ。
- **アップデーター (Updater)**: パーティクルの状態を毎フレーム更新するロジック。重力、空気抵抗、色の変化などを担当する。
- **レンダラー (Renderer)**: パーティクルを画面に描画する。ビルボード、メッシュ、トレイルなど様々な描画方法がある。

```typescript
// Particleスキーマ
export const Particle = Schema.Struct({
  id: Schema.String,
  position: Vector3,
  velocity: Vector3,
  acceleration: Vector3,
  lifetime: Schema.Number, // 残り寿命 (秒)
  age: Schema.Number,
  size: Schema.Number,
  color: Color,
  opacity: Schema.Number
});

// パーティクルシステムサービス
export interface ParticleService {
  readonly emit: (emitterConfig: EmitterConfig) => Effect.Effect<void, ParticleError>;
  readonly update: (deltaTime: number) => Effect.Effect<void, never>;
}
```

### 3. 実装のポイント

#### 3.1 パフォーマンス
- **オブジェクトプーリング**: パーティクルオブジェクトを再利用して、GCの負荷を軽減する。
- **GPUアクセラレーション**: パーティクルの更新とレンダリングをGPUで行う（コンピュートシェーダーやTransform Feedbackを利用）。
- **バッチング**: 同じ種類のパーティクルをまとめて描画し、ドローコールを削減する。
- **LOD (Level of Detail)**: プレイヤーからの距離に応じて、パーティクルの数や詳細度を調整する。

#### 3.2 柔軟性
- **設定ファイル**: パーティクルの振る舞い（色、サイズ、動きの変化など）をJSONなどの設定ファイルで定義できるようにし、デザイナーが容易に調整できるようにする。
- **スクリプティング**: LuaやJavaScriptなどのスクリプト言語で、複雑なパーティクルの振る舞いを定義できるようにする。

## UI統合

- **設定画面**: パーティクルの表示量（最小、中、最大）をプレイヤーが設定できるようにする。

## テストケース

- [ ] 爆発時に爆発パーティクルが正しく表示されること
- [ ] 雨天時に雨粒パーティクルが表示されること
- [ ] 松明から煙パーティクルが出ること
- [ ] プレイヤーがダメージを受けた際にダメージパーティクルが表示されること
- [ ] パーティクル設定が描画に反映されること
