---
title: "15 Sound Music System"
description: "15 Sound Music Systemに関する詳細な説明とガイド。"
category: "specification"
difficulty: "intermediate"
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: "15分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# Sound & Music System（サウンド・音楽システム）

## 概要

ゲーム内の音響効果とBGM管理システム。3D音響、環境音、効果音、音楽の動的再生を統合的に扱い、没入感の高いオーディオ体験を提供する。

## システム設計

### オーディオアーキテクチャ

#### 音響カテゴリ
- **効果音（SFX）**: ブロック破壊・足音・アイテム使用音
- **環境音（Ambient）**: 雨・風・洞窟音・バイオーム固有音
- **音楽（BGM）**: バイオーム別・時間別・状況別音楽
- **UI音**: ボタンクリック・メニュー操作音

#### 技術実装

```typescript
// サウンドイベントスキーマ
export const SoundEvent = Schema.Struct({
  soundId: Schema.String,
  category: Schema.Union(
    Schema.Literal("ambient"),
    Schema.Literal("block"),
    Schema.Literal("entity"),
    Schema.Literal("player"),
    Schema.Literal("music"),
    Schema.Literal("ui")
  ),
  position: Schema.optional(Position),
  volume: Schema.Number.pipe(Schema.min(0), Schema.max(1)),
  pitch: Schema.Number.pipe(Schema.min(0.5), Schema.max(2)),
  attenuation: Schema.optional(Schema.Number), // 距離減衰
  loop: Schema.Boolean.pipe(Schema.default(() => false)),
  fadeIn: Schema.optional(Schema.Number),
  fadeOut: Schema.optional(Schema.Number)
})

// SoundServiceエラー定義
export class SoundLoadError extends Schema.TaggedError("SoundLoadError")<{
  soundId: string
  message: string
  timestamp: number
}> {}

export class AudioContextError extends Schema.TaggedError("AudioContextError")<{
  message: string
  timestamp: number
}> {}

// 音響管理システム
export const SoundService = Context.GenericTag<{
  readonly playSound: (soundId: string, options?: Partial<typeof SoundEvent.Type>) =>
    Effect.Effect<AudioSource, SoundLoadError | AudioContextError>
  readonly playBlockSound: (blockType: string, action: "place" | "break", position: typeof Position.Type) =>
    Effect.Effect<void, SoundLoadError | AudioContextError>
  readonly playPlayerSound: (playerId: string, soundType: string) =>
    Effect.Effect<void, SoundLoadError | AudioContextError>
  readonly getCategoryVolume: (category: string) => number
}>("@app/SoundService")

// AudioSource型定義
const AudioSource = Schema.Struct({
  source: Schema.Any, // AudioBufferSourceNode
  stop: Schema.Function,
  fadeOut: Schema.Function
})
type AudioSource = typeof AudioSource.Type

// SoundService実装
const makeSoundService = Effect.gen(function* () {
  const audioContext = yield* AudioContext
  const soundLoader = yield* SoundLoader
  const spatialAudio = yield* SpatialAudioProcessor

  const getCategoryVolume = (category: string): number =>
    Match.value(category).pipe(
      Match.when("ambient", () => 0.7),
      Match.when("block", () => 0.8),
      Match.when("entity", () => 0.9),
      Match.when("player", () => 0.6),
      Match.when("music", () => 0.5),
      Match.when("ui", () => 1.0),
      Match.orElse(() => 0.5)
    )

  const playSound = (soundId: string, options?: Partial<typeof SoundEvent.Type>) =>
    Effect.gen(function* () {
      const soundEvent = {
        soundId,
        category: "block" as const,
        volume: 1.0,
        pitch: 1.0,
        loop: false,
        ...options
      }

      // サウンドファイル読み込み
      const audioBuffer = yield* soundLoader.loadSound(soundId)

      // AudioSource作成
      const source = audioContext.createBufferSource()
      source.buffer = audioBuffer

      // 3D音響処理の適用
      const processedSource = soundEvent.position
        ? yield* spatialAudio.applySpatialEffects(source, soundEvent.position)
        : Effect.succeed(source)

      // 音量・ピッチ設定
      const gainNode = audioContext.createGain()
      gainNode.gain.value = soundEvent.volume * getCategoryVolume(soundEvent.category)
      source.playbackRate.value = soundEvent.pitch

      // ルーティング
      source.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // フェードイン効果の適用
      yield* Option.fromNullable(soundEvent.fadeIn).pipe(
        Option.match({
          onNone: () => Effect.void,
          onSome: (fadeTime) => Effect.sync(() => {
            gainNode.gain.setValueAtTime(0, audioContext.currentTime)
            gainNode.gain.linearRampToValueAtTime(
              soundEvent.volume,
              audioContext.currentTime + fadeTime / 1000
            )
          })
        })
      )

      // 再生開始
      source.start()

      // ループ設定
      if (soundEvent.loop) {
        source.loop = true
      }

      return {
        source,
        stop: () => source.stop(),
        fadeOut: (duration: number) => {
          gainNode.gain.linearRampToValueAtTime(
            0,
            audioContext.currentTime + duration / 1000
          )
          setTimeout(() => source.stop(), duration)
        }
      }
    })

  const playBlockSound = (blockType: string, action: "place" | "break", position: typeof Position.Type) =>
    Effect.gen(function* () {
      const soundId = `block.${blockType}.${action}`
      yield* playSound(soundId, {
        category: "block",
        position,
        volume: 0.8,
        pitch: 0.8 + Math.random() * 0.4 // ピッチにランダム性を追加
      }).pipe(Effect.asVoid)
    })

  const playPlayerSound = (playerId: string, soundType: string) =>
    Effect.gen(function* () {
      const playerService = yield* PlayerService
      const player = yield* playerService.getPlayer(playerId)
      const soundId = `entity.player.${soundType}`

      yield* playSound(soundId, {
        category: "player",
        position: player.position,
        volume: 0.6
      }).pipe(Effect.asVoid)
    })

  return {
    playSound,
    playBlockSound,
    playPlayerSound,
    getCategoryVolume
  }
})

export const SoundServiceLive = Layer.effect(SoundService, makeSoundService)
```

### 3D音響処理システム

#### 空間音響機能
- **距離減衰**: 音源からの距離に応じた音量減少
- **方向性**: ステレオパンによる音源方向の表現
- **遮蔽効果**: 障害物による音の減衰・フィルタリング
- **残響**: 環境に応じたリバーブ効果

```typescript
// 空間音響プロセッサー
export const SpatialAudioProcessor = Context.GenericTag<{
  readonly applySpatialEffects: (source: AudioBufferSourceNode, soundPosition: typeof Position.Type) =>
    Effect.Effect<AudioBufferSourceNode | AudioNode, never>
  readonly applyOcclusionEffects: (source: AudioBufferSourceNode, listenerPos: typeof Position.Type, soundPos: typeof Position.Type) =>
    Effect.Effect<AudioBufferSourceNode | AudioNode, never>
}>("@app/SpatialAudioProcessor")

const makeSpatialAudioProcessor = Effect.gen(function* () {
  const audioContext = yield* AudioContext

  const applySpatialEffects = (source: AudioBufferSourceNode, soundPosition: typeof Position.Type) =>
    Effect.gen(function* () {
      const playerService = yield* PlayerService
      const player = yield* playerService.getCurrentPlayer()

      // 距離計算
      const distance = Vector3.distance(player.position, soundPosition)
      const maxHearingDistance = 16 // ブロック単位

      // 早期リターン: 聞こえない距離の場合
      if (distance > maxHearingDistance) {
        return source // 無音状態で返す
      }

      // 距離減衰計算
      const attenuationFactor = Math.max(0, 1 - distance / maxHearingDistance)

      // パンナー設定（3D音響）
      const panner = audioContext.createPanner()
      panner.panningModel = "HRTF"
      panner.distanceModel = "inverse"
      panner.refDistance = 1
      panner.maxDistance = maxHearingDistance
      panner.rolloffFactor = 1

      // 音源位置設定
      panner.setPosition(soundPosition.x, soundPosition.y, soundPosition.z)

      // リスナー位置・向き設定
      const listener = audioContext.listener
      listener.setPosition(player.position.x, player.position.y, player.position.z)

      const forward = Vector3.fromRotation(player.rotation)
      const up = Vector3.up()
      listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z)

      // 遮蔽効果処理
      const processedSource = yield* applyOcclusionEffects(source, player.position, soundPosition)

      // 音響チェーンに接続
      processedSource.connect(panner)
      return panner
    })

  const applyOcclusionEffects = (source: AudioBufferSourceNode, listenerPos: typeof Position.Type, soundPos: typeof Position.Type) =>
    Effect.gen(function* () {
      const physicsService = yield* PhysicsService
      const raycast = yield* physicsService.raycast(listenerPos, soundPos)

      return raycast.hit
        ? Effect.sync(() => {
            // 障害物がある場合のフィルタリング
            const lowPassFilter = audioContext.createBiquadFilter()
            lowPassFilter.type = "lowpass"
            lowPassFilter.frequency.value = 1000 // 高音をカット
            lowPassFilter.Q.value = 1

            const gainNode = audioContext.createGain()
            gainNode.gain.value = 0.3 // 音量減衰

            source.connect(lowPassFilter)
            lowPassFilter.connect(gainNode)
            return gainNode
          })
        : Effect.succeed(source)
    }).pipe(Effect.flatten)

  return {
    applySpatialEffects,
    applyOcclusionEffects
  }
})

export const SpatialAudioProcessorLive = Layer.effect(SpatialAudioProcessor, makeSpatialAudioProcessor)
```

### 動的音楽システム

#### 音楽制御メカニズム
- **バイオーム別BGM**: 現在のバイオームに応じた音楽選択
- **時間帯変化**: 朝・昼・夕・夜の音楽変化
- **状況対応**: 戦闘・建築・探索時の音楽切り替え
- **クロスフェード**: 音楽間のスムーズな移行

```typescript
// MusicContextスキーマ
export const MusicContext = Schema.Struct({
  biome: Schema.String,
  timeOfDay: Schema.Union(
    Schema.Literal("dawn"),
    Schema.Literal("day"),
    Schema.Literal("dusk"),
    Schema.Literal("night")
  ),
  playerState: Schema.Union(
    Schema.Literal("idle"),
    Schema.Literal("building"),
    Schema.Literal("combat"),
    Schema.Literal("exploring")
  ),
  weather: Schema.Union(
    Schema.Literal("clear"),
    Schema.Literal("rain"),
    Schema.Literal("thunderstorm"),
    Schema.Literal("snow")
  )
})

// 動的音楽マネージャー
export const MusicManager = Context.GenericTag<{
  readonly updateMusic: (context: typeof MusicContext.Type) => Effect.Effect<void, never>
  readonly selectMusicTrack: (context: typeof MusicContext.Type) => Effect.Effect<string, never>
  readonly crossFadeToTrack: (trackId: string) => Effect.Effect<void, SoundLoadError | AudioContextError>
  readonly setMusicVolume: (volume: number) => Effect.Effect<void, never>
}>("@app/MusicManager")

const makeMusicManager = Effect.gen(function* () {
  const soundService = yield* SoundService
  const currentTrackRef = yield* Ref.make<Option.Option<AudioSource>>(Option.none())
  const fadeTimeoutRef = yield* Ref.make<Option.Option<NodeJS.Timeout>>(Option.none())

  const getTimeMusicPrefix = (timeOfDay: string): string =>
    Match.value(timeOfDay).pipe(
      Match.when("dawn", () => "morning"),
      Match.when("day", () => "day"),
      Match.when("dusk", () => "evening"),
      Match.when("night", () => "night"),
      Match.orElse(() => "day")
    )

  const selectMusicTrack = (context: typeof MusicContext.Type) =>
    Effect.gen(function* () {
      const { biome, timeOfDay, playerState, weather } = context

      // Match.valueでパターンマッチングを使用
      return yield* Match.value(playerState).pipe(
        Match.when("combat", () => Effect.succeed("music.combat")),
        Match.orElse(() =>
          Match.value(biome).pipe(
            Match.when("nether", () => Effect.succeed("music.nether")),
            Match.when("end", () => Effect.succeed("music.end")),
            Match.orElse(() =>
              Match.value(weather).pipe(
                Match.when("thunderstorm", () => Effect.succeed("music.storm")),
                Match.orElse(() => {
                  const timePrefix = getTimeMusicPrefix(timeOfDay)
                  return Effect.succeed(`music.${biome}.${timePrefix}`)
                })
              )
            )
          )
        )
      )
    })

  const crossFadeToTrack = (trackId: string) =>
    Effect.gen(function* () {
      // 現在のトラックをフェードアウト
      const currentTrack = yield* Ref.get(currentTrackRef)
      yield* Option.match(currentTrack, {
        onNone: () => Effect.void,
        onSome: (track) => Effect.sync(() => {
          track.fadeOut(2000)
        })
      })

      // タイムアウトをクリア
      const fadeTimeout = yield* Ref.get(fadeTimeoutRef)
      yield* Option.match(fadeTimeout, {
        onNone: () => Effect.void,
        onSome: (timeout) => Effect.sync(() => clearTimeout(timeout))
      })

      // 新しいトラックをフェードイン
      yield* Effect.delay("1 seconds") // オーバーラップ時間

      const newTrack = yield* soundService.playSound(trackId, {
        category: "music",
        volume: 0.7,
        loop: true,
        fadeIn: 2000
      })
      yield* Ref.set(currentTrackRef, Option.some(newTrack))
    })

  const updateMusic = (context: typeof MusicContext.Type) =>
    Effect.gen(function* () {
      const newTrackId = yield* selectMusicTrack(context)
      const currentTrack = yield* Ref.get(currentTrackRef)

      const shouldUpdateMusic = yield* Option.match(currentTrack, {
        onNone: () => Effect.succeed(true),
        onSome: (track) => Effect.succeed(track.soundId !== newTrackId)
      })

      if (shouldUpdateMusic) {
        yield* crossFadeToTrack(newTrackId)
      }
    })

  const setMusicVolume = (volume: number) =>
    Effect.gen(function* () {
      const currentTrack = yield* Ref.get(currentTrackRef)
      yield* Option.match(currentTrack, {
        onNone: () => Effect.void,
        onSome: (track) => Effect.sync(() => {
          // 音量のスムーズな変化
          if (track.source && track.source.context) {
            const gainNode = track.source.context.createGain()
            gainNode.gain.linearRampToValueAtTime(
              volume,
              track.source.context.currentTime + 0.5
            )
          }
        })
      })
    })

  return {
    updateMusic,
    selectMusicTrack,
    crossFadeToTrack,
    setMusicVolume
  }
})

export const MusicManagerLive = Layer.effect(MusicManager, makeMusicManager)
```

### 環境音システム

#### アンビエント音響
- **バイオーム環境音**: 各バイオーム固有の背景音
- **天候音**: 雨・雪・雷の音響効果
- **時間環境音**: 夜の虫の音・朝の鳥のさえずり
- **構造物音**: 洞窟の反響・水の流れる音

```typescript
// EnvironmentContextスキーマ
export const EnvironmentContext = Schema.Struct({
  biome: Schema.String,
  weather: Schema.Union(
    Schema.Literal("clear"),
    Schema.Literal("rain"),
    Schema.Literal("thunderstorm"),
    Schema.Literal("snow")
  ),
  timeOfDay: Schema.Union(
    Schema.Literal("dawn"),
    Schema.Literal("day"),
    Schema.Literal("dusk"),
    Schema.Literal("night")
  ),
  underground: Schema.Boolean
})

// 環境音マネージャー
export const AmbientSoundManager = Context.GenericTag<{
  readonly updateAmbientSounds: (context: typeof EnvironmentContext.Type) => Effect.Effect<void, SoundLoadError | AudioContextError>
  readonly determineAmbientSounds: (context: typeof EnvironmentContext.Type) => Effect.Effect<ReadonlyArray<string>, never>
}>("@app/AmbientSoundManager")

const makeAmbientSoundManager = Effect.gen(function* () {
  const soundService = yield* SoundService
  const activeAmbientsRef = yield* Ref.make<Map<string, AudioSource>>(new Map())

  const determineAmbientSounds = (context: typeof EnvironmentContext.Type) =>
    Effect.gen(function* () {
      const sounds: string[] = []

      // バイオーム環境音
      sounds.push(`ambient.${context.biome}`)

      // 天候音のMatch.valueパターンマッチング
      const weatherSounds = Match.value(context.weather).pipe(
        Match.when("rain", () => ["ambient.weather.rain"]),
        Match.when("thunderstorm", () => ["ambient.weather.rain", "ambient.weather.thunder"]),
        Match.when("snow", () => ["ambient.weather.snow"]),
        Match.orElse(() => [])
      )
      sounds.push(...weatherSounds)

      // 時間帯音
      if (context.timeOfDay === "night") {
        sounds.push("ambient.night")
      }

      // 地下音
      if (context.underground) {
        sounds.push("ambient.cave")
      }

      return sounds
    })

  const updateAmbientSounds = (context: typeof EnvironmentContext.Type) =>
    Effect.gen(function* () {
      const requiredAmbients = yield* determineAmbientSounds(context)
      const activeAmbients = yield* Ref.get(activeAmbientsRef)

      // 不要な環境音を停止（関数型アプローチ）
      const stopUnneededAmbients = Effect.gen(function* () {
        for (const [id, source] of activeAmbients) {
          if (!requiredAmbients.includes(id)) {
            yield* Effect.sync(() => source.fadeOut(3000))
            activeAmbients.delete(id)
          }
        }
      })

      // 新しい環境音を開始（関数型アプローチ）
      const startNewAmbients = Effect.gen(function* () {
        for (const ambientId of requiredAmbients) {
          if (!activeAmbients.has(ambientId)) {
            const source = yield* soundService.playSound(ambientId, {
              category: "ambient",
              volume: 0.4,
              loop: true,
              fadeIn: 3000
            })
            activeAmbients.set(ambientId, source)
          }
        }
      })

      yield* stopUnneededAmbients
      yield* startNewAmbients
      yield* Ref.set(activeAmbientsRef, activeAmbients)
    })

  return {
    updateAmbientSounds,
    determineAmbientSounds
  }
})

export const AmbientSoundManagerLive = Layer.effect(AmbientSoundManager, makeAmbientSoundManager)
```

## オーディオ設定・最適化

### パフォーマンス最適化
- **音源プール**: AudioBufferSourceNodeの再利用
- **距離カリング**: 聞こえない距離の音源除外
- **音声圧縮**: OGG Vorbis形式での効率的配信
- **ストリーミング**: 大きな音楽ファイルの分割ロード

### ユーザー設定
```typescript
// オーディオ設定
export const AudioSettings = Schema.Struct({
  masterVolume: Schema.Number.pipe(Schema.min(0), Schema.max(1)),
  musicVolume: Schema.Number.pipe(Schema.min(0), Schema.max(1)),
  effectsVolume: Schema.Number.pipe(Schema.min(0), Schema.max(1)),
  ambientVolume: Schema.Number.pipe(Schema.min(0), Schema.max(1)),
  uiVolume: Schema.Number.pipe(Schema.min(0), Schema.max(1)),
  spatialAudio: Schema.Boolean,
  subtitles: Schema.Boolean
})
```

## テストケース

### 基本音響機能
- [ ] 各カテゴリの音声再生
- [ ] 音量・ピッチ制御
- [ ] 3D音響の距離減衰
- [ ] 方向性の正確性

### 動的システム
- [ ] バイオーム変更時の音楽切り替え
- [ ] 天候変化時の環境音更新
- [ ] 戦闘開始・終了時の音楽変化
- [ ] クロスフェード効果

### パフォーマンス
- [ ] 大量音源の同時再生
- [ ] メモリ使用量の監視
- [ ] CPU負荷の測定
- [ ] 音声遅延の検証

## 今後の拡張

### プランされた機能
- **カスタム音楽**: プレイヤーのBGM追加機能
- **音声チャット**: マルチプレイヤーでのボイス通信
- **レコードシステム**: ジュークボックスでの音楽再生
- **サウンドパック**: コミュニティ作成の音響セット
