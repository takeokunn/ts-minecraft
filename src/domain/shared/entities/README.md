# 共有カーネル（Shared Kernel）

## 対象範囲

複数コンテキストで使用される基本エンティティIDのみを含む。

## 含まれる型

- **WorldId**: ワールド識別子（文字列型、1-255文字、英数字/アンダースコア/ハイフン）
- **PlayerId**: プレイヤー識別子（UUID v4形式、`player_`プレフィックス）
- **EntityId**: エンティティ識別子（UUID v4形式、`entity_`プレフィックス）
- **BlockId**: ブロック識別子（文字列型、通常のブロック参照用）
- **BlockTypeId**: ブロックタイプ識別子（数値型、チャンク内部データ構造用）
- **ItemId**: アイテム識別子（文字列型）
- **ChunkId**: チャンク識別子（文字列型、座標ベース形式 `chunk_x_z`）

## BlockId vs BlockTypeId の使い分け

- **BlockId（文字列型）**: ゲームロジック全般での使用（例: `"minecraft:stone"`, `"mymod:custom_block"`）
- **BlockTypeId（数値型）**: チャンク内部の最適化されたデータ構造での使用（メモリ効率重視）

## 追加基準

新しい型を共有カーネルに追加する際は、以下の条件を満たす必要がある：

1. **3つ以上のコンテキスト**で使用される型
2. **ドメインの根幹**となるID型
3. **ビジネスロジックを含まない**純粋な識別子

## 変更時の注意事項

共有カーネルの型を変更する際は、以下の手順を遵守すること：

1. **全依存コンテキストの合意**が必要
2. **後方互換性の維持**（破壊的変更は原則禁止）
3. **Effect-TS Schemaパターン**への準拠（`Schema.brand()`の使用）
4. **変更影響範囲の調査**（`grep -r "TypeName" src/`等で確認）

## ファイル構成規約

各ID型は以下の構成を持つ：

```
{id_type}/
├── schema.ts      - Schema定義とTypeエクスポート
├── operations.ts  - 生成・検証・比較等の操作関数
├── errors.ts      - 型固有のエラー定義（必要に応じて）
└── index.ts       - 公開APIの再エクスポート
```

## テスト規則

- 各ID型に**unit testを必須化**
- Schemaバリデーションのテスト（正常系・異常系）
- operations.tsの全関数のテスト

## 使用例

```typescript
import { WorldIdSchema } from '@/domain/shared/entities/world_id'
import { PlayerIdSchema } from '@/domain/shared/entities/player_id'
import { BlockTypeIdSchema } from '@/domain/shared/entities/block_type_id'
import { ChunkIdSchema } from '@/domain/shared/entities/chunk_id'

// Effect-TS Schemaでのバリデーション
const worldId = Schema.decodeSync(WorldIdSchema)('my_world')
const playerId = Schema.decodeSync(PlayerIdSchema)('player_550e8400-e29b-41d4-a716-446655440000')
const blockTypeId = Schema.decodeSync(BlockTypeIdSchema)(1)
const chunkId = Schema.decodeSync(ChunkIdSchema)('chunk_0_0')
```

## 禁止事項

- **コンテキスト固有のビジネスロジック**を含めること
- **単一コンテキストでのみ使用される型**の追加
- **共有カーネル型の独自拡張**（拡張が必要な場合は各コンテキストで別型として定義）
