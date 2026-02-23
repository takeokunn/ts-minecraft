---
title: '21 Bed Sleep System'
description: '21 Bed Sleep Systemに関する詳細な説明とガイド。'
category: 'specification'
difficulty: 'intermediate'
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: '5分'
---

# Bed & Sleep System（睡眠・時間システム）

## 概要

Bed & Sleep Systemは、プレイヤーがベッドで寝ることで夜をスキップし、リスポーン地点を設定する機能を提供します。Day/Night Cycleと連携し、ゲームの進行をスムーズにします。

## システム設計

### 1. ベッド (Bed)

#### 1.1 機能

- **設置**: 2ブロックのスペースが必要
- **リスポーン地点設定**: ベッドを右クリックすると、そのプレイヤーのリスポーン地点が設定される
- **睡眠**: 夜間または雷雨時にのみ寝ることができる

```typescript
// BedBlockスキーマ
export const BedBlock = Schema.Struct({
  id: Schema.String.pipe(Schema.startsWith('minecraft:'), Schema.endsWith('_bed')),
  position: Position,
  part: Schema.Literal('head', 'foot'),
  occupied: Schema.Boolean,
})

// リスポーン地点設定ロジック
export const setRespawnPoint = (playerId: PlayerId, bedPosition: Position): Effect.Effect<void, WorldError> =>
  Effect.gen(function* () {
    const player = yield* PlayerService.getPlayer(playerId)
    // ベッドの有効性を検証
    const isValidBed = yield* WorldService.isValidBed(bedPosition)
    if (isValidBed) {
      yield* PlayerService.setRespawn(playerId, bedPosition)
      yield* ChatService.sendMessage(playerId, 'Respawn point set')
    } else {
      yield* ChatService.sendMessage(playerId, 'Bed is obstructed')
    }
  })
```

### 2. 睡眠 (Sleep)

#### 2.1 機能

- **時間スキップ**: サーバー内の全プレイヤーが寝ると、時間が朝までスキップされる
- **条件**:
  - 夜（13000ティック以降）または雷雨時であること
  - 近くに敵対的なMobがいないこと
  - ネザーやエンドディメンションではベッドは爆発する

```typescript
// 睡眠管理サービス
export interface SleepService {
  readonly trySleep: (playerId: PlayerId, bedPosition: Position) => Effect.Effect<void, SleepError>
  readonly update: () => Effect.Effect<void, never>
}

export const SleepService = Context.GenericTag<SleepService>('@app/SleepService')

export const SleepServiceLive = Layer.effect(
  SleepService,
  Effect.gen(function* () {
    const sleepingPlayers = yield* Ref.make(new Set<PlayerId>())

    return {
      trySleep: (playerId, bedPosition) =>
        Effect.gen(function* () {
          // 睡眠条件のチェック
          const canSleep = yield* checkSleepConditions(playerId, bedPosition)
          if (!canSleep) {
            return yield* Effect.fail(new SleepError('Cannot sleep now'))
          }
          yield* Ref.update(sleepingPlayers, (set) => set.add(playerId))
          yield* PlayerService.setSleeping(playerId, true)
        }),
      update: () =>
        Effect.gen(function* () {
          const onlinePlayers = yield* PlayerService.getOnlinePlayers()
          const sleeping = yield* Ref.get(sleepingPlayers)

          // 全員が寝ているかチェック
          if (onlinePlayers.every((p) => sleeping.has(p.id))) {
            yield* TimeService.setTime(1000) // 朝にする
            // 寝ているプレイヤーを起こす
            for (const playerId of sleeping) {
              yield* PlayerService.setSleeping(playerId, false)
            }
            yield* Ref.set(sleepingPlayers, new Set())
          }
        }),
    }
  })
)
```

## UI統合

- **チャットメッセージ**:
  - 「Respawn point set」: リスポーン地点設定時
  - 「You can only sleep at night or during thunderstorms」: 寝られない時
  - 「You may not rest now, there are monsters nearby」: 近くに敵がいる時
- **画面効果**: 寝ている間、画面がフェードアウトし、朝になるとフェードインする

## テストケース

- [ ] ベッドを右クリックしてリスポーン地点が設定されること
- [ ] 夜にベッドで寝られること
- [ ] 昼間はベッドで寝られないこと
- [ ] 近くに敵がいると寝られないこと
- [ ] 全員が寝ると時間が朝になること
- [ ] ネザーでベッドを使用すると爆発すること
