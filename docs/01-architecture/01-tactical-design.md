---
title: "DDD戦術設計 - ドメインモデル実装パターン"
description: "DDD戦術レベル設計パターンのEffect-TS 3.17+実装。エンティティ、値オブジェクト、ドメインサービス。"
category: "architecture"
difficulty: "advanced"
tags: ["ddd", "tactical-design", "effect-ts", "entities", "value-objects", "domain-services"]
prerequisites: ["ddd-fundamentals", "effect-ts-basics"]
estimated_reading_time: "30分"
dependencies: ["./02-ddd-strategic-design.md"]
status: "complete"
---

# DDD Tactical Design

> **戦術設計**: ドメイン駆動設計の戦術パターンとEffect-TS統合

## 概要

DDDの戦術レベルの設計パターンをEffect-TS 3.17+で実装する方法について解説します。

## エンティティ設計

### Effect-TSベースのエンティティ

```typescript
import { Schema } from "@effect/schema"
import { Context, Effect } from "effect"

// エンティティのSchema定義
const PlayerEntity = Schema.Struct({
  id: Schema.String,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  health: Schema.Number,
  createdAt: Schema.Date
})

type PlayerEntity = Schema.Schema.Type<typeof PlayerEntity>
```

## 値オブジェクト設計

### Schemaベースの値オブジェクト

```typescript
// 座標値オブジェクト
const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

// ヘルス値オブジェクト
const Health = Schema.Struct({
  current: Schema.Number,
  maximum: Schema.Number
})
```

## ドメインサービス

### Effect-TSサービスパターン

```typescript
const PlayerDomainService = Context.GenericTag<{
  readonly calculateDamage: (
    base: number,
    armor: number
  ) => Effect.Effect<number, never, never>
}>("PlayerDomainService")

const PlayerDomainServiceLive = PlayerDomainService.of({
  calculateDamage: (base, armor) =>
    Effect.succeed(Math.max(1, base - armor))
})
```

## 集約設計

### 集約ルート

```typescript
const PlayerAggregate = Schema.Struct({
  entity: PlayerEntity,
  inventory: InventoryEntity,
  events: Schema.Array(DomainEvent)
})
```

## 関連項目

- [戦略的設計](./02-ddd-strategic-design.md)
- [Effect-TSパターン](./06-effect-ts-patterns.md)
- [レイヤードアーキテクチャ](./04-layered-architecture.md)