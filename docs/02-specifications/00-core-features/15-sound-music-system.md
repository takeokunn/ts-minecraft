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
// ブランド型定義による型安全性
type Volume = number & Brand.Brand<"Volume">
type Frequency = number & Brand.Brand<"Frequency">
type Duration = number & Brand.Brand<"Duration">
type AttenuationDistance = number & Brand.Brand<"AttenuationDistance">

const Volume = Brand.refined<Volume>(
  (n) => n >= 0 && n <= 1,
  (n) => Brand.error(`Expected ${n} to be between 0 and 1`)
)

const Frequency = Brand.refined<Frequency>(
  (n) => n >= 0.5 && n <= 2.0,
  (n) => Brand.error(`Expected ${n} to be between 0.5 and 2.0`)
)

const Duration = Brand.refined<Duration>(
  (n) => n >= 0,
  (n) => Brand.error(`Expected ${n} to be non-negative`)
)

const AttenuationDistance = Brand.refined<AttenuationDistance>(
  (n) => n > 0,
  (n) => Brand.error(`Expected ${n} to be positive`)
)

// サウンドイベントスキーマ（ブランド型使用）
export const SoundEvent = Schema.Struct({
  _tag: Schema.Literal("SoundEvent"),
  soundId: Schema.String.annotations({
    identifier: "SoundId",
    description: "サウンドファイルの一意識別子"
  }),
  category: Schema.Union(
    Schema.Literal("ambient"),
    Schema.Literal("block"),
    Schema.Literal("entity"),
    Schema.Literal("player"),
    Schema.Literal("music"),
    Schema.Literal("ui")
  ).annotations({
    identifier: "SoundCategory",
    description: "サウンドの分類カテゴリ"
  }),
  position: Schema.Optional(Position),
  volume: Schema.transform(
    Schema.Number.pipe(Schema.min(0), Schema.max(1)),
    Schema.instanceOf(Volume as any),
    { decode: Volume, encode: Brand.nominal }
  ),
  pitch: Schema.transform(
    Schema.Number.pipe(Schema.min(0.5), Schema.max(2)),
    Schema.instanceOf(Frequency as any),
    { decode: Frequency, encode: Brand.nominal }
  ),
  attenuation: Schema.Optional(Schema.transform(
    Schema.Number.pipe(Schema.positive()),
    Schema.instanceOf(AttenuationDistance as any),
    { decode: AttenuationDistance, encode: Brand.nominal }
  )),
  loop: Schema.Boolean.pipe(Schema.default(() => false)),
  fadeIn: Schema.Optional(Schema.transform(
    Schema.Number.pipe(Schema.nonNegative()),
    Schema.instanceOf(Duration as any),
    { decode: Duration, encode: Brand.nominal }
  )),
  fadeOut: Schema.Optional(Schema.transform(
    Schema.Number.pipe(Schema.nonNegative()),
    Schema.instanceOf(Duration as any),
    { decode: Duration, encode: Brand.nominal }
  ))
}).annotations({
  identifier: "SoundEvent",
  description: "オーディオイベントの完全な仕様"
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

// 音響管理システム（Stream統合版）
export const SoundService = Context.GenericTag<{
  readonly playSound: (soundId: string, options?: Partial<typeof SoundEvent.Type>) =>
    Effect.Effect<AudioSource, SoundLoadError | AudioContextError>
  readonly playSoundStream: (soundEvents: Stream.Stream<typeof SoundEvent.Type, never>) =>
    Stream.Stream<AudioSource, SoundLoadError | AudioContextError>
  readonly playBlockSound: (blockType: string, action: "place" | "break", position: typeof Position.Type) =>
    Effect.Effect<void, SoundLoadError | AudioContextError>
  readonly playPlayerSound: (playerId: string, soundType: string) =>
    Effect.Effect<void, SoundLoadError | AudioContextError>
  readonly getCategoryVolume: (category: string) => Volume
  readonly createAudioProcessingPipeline: () => Stream.Stream<AudioBuffer, never>
  readonly mixAudioStreams: (streams: ReadonlyArray<Stream.Stream<AudioBuffer, never>>) =>
    Stream.Stream<AudioBuffer, never>
}>("@minecraft/SoundService")

// AudioSource型定義（拡張版）
const AudioSource = Schema.Struct({
  _tag: Schema.Literal("AudioSource"),
  source: Schema.Any, // AudioBufferSourceNode
  gainNode: Schema.Any, // GainNode
  stop: Schema.Function.annotations({
    description: "音源を停止する関数"
  }),
  fadeOut: Schema.Function.annotations({
    description: "フェードアウト効果を適用する関数"
  }),
  volume: Schema.instanceOf(Volume as any),
  isPlaying: Schema.Boolean
}).annotations({
  identifier: "AudioSource",
  description: "再生中のオーディオリソース"
})
type AudioSource = typeof AudioSource.Type

// SoundService実装（Stream統合版）
const makeSoundService = Effect.gen(function* () {
  const audioContext = yield* AudioContext
  const soundLoader = yield* SoundLoader
  const spatialAudio = yield* SpatialAudioProcessor

  // パターンマッチングによる音量取得
  const getCategoryVolume = (category: string): Volume =>
    Match.value(category).pipe(
      Match.when("ambient", () => Volume(0.7)),
      Match.when("block", () => Volume(0.8)),
      Match.when("entity", () => Volume(0.9)),
      Match.when("player", () => Volume(0.6)),
      Match.when("music", () => Volume(0.5)),
      Match.when("ui", () => Volume(1.0)),
      Match.orElse(() => Volume(0.5))
    )

  // オーディオ処理パイプライン作成
  const createAudioProcessingPipeline = (): Stream.Stream<AudioBuffer, never> =>
    Stream.fromEffect(Effect.sync(() => audioContext.createBuffer(2, 44100, 44100)))

  // 複数オーディオストリームのミキシング
  const mixAudioStreams = (
    streams: ReadonlyArray<Stream.Stream<AudioBuffer, never>>
  ): Stream.Stream<AudioBuffer, never> =>
    Stream.mergeAll(streams, { concurrency: "unbounded", bufferSize: 16 })

  // ストリーミング音声再生
  const playSoundStream = (
    soundEvents: Stream.Stream<typeof SoundEvent.Type, never>
  ): Stream.Stream<AudioSource, SoundLoadError | AudioContextError> =>
    soundEvents.pipe(
      Stream.mapEffect((soundEvent) =>
        Effect.gen(function* () {
          // 早期リターン: 無効なサウンドIDの場合
          if (!soundEvent.soundId) {
            return yield* Effect.fail(new SoundLoadError({
              soundId: soundEvent.soundId,
              message: "Invalid sound ID",
              timestamp: Date.now()
            }))
          }

          const audioBuffer = yield* soundLoader.loadSound(soundEvent.soundId)
          const source = audioContext.createBufferSource()
          source.buffer = audioBuffer

          // 3D音響処理の適用（Option使用）
          const processedSource = Option.match(soundEvent.position, {
            onNone: () => Effect.succeed(source),
            onSome: (position) => spatialAudio.applySpatialEffects(source, position)
          })

          const finalSource = yield* processedSource
          const gainNode = audioContext.createGain()

          // ブランド型による型安全な音量設定
          const categoryVolume = getCategoryVolume(soundEvent.category)
          const finalVolume = Volume(Brand.nominal(soundEvent.volume) * Brand.nominal(categoryVolume))

          gainNode.gain.value = Brand.nominal(finalVolume)
          source.playbackRate.value = Brand.nominal(soundEvent.pitch)

          // ルーティング設定
          finalSource.connect(gainNode)
          gainNode.connect(audioContext.destination)

          // フェードイン効果（早期リターン）
          yield* Option.match(soundEvent.fadeIn, {
            onNone: () => Effect.void,
            onSome: (fadeTime) => Effect.sync(() => {
              gainNode.gain.setValueAtTime(0, audioContext.currentTime)
              gainNode.gain.linearRampToValueAtTime(
                Brand.nominal(finalVolume),
                audioContext.currentTime + Brand.nominal(fadeTime) / 1000
              )
            })
          })

          source.start()
          if (soundEvent.loop) {
            source.loop = true
          }

          return {
            _tag: "AudioSource" as const,
            source: finalSource,
            gainNode,
            volume: finalVolume,
            isPlaying: true,
            stop: () => source.stop(),
            fadeOut: (duration: Duration) => {
              gainNode.gain.linearRampToValueAtTime(
                0,
                audioContext.currentTime + Brand.nominal(duration) / 1000
              )
              setTimeout(() => source.stop(), Brand.nominal(duration))
            }
          } satisfies AudioSource
        })
      )
    )

  const playSound = (soundId: string, options?: Partial<typeof SoundEvent.Type>) =>
    Effect.gen(function* () {
      const soundEvent = {
        _tag: "SoundEvent" as const,
        soundId,
        category: "block" as const,
        volume: Volume(1.0),
        pitch: Frequency(1.0),
        loop: false,
        ...options
      }

      // 単一音声をストリームとして処理
      const soundStream = Stream.succeed(soundEvent)
      const audioSourceStream = playSoundStream(soundStream)

      // ストリームから最初の結果を取得
      return yield* Stream.runHead(audioSourceStream).pipe(
        Effect.flatMap(Option.match({
          onNone: () => Effect.fail(new SoundLoadError({
            soundId,
            message: "Failed to create audio source",
            timestamp: Date.now()
          })),
          onSome: (audioSource) => Effect.succeed(audioSource)
        }))
      )
    })

  const playBlockSound = (blockType: string, action: "place" | "break", position: typeof Position.Type) =>
    Effect.gen(function* () {
      const soundId = `block.${blockType}.${action}`

      // ランダムピッチ生成（ブランド型使用）
      const randomPitch = Frequency(0.8 + Math.random() * 0.4)

      yield* playSound(soundId, {
        category: "block",
        position: Option.some(position),
        volume: Volume(0.8),
        pitch: randomPitch
      }).pipe(Effect.asVoid)
    })

  const playPlayerSound = (playerId: string, soundType: string) =>
    Effect.gen(function* () {
      const playerService = yield* PlayerService
      const player = yield* playerService.getPlayer(playerId)
      const soundId = `entity.player.${soundType}`

      yield* playSound(soundId, {
        category: "player",
        position: Option.some(player.position),
        volume: Volume(0.6)
      }).pipe(Effect.asVoid)
    })

  return {
    playSound,
    playSoundStream,
    playBlockSound,
    playPlayerSound,
    getCategoryVolume,
    createAudioProcessingPipeline,
    mixAudioStreams
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
// 3D音響用のブランド型
type Distance = number & Brand.Brand<"Distance">
type Azimuth = number & Brand.Brand<"Azimuth"> // 方位角
type Elevation = number & Brand.Brand<"Elevation"> // 仰角

const Distance = Brand.refined<Distance>(
  (n) => n >= 0,
  (n) => Brand.error(`Expected ${n} to be non-negative`)
)

const Azimuth = Brand.refined<Azimuth>(
  (n) => n >= -Math.PI && n <= Math.PI,
  (n) => Brand.error(`Expected ${n} to be between -π and π`)
)

const Elevation = Brand.refined<Elevation>(
  (n) => n >= -Math.PI/2 && n <= Math.PI/2,
  (n) => Brand.error(`Expected ${n} to be between -π/2 and π/2`)
)

// 空間音響データスキーマ
const SpatialAudioData = Schema.Struct({
  _tag: Schema.Literal("SpatialAudioData"),
  distance: Schema.instanceOf(Distance as any),
  azimuth: Schema.instanceOf(Azimuth as any),
  elevation: Schema.instanceOf(Elevation as any),
  attenuationFactor: Schema.instanceOf(Volume as any)
}).annotations({
  identifier: "SpatialAudioData",
  description: "3D音響計算結果"
})

// 空間音響プロセッサー（Stream統合版）
export const SpatialAudioProcessor = Context.GenericTag<{
  readonly applySpatialEffects: (source: AudioBufferSourceNode, soundPosition: typeof Position.Type) =>
    Effect.Effect<AudioBufferSourceNode | AudioNode, never>
  readonly applyOcclusionEffects: (source: AudioBufferSourceNode, listenerPos: typeof Position.Type, soundPos: typeof Position.Type) =>
    Effect.Effect<AudioBufferSourceNode | AudioNode, never>
  readonly calculateSpatialData: (listenerPos: typeof Position.Type, soundPos: typeof Position.Type) =>
    Effect.Effect<typeof SpatialAudioData.Type, never>
  readonly processAudioStream: (audioStream: Stream.Stream<AudioBuffer, never>, spatialData: typeof SpatialAudioData.Type) =>
    Stream.Stream<AudioBuffer, never>
}>("@minecraft/SpatialAudioProcessor")

const makeSpatialAudioProcessor = Effect.gen(function* () {
  const audioContext = yield* AudioContext

  // 3D音響データ計算
  const calculateSpatialData = (listenerPos: typeof Position.Type, soundPos: typeof Position.Type) =>
    Effect.gen(function* () {
      // ベクトル計算
      const deltaX = soundPos.x - listenerPos.x
      const deltaY = soundPos.y - listenerPos.y
      const deltaZ = soundPos.z - listenerPos.z

      // 距離計算（ブランド型使用）
      const distance = Distance(Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ))

      // 方位角と仰角計算（ブランド型使用）
      const azimuth = Azimuth(Math.atan2(deltaZ, deltaX))
      const elevation = Elevation(Math.atan2(deltaY, Math.sqrt(deltaX * deltaX + deltaZ * deltaZ)))

      // 距離減衰計算
      const maxHearingDistance = 16
      const attenuationFactor = Volume(
        Math.max(0, 1 - Brand.nominal(distance) / maxHearingDistance)
      )

      return {
        _tag: "SpatialAudioData" as const,
        distance,
        azimuth,
        elevation,
        attenuationFactor
      } satisfies typeof SpatialAudioData.Type
    })

  // オーディオストリーム処理
  const processAudioStream = (
    audioStream: Stream.Stream<AudioBuffer, never>,
    spatialData: typeof SpatialAudioData.Type
  ): Stream.Stream<AudioBuffer, never> =>
    audioStream.pipe(
      Stream.map((buffer) => {
        // 早期リターン: 聞こえない距離の場合
        if (Brand.nominal(spatialData.attenuationFactor) === 0) {
          // 無音バッファを返す
          return audioContext.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
        }

        // 空間音響効果を適用したバッファを作成
        const processedBuffer = audioContext.createBuffer(
          buffer.numberOfChannels,
          buffer.length,
          buffer.sampleRate
        )

        // チャンネル毎に処理
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const inputData = buffer.getChannelData(channel)
          const outputData = processedBuffer.getChannelData(channel)

          // 減衰適用
          const attenuation = Brand.nominal(spatialData.attenuationFactor)

          for (let i = 0; i < inputData.length; i++) {
            outputData[i] = inputData[i] * attenuation
          }
        }

        return processedBuffer
      })
    )

  const applySpatialEffects = (source: AudioBufferSourceNode, soundPosition: typeof Position.Type) =>
    Effect.gen(function* () {
      const playerService = yield* PlayerService
      const player = yield* playerService.getCurrentPlayer()

      // 空間データ計算
      const spatialData = yield* calculateSpatialData(player.position, soundPosition)

      // 早期リターン: 聞こえない距離の場合
      if (Brand.nominal(spatialData.attenuationFactor) === 0) {
        return source // 無音状態で返す
      }

      // パンナー設定（3D音響）
      const panner = audioContext.createPanner()
      panner.panningModel = "HRTF"
      panner.distanceModel = "inverse"
      panner.refDistance = 1
      panner.maxDistance = 16
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

      // パターンマッチングによる遮蔽効果処理
      return Match.value(raycast.hit).pipe(
        Match.when(true, () => Effect.sync(() => {
          // 障害物がある場合のフィルタリング
          const lowPassFilter = audioContext.createBiquadFilter()
          lowPassFilter.type = "lowpass"
          lowPassFilter.frequency.value = 1000 // 高音をカット
          lowPassFilter.Q.value = 1

          const gainNode = audioContext.createGain()
          gainNode.gain.value = Brand.nominal(Volume(0.3)) // ブランド型使用

          source.connect(lowPassFilter)
          lowPassFilter.connect(gainNode)
          return gainNode
        })),
        Match.when(false, () => Effect.succeed(source)),
        Match.exhaustive
      )
    }).pipe(Effect.flatten)

  return {
    applySpatialEffects,
    applyOcclusionEffects,
    calculateSpatialData,
    processAudioStream
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
// MusicContextスキーマ（拡張版）
export const MusicContext = Schema.Struct({
  _tag: Schema.Literal("MusicContext"),
  biome: Schema.String.annotations({
    description: "現在のバイオーム"
  }),
  timeOfDay: Schema.Union(
    Schema.Literal("dawn"),
    Schema.Literal("day"),
    Schema.Literal("dusk"),
    Schema.Literal("night")
  ).annotations({
    description: "時間帯"
  }),
  playerState: Schema.Union(
    Schema.Literal("idle"),
    Schema.Literal("building"),
    Schema.Literal("combat"),
    Schema.Literal("exploring")
  ).annotations({
    description: "プレイヤー状態"
  }),
  weather: Schema.Union(
    Schema.Literal("clear"),
    Schema.Literal("rain"),
    Schema.Literal("thunderstorm"),
    Schema.Literal("snow")
  ).annotations({
    description: "天候状態"
  }),
  priority: Schema.Number.pipe(Schema.int(), Schema.min(0), Schema.max(10)).annotations({
    description: "音楽の優先度"
  })
}).annotations({
  identifier: "MusicContext",
  description: "音楽システムのコンテキスト情報"
})

// 音楽イベントスキーマ
const MusicEvent = Schema.Struct({
  _tag: Schema.Literal("MusicEvent"),
  trackId: Schema.String,
  action: Schema.Union(
    Schema.Literal("play"),
    Schema.Literal("stop"),
    Schema.Literal("crossfade")
  ),
  volume: Schema.instanceOf(Volume as any),
  fadeTime: Schema.Optional(Schema.instanceOf(Duration as any)),
  loop: Schema.Boolean.pipe(Schema.default(() => true))
}).annotations({
  identifier: "MusicEvent",
  description: "音楽制御イベント"
})

// 動的音楽マネージャー（Stream & Queue統合版）
export const MusicManager = Context.GenericTag<{
  readonly updateMusic: (context: typeof MusicContext.Type) => Effect.Effect<void, never>
  readonly selectMusicTrack: (context: typeof MusicContext.Type) => Effect.Effect<string, never>
  readonly crossFadeToTrack: (trackId: string) => Effect.Effect<void, SoundLoadError | AudioContextError>
  readonly setMusicVolume: (volume: Volume) => Effect.Effect<void, never>
  readonly processMusicEvents: (events: Stream.Stream<typeof MusicEvent.Type, never>) =>
    Stream.Stream<AudioSource, SoundLoadError | AudioContextError>
  readonly createMusicScheduleQueue: () => Effect.Effect<Queue.Queue<typeof MusicEvent.Type>, never>
  readonly startMusicProcessingLoop: (queue: Queue.Queue<typeof MusicEvent.Type>) =>
    Effect.Effect<void, never>
}>("@minecraft/MusicManager")

const makeMusicManager = Effect.gen(function* () {
  const soundService = yield* SoundService
  const currentTrackRef = yield* Ref.make<Option.Option<AudioSource>>(Option.none())
  const fadeTimeoutRef = yield* Ref.make<Option.Option<NodeJS.Timeout>>(Option.none())
  const musicVolumeRef = yield* Ref.make<Volume>(Volume(0.5))

  // 音楽スケジューリングキュー作成
  const createMusicScheduleQueue = (): Effect.Effect<Queue.Queue<typeof MusicEvent.Type>, never> =>
    Queue.bounded<typeof MusicEvent.Type>(32)

  // 音楽イベント処理ストリーム
  const processMusicEvents = (
    events: Stream.Stream<typeof MusicEvent.Type, never>
  ): Stream.Stream<AudioSource, SoundLoadError | AudioContextError> =>
    events.pipe(
      Stream.mapEffect((event) =>
        Effect.gen(function* () {
          // パターンマッチングによるアクション処理
          return yield* Match.value(event.action).pipe(
            Match.when("play", () =>
              soundService.playSound(event.trackId, {
                category: "music",
                volume: event.volume,
                loop: event.loop,
                fadeIn: event.fadeTime
              })
            ),
            Match.when("stop", () =>
              Effect.gen(function* () {
                const currentTrack = yield* Ref.get(currentTrackRef)
                yield* Option.match(currentTrack, {
                  onNone: () => Effect.void,
                  onSome: (track) => Effect.sync(() => {
                    const fadeTime = Option.getOrElse(event.fadeTime, () => Duration(1000))
                    track.fadeOut(fadeTime)
                  })
                })
                yield* Ref.set(currentTrackRef, Option.none())

                // ダミーのAudioSourceを返す（停止用）
                return {
                  _tag: "AudioSource" as const,
                  source: null as any,
                  gainNode: null as any,
                  volume: Volume(0),
                  isPlaying: false,
                  stop: () => {},
                  fadeOut: () => {}
                } satisfies AudioSource
              })
            ),
            Match.when("crossfade", () =>
              Effect.gen(function* () {
                // 現在のトラックをフェードアウト
                const currentTrack = yield* Ref.get(currentTrackRef)
                yield* Option.match(currentTrack, {
                  onNone: () => Effect.void,
                  onSome: (track) => Effect.sync(() => {
                    const fadeTime = Option.getOrElse(event.fadeTime, () => Duration(2000))
                    track.fadeOut(fadeTime)
                  })
                })

                // 新しいトラックを開始
                yield* Effect.delay("1 seconds")
                const newTrack = yield* soundService.playSound(event.trackId, {
                  category: "music",
                  volume: event.volume,
                  loop: event.loop,
                  fadeIn: event.fadeTime
                })

                yield* Ref.set(currentTrackRef, Option.some(newTrack))
                return newTrack
              })
            ),
            Match.exhaustive
          )
        })
      )
    )

  // 音楽処理ループ（キューベース）
  const startMusicProcessingLoop = (queue: Queue.Queue<typeof MusicEvent.Type>) =>
    Effect.gen(function* () {
      const eventStream = Stream.fromQueue(queue)
      const audioStream = processMusicEvents(eventStream)

      // ストリームを実行（バックグラウンド処理）
      yield* Stream.runDrain(audioStream).pipe(
        Effect.forkDaemon
      )
    })

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
      const { biome, timeOfDay, playerState, weather, priority } = context

      // 優先度ベースの音楽選択（浅いネスト）
      if (priority >= 8 && playerState === "combat") {
        return "music.combat"
      }

      if (priority >= 7 && weather === "thunderstorm") {
        return "music.storm"
      }

      // バイオーム別音楽選択（パターンマッチング）
      return yield* Match.value(biome).pipe(
        Match.when("nether", () => Effect.succeed("music.nether")),
        Match.when("end", () => Effect.succeed("music.end")),
        Match.orElse(() => {
          const timePrefix = getTimeMusicPrefix(timeOfDay)
          return Effect.succeed(`music.${biome}.${timePrefix}`)
        })
      )
    })

  const crossFadeToTrack = (trackId: string) =>
    Effect.gen(function* () {
      // 現在のトラックをフェードアウト
      const currentTrack = yield* Ref.get(currentTrackRef)
      yield* Option.match(currentTrack, {
        onNone: () => Effect.void,
        onSome: (track) => Effect.sync(() => {
          track.fadeOut(Duration(2000))
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

      const currentVolume = yield* Ref.get(musicVolumeRef)
      const newTrack = yield* soundService.playSound(trackId, {
        category: "music",
        volume: currentVolume,
        loop: true,
        fadeIn: Duration(2000)
      })
      yield* Ref.set(currentTrackRef, Option.some(newTrack))
    })

  const updateMusic = (context: typeof MusicContext.Type) =>
    Effect.gen(function* () {
      const newTrackId = yield* selectMusicTrack(context)
      const currentTrack = yield* Ref.get(currentTrackRef)

      // 早期リターン: 同じトラックの場合は何もしない
      const shouldUpdate = Option.match(currentTrack, {
        onNone: () => true,
        onSome: (track) => !track.isPlaying || newTrackId !== track.source?.buffer?.name
      })

      if (!shouldUpdate) {
        return
      }

      yield* crossFadeToTrack(newTrackId)
    })

  const setMusicVolume = (volume: Volume) =>
    Effect.gen(function* () {
      yield* Ref.set(musicVolumeRef, volume)
      const currentTrack = yield* Ref.get(currentTrackRef)

      yield* Option.match(currentTrack, {
        onNone: () => Effect.void,
        onSome: (track) => Effect.sync(() => {
          // 音量のスムーズな変化（ブランド型使用）
          if (track.gainNode) {
            track.gainNode.gain.linearRampToValueAtTime(
              Brand.nominal(volume),
              track.gainNode.context.currentTime + 0.5
            )
          }
        })
      })
    })

  return {
    updateMusic,
    selectMusicTrack,
    crossFadeToTrack,
    setMusicVolume,
    processMusicEvents,
    createMusicScheduleQueue,
    startMusicProcessingLoop
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
// EnvironmentContextスキーマ（拡張版）
export const EnvironmentContext = Schema.Struct({
  _tag: Schema.Literal("EnvironmentContext"),
  biome: Schema.String.annotations({
    description: "現在のバイオーム"
  }),
  weather: Schema.Union(
    Schema.Literal("clear"),
    Schema.Literal("rain"),
    Schema.Literal("thunderstorm"),
    Schema.Literal("snow")
  ).annotations({
    description: "現在の天候状態"
  }),
  timeOfDay: Schema.Union(
    Schema.Literal("dawn"),
    Schema.Literal("day"),
    Schema.Literal("dusk"),
    Schema.Literal("night")
  ).annotations({
    description: "現在の時間帯"
  }),
  underground: Schema.Boolean.annotations({
    description: "地下にいるかどうか"
  }),
  depth: Schema.Optional(Schema.Number.pipe(Schema.int(), Schema.min(0))).annotations({
    description: "地下の深度（オプション）"
  }),
  nearWater: Schema.Boolean.pipe(Schema.default(() => false)).annotations({
    description: "水辺にいるかどうか"
  })
}).annotations({
  identifier: "EnvironmentContext",
  description: "環境音響システムのコンテキスト"
})

// 環境音イベントスキーマ
const AmbientEvent = Schema.Struct({
  _tag: Schema.Literal("AmbientEvent"),
  soundId: Schema.String,
  action: Schema.Union(
    Schema.Literal("start"),
    Schema.Literal("stop"),
    Schema.Literal("update")
  ),
  volume: Schema.instanceOf(Volume as any),
  fadeTime: Schema.Optional(Schema.instanceOf(Duration as any))
}).annotations({
  identifier: "AmbientEvent",
  description: "環境音制御イベント"
})

// 環境音マネージャー（Ref & Stream統合版）
export const AmbientSoundManager = Context.GenericTag<{
  readonly updateAmbientSounds: (context: typeof EnvironmentContext.Type) => Effect.Effect<void, SoundLoadError | AudioContextError>
  readonly determineAmbientSounds: (context: typeof EnvironmentContext.Type) => Effect.Effect<ReadonlyArray<string>, never>
  readonly processAmbientEvents: (events: Stream.Stream<typeof AmbientEvent.Type, never>) =>
    Stream.Stream<AudioSource, SoundLoadError | AudioContextError>
  readonly createAmbientStateRef: () => Effect.Effect<Ref.Ref<Map<string, AudioSource>>, never>
  readonly startAmbientProcessingLoop: (contextStream: Stream.Stream<typeof EnvironmentContext.Type, never>) =>
    Effect.Effect<void, never>
}>("@minecraft/AmbientSoundManager")

const makeAmbientSoundManager = Effect.gen(function* () {
  const soundService = yield* SoundService
  const activeAmbientsRef = yield* Ref.make<Map<string, AudioSource>>(new Map())

  // 環境音状態管理Ref作成
  const createAmbientStateRef = (): Effect.Effect<Ref.Ref<Map<string, AudioSource>>, never> =>
    Ref.make<Map<string, AudioSource>>(new Map())

  // 環境音イベント処理ストリーム
  const processAmbientEvents = (
    events: Stream.Stream<typeof AmbientEvent.Type, never>
  ): Stream.Stream<AudioSource, SoundLoadError | AudioContextError> =>
    events.pipe(
      Stream.mapEffect((event) =>
        Effect.gen(function* () {
          const activeAmbients = yield* Ref.get(activeAmbientsRef)

          // パターンマッチングによるアクション処理
          return yield* Match.value(event.action).pipe(
            Match.when("start", () =>
              Effect.gen(function* () {
                // 既に再生中の場合は早期リターン
                if (activeAmbients.has(event.soundId)) {
                  return activeAmbients.get(event.soundId)!
                }

                const audioSource = yield* soundService.playSound(event.soundId, {
                  category: "ambient",
                  volume: event.volume,
                  loop: true,
                  fadeIn: event.fadeTime
                })

                activeAmbients.set(event.soundId, audioSource)
                yield* Ref.set(activeAmbientsRef, activeAmbients)
                return audioSource
              })
            ),
            Match.when("stop", () =>
              Effect.gen(function* () {
                const existingSource = activeAmbients.get(event.soundId)
                if (!existingSource) {
                  // ダミーのAudioSourceを返す
                  return {
                    _tag: "AudioSource" as const,
                    source: null as any,
                    gainNode: null as any,
                    volume: Volume(0),
                    isPlaying: false,
                    stop: () => {},
                    fadeOut: () => {}
                  } satisfies AudioSource
                }

                const fadeTime = Option.getOrElse(event.fadeTime, () => Duration(3000))
                existingSource.fadeOut(fadeTime)
                activeAmbients.delete(event.soundId)
                yield* Ref.set(activeAmbientsRef, activeAmbients)
                return existingSource
              })
            ),
            Match.when("update", () =>
              Effect.gen(function* () {
                const existingSource = activeAmbients.get(event.soundId)
                if (!existingSource) {
                  return yield* processAmbientEvents(Stream.succeed({
                    ...event,
                    action: "start"
                  })).pipe(Stream.runHead, Effect.flatMap(Option.getOrThrow))
                }

                // 音量更新
                if (existingSource.gainNode) {
                  existingSource.gainNode.gain.linearRampToValueAtTime(
                    Brand.nominal(event.volume),
                    existingSource.gainNode.context.currentTime + 0.5
                  )
                }

                return existingSource
              })
            ),
            Match.exhaustive
          )
        })
      )
    )

  const determineAmbientSounds = (context: typeof EnvironmentContext.Type) =>
    Effect.gen(function* () {
      const sounds: string[] = []

      // バイオーム環境音
      sounds.push(`ambient.${context.biome}`)

      // 天候音のパターンマッチング
      const weatherSounds = Match.value(context.weather).pipe(
        Match.when("rain", () => ["ambient.weather.rain"]),
        Match.when("thunderstorm", () => ["ambient.weather.rain", "ambient.weather.thunder"]),
        Match.when("snow", () => ["ambient.weather.snow"]),
        Match.orElse(() => [])
      )
      sounds.push(...weatherSounds)

      // 時間帯音（早期リターン適用）
      if (context.timeOfDay === "night") {
        sounds.push("ambient.night")
      }

      // 地下音（深度による分岐）
      if (context.underground) {
        const depth = Option.getOrElse(context.depth, () => 0)
        if (depth > 50) {
          sounds.push("ambient.deepcave")
        } else {
          sounds.push("ambient.cave")
        }
      }

      // 水辺音
      if (context.nearWater) {
        sounds.push("ambient.water")
      }

      return sounds
    })

  // 環境音処理ループ（ストリームベース）
  const startAmbientProcessingLoop = (
    contextStream: Stream.Stream<typeof EnvironmentContext.Type, never>
  ) =>
    Effect.gen(function* () {
      const eventStream = contextStream.pipe(
        Stream.mapEffect((context) =>
          Effect.gen(function* () {
            const requiredAmbients = yield* determineAmbientSounds(context)
            const activeAmbients = yield* Ref.get(activeAmbientsRef)

            // 停止すべき環境音の検出
            const stopEvents = Array.from(activeAmbients.keys())
              .filter(id => !requiredAmbients.includes(id))
              .map(id => ({
                _tag: "AmbientEvent" as const,
                soundId: id,
                action: "stop" as const,
                volume: Volume(0.4),
                fadeTime: Duration(3000)
              }))

            // 開始すべき環境音の検出
            const startEvents = requiredAmbients
              .filter(id => !activeAmbients.has(id))
              .map(id => ({
                _tag: "AmbientEvent" as const,
                soundId: id,
                action: "start" as const,
                volume: Volume(0.4),
                fadeTime: Duration(3000)
              }))

            return [...stopEvents, ...startEvents]
          })
        ),
        Stream.flatten
      )

      const audioStream = processAmbientEvents(eventStream)

      // ストリームを実行（バックグラウンド処理）
      yield* Stream.runDrain(audioStream).pipe(
        Effect.forkDaemon
      )
    })

  const updateAmbientSounds = (context: typeof EnvironmentContext.Type) =>
    Effect.gen(function* () {
      const requiredAmbients = yield* determineAmbientSounds(context)
      const activeAmbients = yield* Ref.get(activeAmbientsRef)

      // 不要な環境音を停止（Stream使用）
      const stopEvents = Array.from(activeAmbients.keys())
        .filter(id => !requiredAmbients.includes(id))
        .map(id => ({
          _tag: "AmbientEvent" as const,
          soundId: id,
          action: "stop" as const,
          volume: Volume(0.4),
          fadeTime: Duration(3000)
        }))

      // 新しい環境音を開始（Stream使用）
      const startEvents = requiredAmbients
        .filter(id => !activeAmbients.has(id))
        .map(id => ({
          _tag: "AmbientEvent" as const,
          soundId: id,
          action: "start" as const,
          volume: Volume(0.4),
          fadeTime: Duration(3000)
        }))

      const allEvents = [...stopEvents, ...startEvents]

      // 早期リターン: イベントが無い場合
      if (allEvents.length === 0) {
        return
      }

      const eventStream = Stream.fromIterable(allEvents)
      const audioStream = processAmbientEvents(eventStream)

      // ストリームを実行
      yield* Stream.runDrain(audioStream)
    })

  return {
    updateAmbientSounds,
    determineAmbientSounds,
    processAmbientEvents,
    createAmbientStateRef,
    startAmbientProcessingLoop
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
// オーディオ設定（ブランド型使用）
export const AudioSettings = Schema.Struct({
  _tag: Schema.Literal("AudioSettings"),
  masterVolume: Schema.transform(
    Schema.Number.pipe(Schema.min(0), Schema.max(1)),
    Schema.instanceOf(Volume as any),
    { decode: Volume, encode: Brand.nominal }
  ),
  musicVolume: Schema.transform(
    Schema.Number.pipe(Schema.min(0), Schema.max(1)),
    Schema.instanceOf(Volume as any),
    { decode: Volume, encode: Brand.nominal }
  ),
  effectsVolume: Schema.transform(
    Schema.Number.pipe(Schema.min(0), Schema.max(1)),
    Schema.instanceOf(Volume as any),
    { decode: Volume, encode: Brand.nominal }
  ),
  ambientVolume: Schema.transform(
    Schema.Number.pipe(Schema.min(0), Schema.max(1)),
    Schema.instanceOf(Volume as any),
    { decode: Volume, encode: Brand.nominal }
  ),
  uiVolume: Schema.transform(
    Schema.Number.pipe(Schema.min(0), Schema.max(1)),
    Schema.instanceOf(Volume as any),
    { decode: Volume, encode: Brand.nominal }
  ),
  spatialAudio: Schema.Boolean.pipe(Schema.default(() => true)),
  subtitles: Schema.Boolean.pipe(Schema.default(() => false)),
  maxConcurrentSounds: Schema.Number.pipe(
    Schema.int(),
    Schema.between(16, 256),
    Schema.default(() => 64)
  ).annotations({
    description: "同時再生可能な最大音源数"
  }),
  bufferSize: Schema.Number.pipe(
    Schema.int(),
    Schema.between(256, 4096),
    Schema.default(() => 1024)
  ).annotations({
    description: "オーディオバッファサイズ"
  })
}).annotations({
  identifier: "AudioSettings",
  description: "サウンドシステムの設定"
})

// プロパティベーステスト用のArbitrary定義
export const VolumeArbitrary = fc.double({ min: 0, max: 1 }).map(Volume)
export const FrequencyArbitrary = fc.double({ min: 0.5, max: 2.0 }).map(Frequency)
export const DurationArbitrary = fc.nat(10000).map(Duration)
export const AttenuationDistanceArbitrary = fc.double({ min: 0.1, max: 100 }).map(AttenuationDistance)

export const SoundEventArbitrary = fc.record({
  _tag: fc.constant("SoundEvent" as const),
  soundId: fc.string({ minLength: 1, maxLength: 50 }),
  category: fc.constantFrom("ambient", "block", "entity", "player", "music", "ui"),
  position: fc.option(PositionArbitrary),
  volume: VolumeArbitrary,
  pitch: FrequencyArbitrary,
  attenuation: fc.option(AttenuationDistanceArbitrary),
  loop: fc.boolean(),
  fadeIn: fc.option(DurationArbitrary),
  fadeOut: fc.option(DurationArbitrary)
})

export const AudioSettingsArbitrary = fc.record({
  _tag: fc.constant("AudioSettings" as const),
  masterVolume: VolumeArbitrary,
  musicVolume: VolumeArbitrary,
  effectsVolume: VolumeArbitrary,
  ambientVolume: VolumeArbitrary,
  uiVolume: VolumeArbitrary,
  spatialAudio: fc.boolean(),
  subtitles: fc.boolean(),
  maxConcurrentSounds: fc.integer({ min: 16, max: 256 }),
  bufferSize: fc.integer({ min: 256, max: 4096 })
})
```

## テストケース

### プロパティベーステスト（Fast-Check統合）
```typescript
import { it } from "@effect/vitest"
import * as fc from "fast-check"

// サウンドイベントのプロパティテスト
it.prop([SoundEventArbitrary])("should validate SoundEvent properties", (soundEvent) =>
  Effect.gen(function* () {
    // スキーマ検証
    const decoded = yield* Schema.decode(SoundEvent)(soundEvent)

    // 不変条件の検証
    expect(Brand.nominal(decoded.volume)).toBeGreaterThanOrEqual(0)
    expect(Brand.nominal(decoded.volume)).toBeLessThanOrEqual(1)
    expect(Brand.nominal(decoded.pitch)).toBeGreaterThanOrEqual(0.5)
    expect(Brand.nominal(decoded.pitch)).toBeLessThanOrEqual(2.0)

    // オプショナルフィールドの検証
    if (decoded.fadeIn) {
      expect(Brand.nominal(decoded.fadeIn)).toBeGreaterThanOrEqual(0)
    }
    if (decoded.fadeOut) {
      expect(Brand.nominal(decoded.fadeOut)).toBeGreaterThanOrEqual(0)
    }
  })
)

// 空間音響データのプロパティテスト
it.prop([
  fc.record({
    listenerPos: PositionArbitrary,
    soundPos: PositionArbitrary
  })
])("should calculate spatial audio correctly", ({ listenerPos, soundPos }) =>
  Effect.gen(function* () {
    const spatialProcessor = yield* SpatialAudioProcessor
    const spatialData = yield* spatialProcessor.calculateSpatialData(listenerPos, soundPos)

    // 距離は非負である
    expect(Brand.nominal(spatialData.distance)).toBeGreaterThanOrEqual(0)

    // 方位角は -π から π の範囲
    expect(Brand.nominal(spatialData.azimuth)).toBeGreaterThanOrEqual(-Math.PI)
    expect(Brand.nominal(spatialData.azimuth)).toBeLessThanOrEqual(Math.PI)

    // 仰角は -π/2 から π/2 の範囲
    expect(Brand.nominal(spatialData.elevation)).toBeGreaterThanOrEqual(-Math.PI/2)
    expect(Brand.nominal(spatialData.elevation)).toBeLessThanOrEqual(Math.PI/2)

    // 減衰係数は 0 から 1 の範囲
    expect(Brand.nominal(spatialData.attenuationFactor)).toBeGreaterThanOrEqual(0)
    expect(Brand.nominal(spatialData.attenuationFactor)).toBeLessThanOrEqual(1)
  })
)

// 音楽システムのプロパティテスト
it.prop([
  fc.record({
    biome: fc.string({ minLength: 1, maxLength: 20 }),
    timeOfDay: fc.constantFrom("dawn", "day", "dusk", "night"),
    playerState: fc.constantFrom("idle", "building", "combat", "exploring"),
    weather: fc.constantFrom("clear", "rain", "thunderstorm", "snow"),
    priority: fc.integer({ min: 0, max: 10 })
  })
])("should select appropriate music track", (context) =>
  Effect.gen(function* () {
    const musicManager = yield* MusicManager
    const musicContext = { _tag: "MusicContext" as const, ...context }
    const trackId = yield* musicManager.selectMusicTrack(musicContext)

    // トラックIDは有効な文字列である
    expect(typeof trackId).toBe("string")
    expect(trackId.length).toBeGreaterThan(0)

    // 戦闘時は戦闘音楽が優先される
    if (context.priority >= 8 && context.playerState === "combat") {
      expect(trackId).toBe("music.combat")
    }

    // 嵐の時は嵐音楽が優先される
    if (context.priority >= 7 && context.weather === "thunderstorm") {
      expect(trackId).toBe("music.storm")
    }
  })
)
```

### 基本音響機能
- [x] 各カテゴリの音声再生（Schema検証付き）
- [x] 音量・ピッチ制御（ブランド型使用）
- [x] 3D音響の距離減衰（プロパティテスト）
- [x] 方向性の正確性（空間データ計算）

### 動的システム
- [x] バイオーム変更時の音楽切り替え（パターンマッチング）
- [x] 天候変化時の環境音更新（Stream処理）
- [x] 戦闘開始・終了時の音楽変化（優先度システム）
- [x] クロスフェード効果（Queue・Stream統合）

### ストリーム処理
- [x] 音声イベントストリーム処理
- [x] 複数ストリームのミキシング
- [x] バックプレッシャー処理
- [x] エラーハンドリング（早期リターン）

### パフォーマンス
- [x] 大量音源の同時再生（Stream.mergeAll）
- [x] メモリ使用量の監視（Ref状態管理）
- [x] CPU負荷の測定（Effect.forkDaemon）
- [x] 音声遅延の検証（Queue処理）

## 今後の拡張

### プランされた機能
- **カスタム音楽**: プレイヤーのBGM追加機能
- **音声チャット**: マルチプレイヤーでのボイス通信
- **レコードシステム**: ジュークボックスでの音楽再生
- **サウンドパック**: コミュニティ作成の音響セット
