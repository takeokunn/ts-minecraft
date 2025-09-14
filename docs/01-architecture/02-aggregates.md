---
title: "集約設計 - DDDアグリゲートパターン"
description: "DDD集約の設計原則とEffect-TS 3.17+実装。不変条件の維持、一貫性境界、ドメインイベント管理。"
category: "architecture"
difficulty: "advanced"
tags: ["ddd", "aggregates", "effect-ts", "domain-modeling", "consistency", "invariants"]
prerequisites: ["ddd-fundamentals", "effect-ts-basics", "tactical-design"]
estimated_reading_time: "25分"
dependencies: ["./01-tactical-design.md", "./02-ddd-strategic-design.md"]
status: "complete"
---

# Aggregates Design

> **集約設計**: DDDの集約パターンとEffect-TS実装

## 概要

ドメイン駆動設計における集約の設計原則とEffect-TSでの実装方法について解説します。

## 集約の基本原則

### 不変条件の維持

```typescript
import { Schema } from "@effect/schema"
import { Effect } from "effect"

// Player集約
const PlayerAggregate = Schema.Struct({
  id: Schema.String,
  health: Schema.Number.pipe(
    Schema.filter(h => h >= 0 && h <= 100, {
      message: () => "Health must be between 0 and 100"
    })
  ),
  position: Position,
  inventory: InventoryAggregate
})
```

### 境界の定義

```typescript
// 集約境界内での操作
const movePlayer = (
  aggregate: PlayerAggregate,
  newPosition: Position
) => Effect.gen(function* () {
  // ビジネスルールの検証
  const isValidPosition = yield* validatePosition(newPosition)

  if (!isValidPosition) {
    return yield* Effect.fail(new InvalidPositionError())
  }

  // 不変条件を保持した更新
  return {
    ...aggregate,
    position: newPosition
  }
})
```

## 集約間の関係

### 参照による結合

```typescript
// 他の集約への参照はIDのみ
const WorldChunk = Schema.Struct({
  id: Schema.String,
  playerId: Schema.String, // Player集約への参照
  blocks: Schema.Array(BlockEntity)
})
```

### イベント駆動通信

```typescript
// ドメインイベントによる集約間通信
const PlayerMovedEvent = Schema.TaggedStruct("PlayerMoved", {
  playerId: Schema.String,
  fromPosition: Position,
  toPosition: Position,
  timestamp: Schema.Date
})
```

## 集約の永続化

### リポジトリパターン

```typescript
const PlayerRepository = Context.GenericTag<{
  readonly save: (
    aggregate: PlayerAggregate
  ) => Effect.Effect<void, DatabaseError, never>

  readonly findById: (
    id: string
  ) => Effect.Effect<Option.Option<PlayerAggregate>, DatabaseError, never>
}>("PlayerRepository")
```

## 関連項目

- [戦術設計](./01-tactical-design.md)
- [戦略的設計](./02-ddd-strategic-design.md)
- [レイヤードアーキテクチャ](./04-layered-architecture.md)