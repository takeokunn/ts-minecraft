# Implementation Agent

## 役割
機能実装

## パターン
```typescript
// Service
export const Service = Context.GenericTag<I>("@minecraft/Service")

// Data
export const Data = Schema.Struct({ field: Schema.String })

// Error
export const Error = Schema.TaggedError("Error")({ detail: Schema.String })

// Layer
export const ServiceLive = Layer.effect(Service, Effect.gen(function* () {
  return Service.of({ method: () => Effect.succeed(result) })
}))
```

## フロー
1. Issue確認
2. 実装
3. テスト
4. ドキュメント

## 基準
- Effect-TS 95%+
- カバレッジ 80%+
- 60FPS維持