# Domain Layer

## 概要

Domain Layerは、アプリケーションのビジネスロジックとドメインモデルを含む層です。
この層は技術的な詳細から独立しており、純粋なビジネスルールを表現します。

## 責務

- エンティティ（Entities）の定義
- 値オブジェクト（Value Objects）の定義
- ドメインイベント（Domain Events）の管理
- ドメインサービス（Domain Services）の実装
- ビジネスルールの実装

## 実装例

```typescript
// Entity定義
import { JsonValueSchema } from '@shared/schema/json'

export const Block = Schema.Struct({
  id: Schema.String,
  type: BlockType,
  position: Position,
  metadata: Schema.optional(Schema.Record(Schema.String, JsonValueSchema)),
})

// Service定義
export interface BlockService {
  readonly _: unique symbol
  readonly placeBlock: (position: Position, type: BlockType) => Effect.Effect<Block>
}

export const BlockService = Context.GenericTag<BlockService>('@domain/BlockService')
```

## ディレクトリ構造（予定）

```
domain/
├── entities/       # エンティティ
├── value-objects/  # 値オブジェクト
├── events/        # ドメインイベント
├── services/      # ドメインサービス
└── repositories/  # リポジトリインターフェース
```

## 設計原則

- **Pure Functions**: すべての関数は副作用を持たない
- **Immutability**: すべてのデータ構造は不変
- **Type Safety**: Schema.Struct による型安全性の保証
- **No Dependencies**: 他のレイヤーへの依存なし
- **技術的な詳細からの独立**
- **ビジネスルールの集約**
- **Effect-TSを活用した型安全性の確保**
