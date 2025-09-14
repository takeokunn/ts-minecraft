# TypeScript Minecraft Clone

## プロジェクト
Effect-TS 3.17+ / DDD×ECS / 完全関数型

## コマンド
```bash
pnpm dev          # 開発
pnpm test:unit    # テスト
pnpm typecheck    # 型チェック
pnpm lint         # リント
```

## 構造
```
src/
├── domain/         # DDD
├── infrastructure/ # ECS/IO
├── application/    # ユースケース
└── shared/        # 共通
```

## 制約
- クラス禁止（Data.Class除く）
- var/let禁止
- any型禁止
- async/await禁止
- Effect.genのみ使用

## パターン

### サービス
```typescript
export const Service = Context.GenericTag<ServiceInterface>("@minecraft/Service")
```

### データ
```typescript
export const Data = Schema.Struct({
  field: Schema.String
})
```

### エラー
```typescript
export const Error = Schema.TaggedError("Error")({
  detail: Schema.String
})
```

## チェック
- Effect-TS 95%+
- カバレッジ 80%+
- 60FPS維持

## 参照
- ROADMAP.md
- docs/
- src/domain/