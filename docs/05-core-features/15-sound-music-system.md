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

// 音響管理システム
export class SoundService extends Effect.Service<SoundService>()("SoundService", {
  effect: Effect.gen(function* () {
    const audioContext = yield* AudioContext
    const soundLoader = yield* SoundLoader
    const spatialAudio = yield* SpatialAudioProcessor

    return {
      playSound: (soundId: string, options?: Partial<SoundEvent>) =>
        Effect.gen(function* () {
          const soundEvent: SoundEvent = {
            soundId,
            category: "block",
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

          // 3D音響処理
          if (soundEvent.position) {
            yield* spatialAudio.applySpatialEffects(source, soundEvent.position)
          }

          // 音量・ピッチ設定
          const gainNode = audioContext.createGain()
          gainNode.gain.value = soundEvent.volume * this.getCategoryVolume(soundEvent.category)
          source.playbackRate.value = soundEvent.pitch

          // ルーティング
          source.connect(gainNode)
          gainNode.connect(audioContext.destination)

          // フェードイン効果
          if (soundEvent.fadeIn) {
            gainNode.gain.setValueAtTime(0, audioContext.currentTime)
            gainNode.gain.linearRampToValueAtTime(
              soundEvent.volume,
              audioContext.currentTime + soundEvent.fadeIn / 1000
            )
          }

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
        }),

      playBlockSound: (blockType: string, action: "place" | "break", position: Position) =>
        Effect.gen(function* () {
          const soundId = `block.${blockType}.${action}`

          yield* this.playSound(soundId, {
            category: "block",
            position,
            volume: 0.8,
            pitch: 0.8 + Math.random() * 0.4 // ピッチにランダム性を追加
          })
        }),

      playPlayerSound: (playerId: PlayerId, soundType: string) =>
        Effect.gen(function* () {
          const player = yield* PlayerService.getPlayer(playerId)
          const soundId = `entity.player.${soundType}`

          yield* this.playSound(soundId, {
            category: "player",
            position: player.position,
            volume: 0.6
          })
        })
    }
  })
}) {}
```

### 3D音響処理システム

#### 空間音響機能
- **距離減衰**: 音源からの距離に応じた音量減少
- **方向性**: ステレオパンによる音源方向の表現
- **遮蔽効果**: 障害物による音の減衰・フィルタリング
- **残響**: 環境に応じたリバーブ効果

```typescript
// 空間音響プロセッサー
export class SpatialAudioProcessor extends Effect.Service<SpatialAudioProcessor>()("SpatialAudioProcessor", {
  effect: Effect.gen(function* () {
    const audioContext = yield* AudioContext

    return {
      applySpatialEffects: (source: AudioBufferSourceNode, soundPosition: Position) =>
        Effect.gen(function* () {
          const playerService = yield* PlayerService
          const player = yield* playerService.getCurrentPlayer()

          // 距離計算
          const distance = Vector3.distance(player.position, soundPosition)
          const maxHearingDistance = 16 // ブロック単位

          if (distance > maxHearingDistance) {
            return // 聞こえない距離
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
          yield* this.applyOcclusionEffects(source, player.position, soundPosition)

          // 音響チェーンに接続
          source.connect(panner)
          return panner
        }),

      applyOcclusionEffects: (source: AudioBufferSourceNode, listenerPos: Position, soundPos: Position) =>
        Effect.gen(function* () {
          const raycast = yield* PhysicsService.raycast(listenerPos, soundPos)

          if (raycast.hit) {
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
          }

          return source
        })
    }
  })
}) {}
```

### 動的音楽システム

#### 音楽制御メカニズム
- **バイオーム別BGM**: 現在のバイオームに応じた音楽選択
- **時間帯変化**: 朝・昼・夕・夜の音楽変化
- **状況対応**: 戦闘・建築・探索時の音楽切り替え
- **クロスフェード**: 音楽間のスムーズな移行

```typescript
// 動的音楽マネージャー
export class MusicManager extends Effect.Service<MusicManager>()("MusicManager", {
  effect: Effect.gen(function* () {
    const soundService = yield* SoundService
    let currentTrack: AudioSource | null = null
    let fadeTimeout: NodeJS.Timeout | null = null

    return {
      updateMusic: (context: MusicContext) =>
        Effect.gen(function* () {
          const newTrackId = yield* this.selectMusicTrack(context)

          if (currentTrack?.soundId !== newTrackId) {
            yield* this.crossFadeToTrack(newTrackId)
          }
        }),

      selectMusicTrack: (context: MusicContext) =>
        Effect.gen(function* () {
          const { biome, timeOfDay, playerState, weather } = context

          // 優先度順で音楽選択

          // 1. 特殊状況（戦闘中）
          if (playerState === "combat") {
            return "music.combat"
          }

          // 2. 特殊バイオーム
          if (biome === "nether") {
            return "music.nether"
          }
          if (biome === "end") {
            return "music.end"
          }

          // 3. 天候
          if (weather === "thunderstorm") {
            return "music.storm"
          }

          // 4. 時間帯 + バイオーム
          const timePrefix = this.getTimeMusicPrefix(timeOfDay)
          return `music.${biome}.${timePrefix}`
        }),

      crossFadeToTrack: (trackId: string) =>
        Effect.gen(function* () {
          // 現在のトラックをフェードアウト
          if (currentTrack) {
            currentTrack.fadeOut(2000)
            if (fadeTimeout) clearTimeout(fadeTimeout)
          }

          // 新しいトラックをフェードイン
          yield* Effect.delay(1000) // オーバーラップ時間

          currentTrack = yield* soundService.playSound(trackId, {
            category: "music",
            volume: 0.7,
            loop: true,
            fadeIn: 2000
          })
        }),

      setMusicVolume: (volume: number) =>
        Effect.gen(function* () {
          if (currentTrack) {
            // 音量のスムーズな変化
            currentTrack.source.connect.gain.linearRampToValueAtTime(
              volume,
              audioContext.currentTime + 0.5
            )
          }
        })
    }
  })
}) {}
```

### 環境音システム

#### アンビエント音響
- **バイオーム環境音**: 各バイオーム固有の背景音
- **天候音**: 雨・雪・雷の音響効果
- **時間環境音**: 夜の虫の音・朝の鳥のさえずり
- **構造物音**: 洞窟の反響・水の流れる音

```typescript
// 環境音マネージャー
export class AmbientSoundManager extends Effect.Service<AmbientSoundManager>()("AmbientSoundManager", {
  effect: Effect.gen(function* () {
    const activeAmbients = new Map<string, AudioSource>()

    return {
      updateAmbientSounds: (context: EnvironmentContext) =>
        Effect.gen(function* () {
          const requiredAmbients = yield* this.determineAmbientSounds(context)

          // 不要な環境音を停止
          for (const [id, source] of activeAmbients) {
            if (!requiredAmbients.includes(id)) {
              source.fadeOut(3000)
              activeAmbients.delete(id)
            }
          }

          // 新しい環境音を開始
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
        }),

      determineAmbientSounds: (context: EnvironmentContext) =>
        Effect.gen(function* () {
          const sounds: string[] = []

          // バイオーム環境音
          sounds.push(`ambient.${context.biome}`)

          // 天候音
          if (context.weather === "rain") {
            sounds.push("ambient.weather.rain")
          } else if (context.weather === "thunderstorm") {
            sounds.push("ambient.weather.rain", "ambient.weather.thunder")
          }

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
    }
  })
}) {}
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
