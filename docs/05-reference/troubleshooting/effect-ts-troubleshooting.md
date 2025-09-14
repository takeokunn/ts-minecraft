---
title: "Effect-TSトラブルシューティング - Effect-TS問題解決ガイド"
description: "Effect-TS 3.17+使用時の一般的な問題と解決方法。エラーハンドリング、パフォーマンス問題、デバッグ技法。"
category: "reference"
difficulty: "intermediate"
tags: ["troubleshooting", "effect-ts", "debugging", "error-handling", "performance"]
prerequisites: ["effect-ts-basics"]
estimated_reading_time: "20分"
dependencies: ["./debugging-guide.md"]
status: "complete"
---

# Effect-TS Troubleshooting

> **Effect-TS問題解決**: Effect-TS特有の問題と解決策

## 概要

Effect-TS 3.17+使用時の一般的な問題と解決方法について解説します。

## 一般的な問題

### Schema関連エラー

#### Schema.Structが見つからない

```typescript
// ❌ 古いバージョンの書き方
import { Schema } from "@effect/schema"
const User = Schema.object({
  name: Schema.string
})

// ✅ 正しい書き方
import { Schema } from "@effect/schema"
const User = Schema.Struct({
  name: Schema.String
})
```

### Context関連エラー

#### Context.Tagの型エラー

```typescript
// ❌ 旧バージョンの書き方
const UserService = Context.Tag<UserService>()

// ✅ 新バージョンの書き方
const UserService = Context.GenericTag<UserService>("UserService")
```

### Effect関連エラー

#### Effect.genの型エラー

```typescript
// ❌ 型推論が失敗するケース
const effect = Effect.gen(function* (_) {
  const user = yield* _(UserService)
  return user.name
})

// ✅ 明示的な型注釈
const effect = Effect.gen(function* () {
  const user = yield* UserService
  return user.name
})
```

## バージョン互換性

### 3.16 → 3.17 移行

#### 主要変更点

1. `Schema.object` → `Schema.Struct`
2. `Context.Tag` → `Context.GenericTag`
3. `Match.value` の新しいAPI

## パフォーマンス問題

### メモリリーク

```typescript
// ❌ Fiber のクリーンアップ不足
const fiber = Effect.runFork(effect)
// fiber.interrupt() を忘れがち

// ✅ 適切なクリーンアップ
const fiber = Effect.runFork(effect)
Effect.addFinalizer(() => fiber.interrupt())
```

## デバッグ手法

### Effect のトレース

```typescript
const effect = pipe(
  UserService,
  Effect.tap(user => Effect.log(`User: ${user.name}`)),
  Effect.withSpan("getUserEffect")
)
```

## 関連項目

- [Effect-TSパターン](../../01-architecture/06-effect-ts-patterns.md)
- [エラー解決ガイド](../../03-guides/04-error-resolution.md)
- [デバッグガイド](../../03-guides/09-debugging-guide.md)