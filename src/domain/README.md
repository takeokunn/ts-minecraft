# Domain Layer

## 概要

Domain Layerは、Minecraftクローンのビジネスロジックとドメインモデルを定義します。このレイヤーは技術的な実装詳細から完全に独立しており、純粋な関数型プログラミングパターンで実装されています。

## 責務

- **エンティティ**: プレイヤー、ブロック、アイテムなどのゲーム内オブジェクト
- **値オブジェクト**: 座標、ベクトル、色などの不変な値
- **ドメインイベント**: ゲーム内で発生するイベントの定義
- **ドメインサービス**: エンティティ間の複雑な相互作用のビジネスロジック

## Effect-TSパターン

```typescript
// Schema定義
export const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})

// Service定義
export interface BlockService {
  readonly _: unique symbol
  readonly placeBlock: (position: Position, type: BlockType) => Effect.Effect<Block>
}

export const BlockService = Context.GenericTag<BlockService>('@domain/BlockService')
```

## ディレクトリ構造（実装予定）

```
domain/
├── entities/     # エンティティ定義
├── values/       # 値オブジェクト
├── events/       # ドメインイベント
├── services/     # ドメインサービス
└── index.ts      # 公開API
```

## 設計原則

1. **Pure Functions**: すべての関数は副作用を持たない
2. **Immutability**: すべてのデータ構造は不変
3. **Type Safety**: Schema.Struct による型安全性の保証
4. **No Dependencies**: 他のレイヤーへの依存なし
