import { Effect, HashMap, Layer, Option, Ref } from 'effect'
import { AudioEnginePort } from '../domain/audio-engine-port'
import { clamp01, clampPan } from '../domain/audio-utils'
import { acquireAudioContext, wireMasterGain, safeDisconnect, safeStop } from './audio-context-helpers'

import type { ToneHandle, ToneRequest } from '../domain/audio-types'

type ActiveTone = {
  readonly oscillator: OscillatorNode
  readonly gainNode: GainNode
  readonly pannerNode: Option.Option<PannerNode>
}

export class AudioEngine extends Effect.Service<AudioEngine>()('@minecraft/audio/AudioEngine', {
  effect: Effect.gen(function* () {
    const contextRef = yield* Ref.make<Option.Option<AudioContext>>(Option.none())
    const masterGainRef = yield* Ref.make<Option.Option<GainNode>>(Option.none())
    const masterGainValueRef = yield* Ref.make(0.8)
    const activeTonesRef = yield* Ref.make(HashMap.empty<number, ActiveTone>())
    const nextToneIdRef = yield* Ref.make(1)

    const ensureContext = (): Effect.Effect<Option.Option<{ context: AudioContext; masterGain: GainNode }>, never> =>
      Effect.gen(function* () {
        const contextOpt = yield* Ref.get(contextRef)
        const masterOpt = yield* Ref.get(masterGainRef)

        const cached = Option.zipWith(contextOpt, masterOpt, (context, masterGain) => ({ context, masterGain }))
        if (Option.isSome(cached)) return cached
        const context = Option.getOrNull(yield* acquireAudioContext())
        if (context === null) return Option.none<{ context: AudioContext; masterGain: GainNode }>()
        const initialGain = yield* Ref.get(masterGainValueRef)
        const { masterGain } = wireMasterGain(context, initialGain)
        yield* Ref.set(contextRef, Option.some(context))
        yield* Ref.set(masterGainRef, Option.some(masterGain))
        return Option.some({ context, masterGain })
      })

    const playTone = (request: ToneRequest): Effect.Effect<ToneHandle, never> =>
      Effect.gen(function* () {
        const handle = yield* Ref.modify(nextToneIdRef, (id): [ToneHandle, number] => [{ id }, id + 1])

        const runtime = Option.getOrNull(yield* ensureContext())
        if (runtime === null) return handle
        const { context, masterGain } = runtime

        yield* Effect.tryPromise({
          try: () => context.resume(),
          catch: () => new Error('AudioContext resume failed'),
        }).pipe(Effect.catchAllCause(() => Effect.void))

        const oscillator = context.createOscillator()
        oscillator.frequency.value = Math.max(20, request.frequency)
        oscillator.type = request.wave

        const gainNode = context.createGain()
        gainNode.gain.value = clamp01(request.gain)

        const panner: Option.Option<PannerNode> =
          'createPanner' in context
            ? Option.some(context.createPanner())
            : Option.none()

        yield* Effect.sync(() => {
          oscillator.connect(gainNode)

          const pannerNode = Option.getOrNull(panner)
          if (pannerNode === null) {
            gainNode.connect(masterGain)
          } else {
            if (request.position) {
              pannerNode.positionX.value = request.position.x
              pannerNode.positionY.value = request.position.y
              pannerNode.positionZ.value = request.position.z
              pannerNode.panningModel = 'HRTF'
              pannerNode.distanceModel = 'inverse'
              pannerNode.refDistance = 1
              pannerNode.maxDistance = 50
              pannerNode.rolloffFactor = 1
            } else {
              pannerNode.panningModel = 'equalpower'
              pannerNode.positionX.value = clampPan(request.pan ?? 0) * 10
              pannerNode.positionY.value = 0
              pannerNode.positionZ.value = 1
            }
            gainNode.connect(pannerNode)
            pannerNode.connect(masterGain)
          }

          oscillator.onended = () => {
            const pannerNode = Option.getOrNull(panner)
            const pannerDisconnect = pannerNode !== null ? safeDisconnect(pannerNode) : Effect.void
            Effect.runFork(
              Effect.all(
                [safeDisconnect(oscillator), safeDisconnect(gainNode), pannerDisconnect, Ref.update(activeTonesRef, (state) => HashMap.remove(state, handle.id))],
                { concurrency: 'unbounded' },
              ).pipe(Effect.asVoid),
            )
          }

          oscillator.start()

          if (!request.loop) {
            oscillator.stop(context.currentTime + Math.max(0.01, request.durationMs / 1000))
          }
        })

        yield* Ref.update(activeTonesRef, (state) =>
          HashMap.set(state, handle.id, { oscillator, gainNode, pannerNode: panner }),
        )

        return handle
      })

    const stopTone = (handle: ToneHandle): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const toneOpt = yield* Ref.modify(
          activeTonesRef,
          (state): [Option.Option<ActiveTone>, HashMap.HashMap<number, ActiveTone>] =>
            [HashMap.get(state, handle.id), HashMap.remove(state, handle.id)],
        )

        const tone = Option.getOrNull(toneOpt)
        if (tone !== null) {
          const pannerNode = Option.getOrNull(tone.pannerNode)
          const pannerDisconnect = pannerNode !== null ? safeDisconnect(pannerNode) : Effect.void
          yield* Effect.all(
            [safeStop(tone.oscillator), safeDisconnect(tone.oscillator), safeDisconnect(tone.gainNode), pannerDisconnect],
            { concurrency: 'unbounded' },
          ).pipe(Effect.asVoid)
        }
      })

    const setMasterGain = (gain: number): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const nextGain = clamp01(gain)
        yield* Ref.set(masterGainValueRef, nextGain)

        const masterGain = Option.getOrNull(yield* Ref.get(masterGainRef))
        if (masterGain !== null) {
          yield* Effect.sync(() => { masterGain.gain.value = nextGain })
        }
      })

    return {
      playTone,
      stopTone,
      setMasterGain,
    }
  })
}) {}

export const AudioEngineLive = AudioEngine.Default

export const AudioEnginePortLive: Layer.Layer<AudioEnginePort, never, AudioEngine> = Layer.effect(
  AudioEnginePort,
  Effect.gen(function* () {
    const engine = yield* AudioEngine
    return {
      playTone: engine.playTone,
      stopTone: engine.stopTone,
      setMasterGain: engine.setMasterGain,
    }
  })
)
